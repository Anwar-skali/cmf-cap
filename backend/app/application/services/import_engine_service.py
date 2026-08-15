from __future__ import annotations

import io
import time
import uuid
from datetime import datetime, date
from decimal import Decimal
from typing import Any

import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

from app.domain.enums import ActivityAction
from app.domain.import_schema import ENTITY_IMPORT_SCHEMAS, EntityImportSchema, ImportColumnSpec
from app.application.services.data_normalizer import DataNormalizer, NormalizationResult
from app.infrastructure.persistence.unit_of_work import UnitOfWork
import logging

logger = logging.getLogger(__name__)


class ImportEngineService:
    def __init__(self, uow: UnitOfWork) -> None:
        self._uow = uow

    @staticmethod
    def _make_json_safe(record: dict[str, Any]) -> dict[str, Any]:
        """Deep-convert a record dict to JSON-serializable primitives.

        SQLAlchemy stores the 'data' column as JSON. Python types that
        are not natively JSON-serializable (datetime.date, datetime.datetime,
        Decimal) must be converted to strings before being passed to the ORM.
        """
        result: dict[str, Any] = {}
        for k, v in record.items():
            if isinstance(v, datetime):
                result[k] = v.isoformat()
            elif isinstance(v, date):
                result[k] = v.isoformat()
            elif isinstance(v, Decimal):
                result[k] = float(v)
            elif isinstance(v, dict):
                result[k] = ImportEngineService._make_json_safe(v)
            elif isinstance(v, list):
                result[k] = [
                    ImportEngineService._make_json_safe(i) if isinstance(i, dict)
                    else (i.isoformat() if isinstance(i, (date, datetime)) else i)
                    for i in v
                ]
            else:
                result[k] = v
        return result

    def parse_excel_file(
        self,
        file_bytes: bytes,
        specified_orientation: str | None = None,
        specified_sheet_name: str | None = None,
    ) -> dict[str, Any]:
        """
        Extract sheet names, headers, and raw rows from an uploaded Excel file.
        Supports both HORIZONTAL (tabular) and VERTICAL (key-value) orientations.
        """
        workbook = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
        sheets = workbook.sheetnames
        if not sheets:
            raise ValueError("The Excel file contains no worksheets.")

        best_sheet_name = specified_sheet_name if specified_sheet_name and specified_sheet_name in sheets else sheets[0]
        best_rows: list[tuple[Any, ...]] = []

        if specified_sheet_name and specified_sheet_name in sheets:
            ws = workbook[specified_sheet_name]
            best_rows = list(ws.iter_rows(values_only=True))
        else:
            max_count = 0
            for sheet_name in sheets:
                ws = workbook[sheet_name]
                sheet_rows = list(ws.iter_rows(values_only=True))
                if not sheet_rows:
                    continue

                for r in sheet_rows[:20]:
                    non_empty_count = len([c for c in r if c is not None and str(c).strip() != ""])
                    if non_empty_count > max_count:
                        max_count = non_empty_count
                        best_sheet_name = sheet_name
                        best_rows = sheet_rows

        if not best_rows:
            return {
                "sheets": sheets,
                "headers": [],
                "rows": [],
                "total_rows": 0,
                "physical_rows": 0,
                "empty_rows_count": 0,
                "orientation": "HORIZONTAL",
            }

        # Run orientation detection
        from app.application.services.excel_header_extractor import ExcelHeaderExtractor
        orient_info = ExcelHeaderExtractor.detect_orientation(
            [list(r) for r in best_rows[:50]], specified_orientation=specified_orientation
        )
        orientation = orient_info["orientation"]

        if orientation == "VERTICAL":
            headers: list[str] = []
            single_row_vals: list[Any] = []
            seen_fields = set()

            for r in best_rows:
                if not r:
                    continue
                cell_a = str(r[0]).strip() if len(r) > 0 and r[0] is not None else ""
                cell_b = r[1] if len(r) > 1 else None

                if cell_a:
                    if cell_a in seen_fields:
                        logger.warning("[VERTICAL PARSER] Duplicate field '%s' detected in Column A.", cell_a)
                    else:
                        seen_fields.add(cell_a)
                    headers.append(cell_a)
                    single_row_vals.append(cell_b)

            return {
                "sheets": sheets,
                "selected_sheet": best_sheet_name,
                "headers": headers,
                "rows": [single_row_vals] if headers else [],
                "total_rows": 1 if headers else 0,
                "physical_rows": 1 if headers else 0,
                "empty_rows_count": 0,
                "orientation": "VERTICAL",
                "orientation_info": orient_info,
            }

        # HORIZONTAL Mode
        header_idx = 0
        max_count = 0
        for idx, r in enumerate(best_rows[:20]):
            non_empty_count = len([c for c in r if c is not None and str(c).strip() != ""])
            if non_empty_count > max_count:
                max_count = non_empty_count
                header_idx = idx

        header_row = best_rows[header_idx]
        headers = [str(cell).strip() if cell is not None else "" for cell in header_row]
        while headers and headers[-1] == "":
            headers.pop()

        data_rows = []
        last_data_offset = -1
        for offset, row in enumerate(best_rows[header_idx + 1:]):
            row_vals = list(row[: len(headers)])
            if len(row_vals) < len(headers):
                row_vals.extend([None] * (len(headers) - len(row_vals)))

            if any(cell is not None and str(cell).strip() != "" for cell in row_vals):
                data_rows.append(row_vals)
                last_data_offset = offset

        physical_rows = last_data_offset + 1
        empty_rows_count = max(0, physical_rows - len(data_rows))

        return {
            "sheets": sheets,
            "selected_sheet": best_sheet_name,
            "headers": headers,
            "rows": data_rows,
            "total_rows": len(data_rows),
            "physical_rows": physical_rows,
            "empty_rows_count": empty_rows_count,
            "orientation": "HORIZONTAL",
            "orientation_info": orient_info,
        }

    def auto_map_columns(
        self, headers: list[str], schema: EntityImportSchema
    ) -> dict[str, str | None]:
        """
        Deterministic multi-level auto-matching between Excel headers and schema fields:
        Level 1: Exact normalized match (key / label)
        Level 2: Known aliases match
        Level 3: Fuzzy matching (>= 0.90 confidence)
        """
        from app.application.services.header_normalizer import normalize_header, compute_similarity

        mapping: dict[str, str | None] = {}
        assigned_keys: set[str] = set()

        # Pass 1: Exact matches
        for header in headers:
            norm_header = normalize_header(header)
            if not norm_header:
                mapping[header] = None
                continue

            matched_key: str | None = None
            for col in schema.columns:
                if col.key in assigned_keys:
                    continue
                if norm_header == normalize_header(col.key) or norm_header == normalize_header(col.label):
                    matched_key = col.key
                    assigned_keys.add(col.key)
                    break

            if matched_key:
                mapping[header] = matched_key

        # Pass 2: Known alias matches
        for header in headers:
            if header in mapping:
                continue
            norm_header = normalize_header(header)
            if not norm_header:
                mapping[header] = None
                continue

            matched_key = None
            for col in schema.columns:
                if col.key in assigned_keys:
                    continue
                norm_aliases = [normalize_header(a) for a in col.aliases if a]
                if norm_header in norm_aliases:
                    matched_key = col.key
                    assigned_keys.add(col.key)
                    break

            if matched_key:
                mapping[header] = matched_key

        # Pass 3: High confidence fuzzy matches (>= 0.90)
        for header in headers:
            if header in mapping:
                continue
            norm_header = normalize_header(header)
            if not norm_header:
                mapping[header] = None
                continue

            best_key = None
            best_score = 0.0
            for col in schema.columns:
                if col.key in assigned_keys:
                    continue
                score_k = compute_similarity(norm_header, normalize_header(col.key))
                score_l = compute_similarity(norm_header, normalize_header(col.label))
                score_a = max([compute_similarity(norm_header, normalize_header(a)) for a in col.aliases if a], default=0.0)
                max_score = max(score_k, score_l, score_a)
                if max_score > best_score:
                    best_score = max_score
                    best_key = col.key

            if best_key and best_score >= 0.90:
                mapping[header] = best_key
                assigned_keys.add(best_key)
            else:
                mapping[header] = None

        return mapping

    @staticmethod
    def _normalize_column_mapping(
        custom_mapping: dict[str, Any], schema: EntityImportSchema, headers: list[str]
    ) -> dict[str, str]:
        """
        Normalizes any custom_mapping dict (whether Excel->DB, DB->Excel, or Ollama dict)
        into a consistent {excel_header: db_field_key} mapping dict.
        """
        from app.application.services.header_normalizer import normalize_header

        column_mapping: dict[str, str] = {}
        schema_keys = {col.key for col in schema.columns}
        schema_key_map = {col.key.lower(): col.key for col in schema.columns}
        schema_norm_map = {normalize_header(col.key): col.key for col in schema.columns}

        # Build lookup for Excel headers present in the uploaded file
        header_map = {normalize_header(h): h for h in headers if h}

        for k, v in custom_mapping.items():
            if v == "__ignore__" or k == "__ignore__":
                continue

            if isinstance(v, dict):
                excel_col = v.get("excel")
                if excel_col and excel_col != "__ignore__":
                    column_mapping[str(excel_col)] = k
            elif isinstance(v, str):
                clean_k = str(k).strip()
                clean_v = str(v).strip()

                norm_k = normalize_header(clean_k)
                norm_v = normalize_header(clean_v)

                k_is_header = norm_k in header_map
                v_is_header = norm_v in header_map

                exact_k_header = header_map.get(norm_k, clean_k) if k_is_header else clean_k
                exact_v_header = header_map.get(norm_v, clean_v) if v_is_header else clean_v

                k_is_db = clean_k in schema_keys or norm_k in schema_norm_map or clean_k.lower() in schema_key_map
                v_is_db = clean_v in schema_keys or norm_v in schema_norm_map or clean_v.lower() in schema_key_map

                resolved_k_db = schema_norm_map.get(norm_k, schema_key_map.get(clean_k.lower(), clean_k)) if k_is_db else clean_k
                resolved_v_db = schema_norm_map.get(norm_v, schema_key_map.get(clean_v.lower(), clean_v)) if v_is_db else clean_v

                if k_is_header and v_is_db:
                    column_mapping[exact_k_header] = resolved_v_db
                elif v_is_header and k_is_db:
                    column_mapping[exact_v_header] = resolved_k_db
                elif k_is_header:
                    column_mapping[exact_k_header] = resolved_v_db
                elif v_is_header:
                    column_mapping[exact_v_header] = resolved_k_db
                else:
                    column_mapping[clean_k] = resolved_v_db if v_is_db else clean_v

        return column_mapping

    async def _get_schema(self, entity_type: str) -> EntityImportSchema:
        lower_type = entity_type.lower().strip()
        if lower_type in ENTITY_IMPORT_SCHEMAS:
            return ENTITY_IMPORT_SCHEMAS[lower_type]

        # Resolve dynamic template (K9, K0, or custom template)
        from app.application.services.template_context_service import TemplateContextService

        ctx_svc = TemplateContextService(self._uow)
        ctx = await ctx_svc.get_template_context(entity_type)
        if not ctx.fields:
            raise ValueError(f"Unsupported entity or template type: '{entity_type}'")

        columns = []
        for f in ctx.fields:
            is_unique = f.key in ["unique_id", "code", "part_number", "id"]
            columns.append(
                ImportColumnSpec(
                    key=f.key,
                    label=f.label,
                    required=f.required,
                    type=f.type if f.type in ["string", "integer", "number", "date", "enum", "textarea", "text"] else "string",
                    aliases=f.aliases,
                    description=f.description,
                    unique_key=is_unique,
                )
            )

        return EntityImportSchema(
            entity_type=ctx.template_code,
            display_name=ctx.template_name,
            columns=columns,
            sample_rows=[],
        )

    @staticmethod
    def _unique_key_columns(schema: EntityImportSchema) -> list[str]:
        """Return the schema keys that identify a real record (unique keys).

        ``id`` is excluded: it is never supplied by an Excel import, so treating
        it as a record-identifying key would wrongly classify rows as records.
        """
        return [c.key for c in schema.columns if c.unique_key and c.key != "id"]

    @staticmethod
    def _row_has_record_key(values: dict[str, Any], schema: EntityImportSchema) -> bool:
        """Determine whether a parsed row represents an actual data record.

        A row is a record when any unique-key column carries a non-empty value
        (e.g. ``part_number`` for the K0 structure). Rows without a unique-key
        value are non-record rows (section headers, notes, blank placeholders)
        and must be excluded from validation, preview, and import counts.
        """
        unique_key_keys = ImportEngineService._unique_key_columns(schema)
        if not unique_key_keys:
            return any(
                v is not None and str(v).strip() != ""
                for v in values.values()
            )
        return any(
            values.get(k) is not None and str(values.get(k)).strip() != ""
            for k in unique_key_keys
        )

    async def preview_and_validate(
        self,
        file_bytes: bytes,
        file_name: str,
        entity_type: str,
        custom_mapping: dict[str, str] | None = None,
        orientation: str | None = None,
        sheet_name: str | None = None,
    ) -> dict[str, Any]:
        """
        Parses the Excel file, validates header schema and row values,
        checks for duplicates, and produces a complete validation preview report.
        """
        schema = await self._get_schema(entity_type)
        parsed = self.parse_excel_file(file_bytes, specified_orientation=orientation, specified_sheet_name=sheet_name)
        headers = parsed["headers"]
        data_rows = parsed["rows"]
        parsed_orientation = parsed.get("orientation", "HORIZONTAL")
        parsed_orientation_info = parsed.get("orientation_info", {})

        # Step 1: Mapping setup
        if custom_mapping:
            column_mapping = self._normalize_column_mapping(custom_mapping, schema, headers)
        else:
            column_mapping = self.auto_map_columns(headers, schema)

        # Invert mapping to map db_field_key -> excel_header
        mapped_fields: dict[str, str] = {
            v: k for k, v in column_mapping.items() if v is not None
        }

        validation_errors: list[dict[str, Any]] = []

        # Step 2: Header checks
        missing_mandatory_fields: list[str] = []
        for col_spec in schema.columns:
            if col_spec.required and col_spec.key not in mapped_fields:
                missing_mandatory_fields.append(col_spec.label)

        if missing_mandatory_fields:
            validation_errors.append(
                {
                    "row_index": 0,
                    "column_name": "Header",
                    "field_key": "header",
                    "raw_value": None,
                    "error_type": "MissingMandatoryColumn",
                    "message": f"Missing required column(s): {', '.join(missing_mandatory_fields)}",
                }
            )

        # Step 3: Row-by-Row validation & duplicate detection
        unique_key_spec = next((c for c in schema.columns if c.unique_key), None)
        seen_unique_values: dict[str, int] = {}  # clean_value -> first_seen_row_idx

        # Database existing unique values check
        existing_db_unique_values: set[str] = set()
        if unique_key_spec:
            existing_db_unique_values = await self._get_existing_db_unique_keys(
                entity_type, unique_key_spec.key
            )

        valid_rows_count = 0
        error_rows_set: set[int] = set()
        duplicate_in_excel_set: set[int] = set()
        duplicate_in_db_set: set[int] = set()
        validation_error_rows_set: set[int] = set()
        non_record_rows_set: set[int] = set()
        record_rows_count = 0

        preview_rows: list[dict[str, Any]] = []
        normalization_warnings: list[dict[str, Any]] = []

        for row_idx, row_vals in enumerate(data_rows, start=1):
            row_raw_dict: dict[str, Any] = {}
            row_dict: dict[str, Any] = {}
            row_norm_details: dict[str, Any] = {}
            row_has_error = False

            # Convert row using column mapping
            for header, val in zip(headers, row_vals):
                db_key = column_mapping.get(header)
                if db_key:
                    row_raw_dict[db_key] = val

            is_record = self._row_has_record_key(row_raw_dict, schema)
            if is_record:
                record_rows_count += 1
            else:
                non_record_rows_set.add(row_idx)

            # Normalize and Validate each schema column
            for col_spec in schema.columns:
                raw_val = row_raw_dict.get(col_spec.key)
                excel_hdr = mapped_fields.get(col_spec.key, col_spec.label)

                # Stage 1: Data Normalization
                norm = DataNormalizer.normalize(raw_val, col_spec)

                if norm.warning:
                    normalization_warnings.append(
                        {
                            "row_index": row_idx,
                            "column_name": col_spec.label,
                            "field_key": col_spec.key,
                            "original_value": str(raw_val) if raw_val is not None else None,
                            "warning": norm.warning,
                        }
                    )

                # Stage 2: Validation on Normalized Value
                if norm.is_null:
                    if col_spec.required:
                        msg = f"Field '{col_spec.label}' is mandatory."
                        validation_errors.append(
                            {
                                "row_index": row_idx,
                                "column_name": col_spec.label,
                                "field_key": col_spec.key,
                                "raw_value": str(raw_val) if raw_val is not None else None,
                                "error_type": "EmptyValue",
                                "message": msg,
                            }
                        )
                        row_has_error = True
                        validation_error_rows_set.add(row_idx)
                        row_norm_details[col_spec.key] = {
                            "original": raw_val,
                            "normalized": None,
                            "status": "error",
                            "message": msg,
                        }
                    else:
                        row_dict[col_spec.key] = None
                        row_norm_details[col_spec.key] = {
                            "original": raw_val,
                            "normalized": None,
                            "status": "warning" if norm.warning else "valid",
                            "message": norm.warning or "Normalized to NULL",
                        }
                else:
                    coerced_val, err_msg = self._validate_and_coerce_type(norm.normalized_value, col_spec)
                    if err_msg:
                        validation_errors.append(
                            {
                                "row_index": row_idx,
                                "column_name": col_spec.label,
                                "field_key": col_spec.key,
                                "raw_value": str(raw_val),
                                "error_type": "InvalidDataType",
                                "message": err_msg,
                            }
                        )
                        row_has_error = True
                        validation_error_rows_set.add(row_idx)
                        row_norm_details[col_spec.key] = {
                            "original": raw_val,
                            "normalized": str(norm.normalized_value),
                            "status": "error",
                            "message": err_msg,
                        }
                    else:
                        row_dict[col_spec.key] = coerced_val
                        norm_disp = coerced_val.isoformat() if isinstance(coerced_val, (date, datetime)) else coerced_val
                        row_norm_details[col_spec.key] = {
                            "original": raw_val,
                            "normalized": norm_disp,
                            "status": "valid",
                            "message": "OK",
                        }

                logger.debug(
                    "[NORM] Row %d | Excel Header: '%s' -> DB Field: '%s' (%s) | Original: %r | Normalized: %r | Result: %s | Reason: %s",
                    row_idx,
                    excel_hdr,
                    col_spec.key,
                    col_spec.type,
                    raw_val,
                    row_dict.get(col_spec.key),
                    "ERROR" if row_norm_details[col_spec.key]["status"] == "error" else "OK",
                    row_norm_details[col_spec.key]["message"],
                )

            # Stage 3: Duplicate detection (Excel file & Database)
            if unique_key_spec and unique_key_spec.key in row_dict and row_dict[unique_key_spec.key] is not None:
                u_val = str(row_dict[unique_key_spec.key]).strip()
                clean_u_val = u_val.lower()

                # Duplicate inside Excel file check
                if clean_u_val in seen_unique_values:
                    first_row = seen_unique_values[clean_u_val]
                    validation_errors.append(
                        {
                            "row_index": row_idx,
                            "column_name": unique_key_spec.label,
                            "field_key": unique_key_spec.key,
                            "raw_value": u_val,
                            "error_type": "DuplicateInFile",
                            "message": f"Duplicate value '{u_val}' found in Excel (first seen in row {first_row}).",
                        }
                    )
                    row_has_error = True
                    duplicate_in_excel_set.add(row_idx)
                else:
                    seen_unique_values[clean_u_val] = row_idx

                # Duplicate against Database check
                if clean_u_val in existing_db_unique_values:
                    row_dict["_exists_in_db"] = True
                    validation_errors.append(
                        {
                            "row_index": row_idx,
                            "column_name": unique_key_spec.label,
                            "field_key": unique_key_spec.key,
                            "raw_value": u_val,
                            "error_type": "DuplicateInDatabase",
                            "message": f"Value '{u_val}' already exists in database.",
                        }
                    )
                    row_has_error = True
                    duplicate_in_db_set.add(row_idx)

            if is_record:
                if row_has_error:
                    error_rows_set.add(row_idx)
                else:
                    valid_rows_count += 1

            if len(preview_rows) < 100:
                preview_entry: dict[str, Any] = {}
                for k, v in row_dict.items():
                    preview_entry[k] = v.isoformat() if isinstance(v, (date, datetime)) else v
                preview_entry["_row_index"] = row_idx
                preview_entry["_has_error"] = row_has_error
                preview_entry["_is_record"] = is_record
                preview_entry["norm_details"] = row_norm_details
                preview_entry["_norm_details"] = row_norm_details
                preview_rows.append(preview_entry)

        # Non-record rows are ignored entirely: drop their (irrelevant) errors and
        # warnings so the report only reflects actual data records.
        if non_record_rows_set:
            validation_errors = [
                e for e in validation_errors if e.get("row_index") not in non_record_rows_set
            ]
            normalization_warnings = [
                w for w in normalization_warnings if w.get("row_index") not in non_record_rows_set
            ]

        return {
            "entity_type": entity_type,
            "entity_display_name": schema.display_name,
            "file_name": file_name,
            "total_rows": len(data_rows),
            "physical_rows": parsed.get("physical_rows", len(data_rows)),
            "empty_rows_count": parsed.get("empty_rows_count", 0),
            "non_record_rows_count": len(non_record_rows_set),
            "record_rows_count": record_rows_count,
            "valid_rows_count": valid_rows_count,
            "error_rows_count": len(error_rows_set),
            "duplicate_in_excel_count": len(duplicate_in_excel_set),
            "duplicate_in_db_count": len(duplicate_in_db_set),
            "validation_errors_count": len(
                {e.get("row_index") for e in validation_errors if e.get("row_index", 0) > 0}
            ),
            "headers": headers,
            "column_mapping": column_mapping,
            "available_schema_columns": [
                {
                    "key": c.key,
                    "label": c.label,
                    "required": c.required,
                    "type": c.type,
                }
                for c in schema.columns
            ],
            "validation_errors": validation_errors,
            "normalization_warnings": normalization_warnings,
            "preview_rows": preview_rows,
            "orientation": parsed_orientation,
            "orientation_info": parsed_orientation_info,
        }

    async def execute_import(
        self,
        file_bytes: bytes,
        file_name: str,
        entity_type: str,
        column_mapping: dict[str, str],
        mode: str = "insert",  # insert | upsert
        strategy: str = "skip_invalid",  # skip_invalid | rollback_all
        user_id: uuid.UUID | None = None,
        user_email: str | None = None,
        orientation: str | None = None,
        sheet_name: str | None = None,
    ) -> dict[str, Any]:
        """
        Executes database import with transactional safety, audit logging,
        and history recording.
        """
        start_time = time.time()
        logger.info("[IMPORT DEBUG] Starting execution for file '%s' with template '%s'", file_name, entity_type)
        logger.info("[IMPORT DEBUG] Selected template: '%s'", entity_type)
        logger.info("[IMPORT DEBUG] Uploaded filename: '%s' (%d bytes)", file_name, len(file_bytes))
        logger.info("[IMPORT DEBUG] Mapped fields: %r", column_mapping)
        logger.info("[IMPORT DEBUG] Import mode: '%s', strategy: '%s'", mode, strategy)

        preview = await self.preview_and_validate(
            file_bytes=file_bytes,
            file_name=file_name,
            entity_type=entity_type,
            custom_mapping=column_mapping,
            orientation=orientation,
            sheet_name=sheet_name,
        )

        validation_errors = preview["validation_errors"]
        has_errors = len(validation_errors) > 0
        logger.info(
            "[IMPORT DEBUG] Validation summary: Total Rows=%d, Valid=%d, Errors=%d",
            preview.get("total_rows", 0),
            preview.get("valid_rows_count", 0),
            len(validation_errors),
        )

        if strategy == "rollback_all" and has_errors:
            logger.warning("[IMPORT DEBUG] Aborting import due to 'rollback_all' strategy with %d validation error(s)", len(validation_errors))
            raise ValueError(
                f"Import aborted: {len(validation_errors)} error(s) detected and 'Rollback All' strategy was selected."
            )

        parsed = self.parse_excel_file(
            file_bytes,
            specified_orientation=orientation,
            specified_sheet_name=sheet_name,
        )
        data_rows = parsed["rows"]
        headers = parsed["headers"]
        schema = await self._get_schema(entity_type)
        unique_key_spec = next((c for c in schema.columns if c.unique_key), None)

        logger.info("[IMPORT DEBUG] Rows detected: %d", len(data_rows))
        logger.info("[IMPORT DEBUG] Headers detected: %r", headers)

        # Categorize validation errors for row-level skip logic
        excel_dup_map = {
            err["row_index"]: err["message"]
            for err in validation_errors
            if err.get("error_type") == "DuplicateInFile" and err["row_index"] > 0
        }
        db_dup_map = {
            err["row_index"]: err["message"]
            for err in validation_errors
            if err.get("error_type") == "DuplicateInDatabase" and err["row_index"] > 0
        }
        val_error_map = {
            err["row_index"]: err
            for err in validation_errors
            if err.get("error_type") not in ("DuplicateInFile", "DuplicateInDatabase") and err["row_index"] > 0
        }

        imported_count = 0
        updated_count = 0
        skipped_count = 0
        failed_count = 0
        duplicate_in_excel_count = 0
        duplicate_in_db_count = 0
        validation_errors_count = 0
        non_record_rows_count = 0

        skipped_details: list[dict[str, Any]] = []
        serializer_errors: list[dict[str, Any]] = []

        # Runtime batch tracking for inserted unique keys
        inserted_in_batch: set[str] = set()

        logger.info("[IMPORT DEBUG] Database transaction: Starting transaction session...")
        async with self._uow as uow:
            for row_idx, row_vals in enumerate(data_rows, start=1):
                # Prepare row values (header -> db field)
                row_dict: dict[str, Any] = {}
                for header, val in zip(headers, row_vals):
                    db_key = column_mapping.get(header)
                    if db_key:
                        row_dict[db_key] = val

                # 0. Skip non-record rows (no value in any unique-key column).
                #    These are section headers, notes, or blank placeholders and
                #    must not be imported as data records.
                if not self._row_has_record_key(row_dict, schema):
                    skipped_count += 1
                    non_record_rows_count += 1
                    skipped_details.append({
                        "row_index": row_idx,
                        "reason": "Ignored non-record row",
                        "message": "Row has no value for the record's unique key; skipped.",
                    })
                    continue

                # 1. Skip Duplicate in Excel file
                if row_idx in excel_dup_map:
                    skipped_count += 1
                    duplicate_in_excel_count += 1
                    skipped_details.append({
                        "row_index": row_idx,
                        "reason": "Duplicate in Excel",
                        "message": excel_dup_map[row_idx],
                    })
                    continue

                # 2. Skip Duplicate in Database (when mode == "insert")
                if mode == "insert" and row_idx in db_dup_map:
                    skipped_count += 1
                    duplicate_in_db_count += 1
                    skipped_details.append({
                        "row_index": row_idx,
                        "reason": "Already exists in database",
                        "message": db_dup_map[row_idx],
                    })
                    continue

                # 3. Skip General Validation Error
                if row_idx in val_error_map:
                    skipped_count += 1
                    validation_errors_count += 1
                    err_info = val_error_map[row_idx]
                    col_name = err_info.get("column_name", "")
                    skipped_details.append({
                        "row_index": row_idx,
                        "reason": f"Validation error: {col_name}" if col_name else "Validation error",
                        "message": err_info.get("message", "Validation error"),
                        "column_name": col_name,
                        "field_key": err_info.get("field_key"),
                        "raw_value": err_info.get("raw_value"),
                    })
                    continue

                # Coerce data types via DataNormalizer pipeline
                coerced_row: dict[str, Any] = {}
                for col_spec in schema.columns:
                    if col_spec.key in row_dict:
                        raw_val = row_dict[col_spec.key]
                        norm = DataNormalizer.normalize(raw_val, col_spec)
                        if not norm.is_null:
                            c_val, err_msg = self._validate_and_coerce_type(norm.normalized_value, col_spec)
                            if err_msg:
                                serializer_errors.append({
                                    "row_index": row_idx,
                                    "field_key": col_spec.key,
                                    "column_name": col_spec.label,
                                    "raw_value": str(raw_val),
                                    "error": err_msg,
                                })
                            coerced_row[col_spec.key] = c_val
                        else:
                            coerced_row[col_spec.key] = None

                # 4. Check runtime duplicate in current batch run
                u_val_str = None
                clean_u_val = None
                if unique_key_spec and unique_key_spec.key in coerced_row and coerced_row[unique_key_spec.key] is not None:
                    u_val_str = str(coerced_row[unique_key_spec.key]).strip()
                    clean_u_val = u_val_str.lower()

                if mode == "insert" and clean_u_val and clean_u_val in inserted_in_batch:
                    skipped_count += 1
                    duplicate_in_excel_count += 1
                    skipped_details.append({
                        "row_index": row_idx,
                        "reason": "Duplicate in Excel",
                        "message": f"Duplicate value '{u_val_str}' already inserted in current import batch.",
                    })
                    continue

                # 5. Row-level isolated database operation (SAVEPOINT)
                try:
                    async with uow.session.begin_nested():
                        success, is_update = await self._import_single_record(
                            uow=uow,
                            entity_type=entity_type,
                            record=coerced_row,
                            mode=mode,
                        )

                    if success:
                        if is_update:
                            updated_count += 1
                        else:
                            imported_count += 1
                            if clean_u_val:
                                inserted_in_batch.add(clean_u_val)
                    else:
                        skipped_count += 1
                        duplicate_in_db_count += 1
                        skipped_details.append({
                            "row_index": row_idx,
                            "reason": "Already exists in database",
                            "message": f"Record '{u_val_str or row_idx}' already exists in database.",
                        })

                except Exception as e:
                    # SAVEPOINT automatically rolled back only this row's savepoint
                    failed_count += 1
                    ser_err = {
                        "row_index": row_idx,
                        "error": str(e),
                        "record": self._make_json_safe(coerced_row),
                    }
                    serializer_errors.append(ser_err)
                    logger.error("[IMPORT DEBUG] Row %d isolated DB insertion error: %s", row_idx, str(e), exc_info=True)
                    if strategy == "rollback_all":
                        logger.warning("[IMPORT DEBUG] Database transaction: Rolling back transaction due to row %d error", row_idx)
                        raise e

            duration_ms = int((time.time() - start_time) * 1000)
            logger.info("[IMPORT DEBUG] Serializer errors count: %d", len(serializer_errors))

            # Record Audit Log
            await uow.activity_logs.create(
                {
                    "user_id": user_id,
                    "action": ActivityAction.CREATE.value,
                    "resource_type": f"import_{entity_type}",
                    "resource_id": str(uuid.uuid4()),
                    "details": {
                        "file_name": file_name,
                        "entity_type": entity_type,
                        "imported_count": imported_count,
                        "updated_count": updated_count,
                        "skipped_count": skipped_count,
                        "failed_count": failed_count,
                        "non_record_rows_count": non_record_rows_count,
                        "total_rows": len(data_rows),
                        "user_email": user_email,
                    },
                }
            )

            # Record Import History
            history_entry = await uow.import_history.create(
                {
                    "user_id": user_id,
                    "user_email": user_email,
                    "entity_type": entity_type,
                    "file_name": file_name,
                    "file_size": len(file_bytes),
                    "total_rows": len(data_rows),
                    "imported_count": imported_count,
                    "updated_count": updated_count,
                    "skipped_count": skipped_count,
                    "failed_count": failed_count,
                    "duration_ms": duration_ms,
                    "mode": mode,
                    "strategy": strategy,
                    "status": "completed" if failed_count == 0 else "partial",
                    "errors_summary": validation_errors[:20],
                }
            )

            await uow.commit()
            logger.info(
                "[IMPORT DEBUG] Database transaction: Committed successfully (Imported: %d, Updated: %d, Skipped: %d, Failed: %d)",
                imported_count,
                updated_count,
                skipped_count,
                failed_count,
            )

        logger.info("[IMPORT DEBUG] Execution time: %d ms", duration_ms)

        return {
            "id": str(history_entry.id),
            "entity_type": entity_type,
            "file_name": file_name,
            "total_rows": len(data_rows),
            "physical_rows": preview.get("physical_rows", len(data_rows)),
            "empty_rows_count": preview.get("empty_rows_count", 0),
            "non_record_rows_count": non_record_rows_count,
            "record_rows_count": preview.get("record_rows_count", 0),
            "imported_count": imported_count,
            "updated_count": updated_count,
            "skipped_count": skipped_count,
            "failed_count": failed_count,
            "duplicate_in_excel_count": duplicate_in_excel_count,
            "duplicate_in_db_count": duplicate_in_db_count,
            "validation_errors_count": validation_errors_count,
            "skipped_details": skipped_details[:50],
            "duration_ms": duration_ms,
            "status": "completed" if failed_count == 0 else "partial",
            "serializer_errors": serializer_errors,
            "message": f"Import completed: {imported_count} imported, {updated_count} updated, {skipped_count} skipped, {failed_count} failed.",
        }

    def generate_sample_template(self, entity_type: str) -> bytes:
        """
        Creates a clean Excel template formatted with headers, example rows, and instructions.
        """
        if entity_type not in ENTITY_IMPORT_SCHEMAS:
            raise ValueError(f"Unknown entity type: '{entity_type}'")

        schema = ENTITY_IMPORT_SCHEMAS[entity_type]
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = f"{schema.display_name} Import"

        # Styling
        header_fill = PatternFill(start_color="1E3A8A", end_color="1E3A8A", fill_type="solid")
        header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
        req_font = Font(name="Calibri", size=11, bold=True, color="FFD700") # Gold for required
        thin_border = Border(
            left=Side(style="thin", color="CCCCCC"),
            right=Side(style="thin", color="CCCCCC"),
            top=Side(style="thin", color="CCCCCC"),
            bottom=Side(style="thin", color="CCCCCC"),
        )

        # Write Headers
        headers = [c.label + (" *" if c.required else "") for c in schema.columns]
        ws.append(headers)

        for col_idx, col_spec in enumerate(schema.columns, start=1):
            cell = ws.cell(row=1, column=col_idx)
            cell.fill = header_fill
            cell.font = req_font if col_spec.required else header_font
            cell.alignment = Alignment(horizontal="center", vertical="center")

        # Write Sample Rows
        for sample in schema.sample_rows:
            row_vals = [sample.get(c.label, "") for c in schema.columns]
            ws.append(row_vals)

        # Autofit columns
        for col in ws.columns:
            max_len = max(len(str(cell.value or "")) for cell in col)
            col_letter = get_column_letter(col[0].column)
            ws.column_dimensions[col_letter].width = max(max_len + 4, 15)

        output = io.BytesIO()
        wb.save(output)
        return output.getvalue()

    async def _get_existing_db_unique_keys(
        self, entity_type: str, unique_key: str
    ) -> set[str]:
        keys: set[str] = set()
        if entity_type == "suppliers":
            suppliers = await self._uow.suppliers.get_multi(limit=5000)
            keys = {s.name.strip().lower() for s in suppliers if s.name}
        elif entity_type == "parts":
            parts = await self._uow.project_parts.get_multi(limit=5000)
            keys = {pt.part_number.strip().lower() for pt in parts if pt.part_number}
        elif entity_type == "risks":
            risks = await self._uow.risks.get_multi(limit=5000)
            keys = {r.title.strip().lower() for r in risks if r.title}
        else:
            projects = await self._uow.projects.get_multi(limit=5000)
            keys = set()
            for p in projects:
                if p.code:
                    keys.add(p.code.strip().lower())
                if p.data and isinstance(p.data, dict):
                    if p.data.get("unique_id"):
                        keys.add(str(p.data.get("unique_id")).strip().lower())
                    if p.data.get("code"):
                        keys.add(str(p.data.get("code")).strip().lower())
                    if p.data.get("part_number"):
                        keys.add(str(p.data.get("part_number")).strip().lower())
        return keys

    async def _import_single_record(
        self,
        uow: UnitOfWork,
        entity_type: str,
        record: dict[str, Any],
        mode: str,
    ) -> tuple[bool, bool]:
        """
        Inserts or updates a record depending on mode and existing presence.
        Returns tuple: (success: bool, is_update: bool)
        """
        if entity_type == "suppliers":
            name = record.get("name")
            existing = await uow.suppliers.get_by_name(name) if name else None
            if existing:
                if mode == "upsert":
                    await uow.suppliers.update(existing.id, record)
                    return True, True
                else:
                    return False, False
            else:
                await uow.suppliers.create(record)
                return True, False

        elif entity_type == "parts":
            part_number = record.get("part_number")
            project_code = record.pop("project_code", None)
            
            project_id = None
            if project_code:
                project = await uow.projects.get_by_code(project_code)
                if project:
                    project_id = project.id
                    record["project_id"] = project_id
                else:
                    return False, False  # Skip if invalid project code
            else:
                first_project = (await uow.projects.get_multi(limit=1))
                if first_project:
                    project_id = first_project[0].id
                    record["project_id"] = project_id
                else:
                    return False, False

            existing = await uow.project_parts.get_by_part_number(part_number) if part_number else None
            if existing and existing.project_id != project_id:
                existing = None

            if existing:
                if mode == "upsert":
                    await uow.project_parts.update(existing.id, record)
                    return True, True
                else:
                    return False, False
            else:
                await uow.project_parts.create(record)
                return True, False

        elif entity_type == "risks":
            title = record.get("title")
            risks = await uow.risks.get_multi(filters={"title": title}) if title else []
            existing = risks[0] if risks else None
            if existing:
                if mode == "upsert":
                    await uow.risks.update(existing.id, record)
                    return True, True
                else:
                    return False, False
            else:
                await uow.risks.create(record)
                return True, False

        else:
            # Default to Project / Project Template
            code = (
                record.get("code")
                or record.get("unique_id")
                or record.get("part_number")
                or f"PRJ-{uuid.uuid4().hex[:8].upper()}"
            )
            name = (
                record.get("name")
                or record.get("part_name")
                or record.get("project_name")
                or f"Project {code}"
            )

            tmpl = await uow.templates.get_by_code(entity_type.upper())
            if tmpl is None:
                try:
                    tmpl = await uow.templates.get(uuid.UUID(entity_type.strip()))
                except (ValueError, AttributeError):
                    pass

            project_payload: dict[str, Any] = {
                "code": str(code),
                "name": str(name),
                "description": record.get("description") or record.get("part_info"),
                "notes": record.get("notes"),
                "data": self._make_json_safe(record),
            }
            if tmpl:
                project_payload["template_id"] = tmpl.id
                project_payload["template_version"] = tmpl.version

            code_str = str(code).strip()
            from sqlalchemy import select
            from app.infrastructure.persistence.models.project import Project as ProjectModel

            stmt = select(ProjectModel).where(ProjectModel.code == code_str)
            res = await uow.session.execute(stmt)
            existing_obj = res.scalars().first()

            if not existing_obj:
                all_stmt = select(ProjectModel)
                all_res = await uow.session.execute(all_stmt)
                clean_target = code_str.lower()
                for p in all_res.scalars().all():
                    if p.code and p.code.strip().lower() == clean_target:
                        existing_obj = p
                        break
                    if p.data and isinstance(p.data, dict):
                        if (
                            str(p.data.get("unique_id", "")).strip().lower() == clean_target
                            or str(p.data.get("code", "")).strip().lower() == clean_target
                            or str(p.data.get("part_number", "")).strip().lower() == clean_target
                        ):
                            existing_obj = p
                            break

            if existing_obj:
                is_soft_deleted = existing_obj.deleted_at is not None
                if mode == "upsert" or is_soft_deleted:
                    # Directly update fields on the ORM object.
                    # We CANNOT use uow.projects.update() here because:
                    #   (a) it calls get() which filters deleted_at IS NULL — soft-deleted
                    #       records would not be found and update() returns None silently.
                    #   (b) its data_dict strips None values, so deleted_at=None would
                    #       never be applied and the record would remain soft-deleted.
                    from sqlalchemy.orm.attributes import flag_modified
                    from datetime import datetime

                    for field, value in project_payload.items():
                        if hasattr(existing_obj, field):
                            setattr(existing_obj, field, value)

                    # Explicitly restore soft-deleted record
                    existing_obj.deleted_at = None
                    existing_obj.updated_at = datetime.utcnow()

                    if hasattr(existing_obj, "data") and "data" in project_payload:
                        flag_modified(existing_obj, "data")

                    uow.session.add(existing_obj)
                    await uow.session.flush()
                    return True, True
                else:
                    return False, False
            else:
                await uow.projects.create(project_payload)
                return True, False

    def _validate_and_coerce_type(
        self, val: Any, spec: ImportColumnSpec
    ) -> tuple[Any, str | None]:
        if val is None:
            return None, None

        field_type = (spec.type or "string").lower()

        if field_type in ("string", "text", "textarea"):
            val_str = val.isoformat() if isinstance(val, (datetime, date)) else str(val).strip()
            return val_str, None

        if isinstance(val, (datetime, date)):
            d_val = val.date() if isinstance(val, datetime) else val
            return d_val, None

        val_str = str(val).strip()
        if not val_str:
            return None, None

        elif field_type == "integer":
            if isinstance(val, int) and not isinstance(val, bool):
                return val, None
            try:
                f_val = float(val_str)
                return int(f_val), None
            except (ValueError, OverflowError):
                return None, f"Expected integer number for '{spec.label}', got '{val_str}'"

        elif field_type == "number":
            if isinstance(val, (int, float)) and not isinstance(val, bool):
                return float(val), None
            try:
                return float(val_str), None
            except (ValueError, OverflowError):
                return None, f"Expected numeric value for '{spec.label}', got '{val_str}'"

        elif field_type == "enum":
            clean_val = val_str.strip()
            if spec.enum_values:
                clean_clean = clean_val.lower().replace(" ", "_")
                matched_enum = next((ev for ev in spec.enum_values if ev.lower().replace(" ", "_") == clean_clean), None)
                if matched_enum is not None:
                    return matched_enum, None
                allowed = ", ".join(spec.enum_values)
                return None, f"Invalid value '{val_str}'. Allowed values: {allowed}"
            return clean_val, None

        elif field_type == "date":
            # For date types, if DataNormalizer returned a date, it was already handled above.
            # If it's a string here, it failed date normalization.
            return None, f"Invalid date format for '{spec.label}'. Expected YYYY-MM-DD."

        return val_str, None
