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
from app.infrastructure.persistence.unit_of_work import UnitOfWork


class ImportEngineService:
    def __init__(self, uow: UnitOfWork) -> None:
        self._uow = uow

    def parse_excel_file(self, file_bytes: bytes) -> dict[str, Any]:
        """
        Extract sheet names, headers, and raw rows from an uploaded Excel file.
        """
        workbook = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
        sheets = workbook.sheetnames
        if not sheets:
            raise ValueError("The Excel file contains no worksheets.")

        first_sheet = workbook[sheets[0]]
        rows = list(first_sheet.iter_rows(values_only=True))

        if not rows:
            return {"sheets": sheets, "headers": [], "rows": [], "total_rows": 0}

        headers = [str(cell).strip() if cell is not None else "" for cell in rows[0]]
        # Filter out empty trailing columns in header
        while headers and headers[-1] == "":
            headers.pop()

        data_rows = []
        for row in rows[1:]:
            # Convert row tuple to list truncated/padded to match headers length
            row_vals = list(row[: len(headers)])
            if len(row_vals) < len(headers):
                row_vals.extend([None] * (len(headers) - len(row_vals)))

            # Skip entirely empty rows
            if any(cell is not None and str(cell).strip() != "" for cell in row_vals):
                data_rows.append(row_vals)

        return {
            "sheets": sheets,
            "headers": headers,
            "rows": data_rows,
            "total_rows": len(data_rows),
        }

    def auto_map_columns(
        self, headers: list[str], schema: EntityImportSchema
    ) -> dict[str, str | None]:
        """
        Fuzzy auto-matching between Excel column headers and database target fields.
        Returns a mapping dict: { excel_header: db_field_key or None }
        """
        mapping: dict[str, str | None] = {}
        assigned_keys: set[str] = set()

        for header in headers:
            clean_header = header.lower().strip()
            matched_key: str | None = None

            # Try exact label or key match
            for col in schema.columns:
                if col.key in assigned_keys:
                    continue
                if (
                    clean_header == col.key.lower()
                    or clean_header == col.label.lower()
                    or clean_header in [a.lower() for a in col.aliases]
                ):
                    matched_key = col.key
                    assigned_keys.add(col.key)
                    break

            mapping[header] = matched_key

        return mapping

    async def preview_and_validate(
        self,
        file_bytes: bytes,
        file_name: str,
        entity_type: str,
        custom_mapping: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        """
        Parses the Excel file, validates header schema and row values,
        checks for duplicates, and produces a complete validation preview report.
        """
        if entity_type not in ENTITY_IMPORT_SCHEMAS:
            raise ValueError(f"Unsupported entity type: '{entity_type}'")

        schema = ENTITY_IMPORT_SCHEMAS[entity_type]
        parsed = self.parse_excel_file(file_bytes)
        headers = parsed["headers"]
        data_rows = parsed["rows"]

        # Step 1: Mapping setup
        if custom_mapping:
            column_mapping = custom_mapping
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

        # Step 3: Row-by-Row validation & internal duplicate check
        unique_key_spec = next((c for c in schema.columns if c.unique_key), None)
        seen_unique_values: set[str] = set()

        # Database existing unique values check
        existing_db_unique_values: set[str] = set()
        if unique_key_spec:
            existing_db_unique_values = await self._get_existing_db_unique_keys(
                entity_type, unique_key_spec.key
            )

        valid_rows_count = 0
        error_rows_set: set[int] = set()
        preview_rows: list[dict[str, Any]] = []

        for row_idx, row_vals in enumerate(data_rows, start=1):
            row_dict: dict[str, Any] = {}
            row_has_error = False

            # Convert row using column mapping
            for header, val in zip(headers, row_vals):
                db_key = column_mapping.get(header)
                if db_key:
                    row_dict[db_key] = val

            # Validate each schema column
            for col_spec in schema.columns:
                val = row_dict.get(col_spec.key)

                # Required check
                if col_spec.required and (val is None or str(val).strip() == ""):
                    validation_errors.append(
                        {
                            "row_index": row_idx,
                            "column_name": col_spec.label,
                            "field_key": col_spec.key,
                            "raw_value": val,
                            "error_type": "EmptyValue",
                            "message": f"Field '{col_spec.label}' is mandatory.",
                        }
                    )
                    row_has_error = True
                    continue

                if val is None or str(val).strip() == "":
                    continue

                # Type checks
                coerced_val, err_msg = self._validate_and_coerce_type(val, col_spec)
                if err_msg:
                    validation_errors.append(
                        {
                            "row_index": row_idx,
                            "column_name": col_spec.label,
                            "field_key": col_spec.key,
                            "raw_value": str(val),
                            "error_type": "InvalidDataType",
                            "message": err_msg,
                        }
                    )
                    row_has_error = True
                else:
                    row_dict[col_spec.key] = coerced_val

            # Unique key duplicate check
            if unique_key_spec and unique_key_spec.key in row_dict:
                u_val = str(row_dict[unique_key_spec.key]).strip()
                if u_val in seen_unique_values:
                    validation_errors.append(
                        {
                            "row_index": row_idx,
                            "column_name": unique_key_spec.label,
                            "field_key": unique_key_spec.key,
                            "raw_value": u_val,
                            "error_type": "DuplicateInFile",
                            "message": f"Duplicate value '{u_val}' found in row {row_idx}.",
                        }
                    )
                    row_has_error = True
                else:
                    seen_unique_values.add(u_val)

                if u_val in existing_db_unique_values:
                    # Mark as existing in database (can be updated in upsert mode)
                    row_dict["_exists_in_db"] = True

            if row_has_error:
                error_rows_set.add(row_idx)
            else:
                valid_rows_count += 1

            if len(preview_rows) < 100:
                row_dict["_row_index"] = row_idx
                row_dict["_has_error"] = row_has_error
                preview_rows.append(row_dict)

        return {
            "entity_type": entity_type,
            "entity_display_name": schema.display_name,
            "file_name": file_name,
            "total_rows": len(data_rows),
            "valid_rows_count": valid_rows_count,
            "error_rows_count": len(error_rows_set),
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
            "preview_rows": preview_rows,
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
    ) -> dict[str, Any]:
        """
        Executes database import with transactional safety, audit logging,
        and history recording.
        """
        start_time = time.time()
        preview = await self.preview_and_validate(
            file_bytes=file_bytes,
            file_name=file_name,
            entity_type=entity_type,
            custom_mapping=column_mapping,
        )

        validation_errors = preview["validation_errors"]
        has_errors = len(validation_errors) > 0

        if strategy == "rollback_all" and has_errors:
            raise ValueError(
                f"Import aborted: {len(validation_errors)} error(s) detected and 'Rollback All' strategy was selected."
            )

        parsed = self.parse_excel_file(file_bytes)
        data_rows = parsed["rows"]
        headers = parsed["headers"]
        schema = ENTITY_IMPORT_SCHEMAS[entity_type]

        imported_count = 0
        updated_count = 0
        skipped_count = 0
        failed_count = 0

        # Group error row indices
        error_row_indices = {
            err["row_index"]
            for err in validation_errors
            if err["row_index"] > 0
        }

        async with self._uow as uow:
            for row_idx, row_vals in enumerate(data_rows, start=1):
                if row_idx in error_row_indices:
                    skipped_count += 1
                    continue

                row_dict: dict[str, Any] = {}
                for header, val in zip(headers, row_vals):
                    db_key = column_mapping.get(header)
                    if db_key:
                        row_dict[db_key] = val

                # Coerce data types
                coerced_row: dict[str, Any] = {}
                for col_spec in schema.columns:
                    if col_spec.key in row_dict:
                        raw_val = row_dict[col_spec.key]
                        if raw_val is not None and str(raw_val).strip() != "":
                            c_val, _ = self._validate_and_coerce_type(
                                raw_val, col_spec
                            )
                            coerced_row[col_spec.key] = c_val

                try:
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
                    else:
                        skipped_count += 1
                except Exception as e:
                    failed_count += 1
                    if strategy == "rollback_all":
                        raise e

            duration_ms = int((time.time() - start_time) * 1000)

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

        return {
            "id": str(history_entry.id),
            "entity_type": entity_type,
            "file_name": file_name,
            "total_rows": len(data_rows),
            "imported_count": imported_count,
            "updated_count": updated_count,
            "skipped_count": skipped_count,
            "failed_count": failed_count,
            "duration_ms": duration_ms,
            "status": "completed",
            "message": f"Successfully imported {imported_count} new and updated {updated_count} records.",
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
        if entity_type == "projects":
            projects = await self._uow.projects.get_multi(limit=5000)
            keys = {p.code for p in projects if p.code}
        elif entity_type == "suppliers":
            suppliers = await self._uow.suppliers.get_multi(limit=5000)
            keys = {s.name for s in suppliers if s.name}
        elif entity_type == "parts":
            parts = await self._uow.project_parts.get_multi(limit=5000)
            keys = {pt.part_number for pt in parts if pt.part_number}
        elif entity_type == "risks":
            risks = await self._uow.risks.get_multi(limit=5000)
            keys = {r.title for r in risks if r.title}
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
        if entity_type == "projects":
            code = record.get("code")
            existing = await uow.projects.get_by_code(code) if code else None
            if existing:
                if mode == "upsert":
                    await uow.projects.update(existing.id, record)
                    return True, True
                else:
                    return False, False  # Skip in insert-only mode
            else:
                await uow.projects.create(record)
                return True, False

        elif entity_type == "suppliers":
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
                # Fallback to first project if code was somehow omitted but not caught by validation
                first_project = (await uow.projects.get_multi(limit=1))
                if first_project:
                    project_id = first_project[0].id
                    record["project_id"] = project_id
                else:
                    return False, False

            existing = await uow.project_parts.get_by_part_number(part_number) if part_number else None
            # If it already exists, verify it belongs to this project (optional, but good practice)
            if existing and existing.project_id != project_id:
                existing = None # Treat as new part if it's in a different project

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

        return False, False

    def _validate_and_coerce_type(
        self, val: Any, spec: ImportColumnSpec
    ) -> tuple[Any, str | None]:
        if val is None:
            return None, None

        val_str = str(val).strip()
        if not val_str:
            return None, None

        if spec.type == "string":
            return val_str, None

        elif spec.type == "integer":
            try:
                # Handle floats like 100.0 from excel
                f_val = float(val_str)
                return int(f_val), None
            except ValueError:
                return None, f"Expected integer number for '{spec.label}', got '{val_str}'"

        elif spec.type == "number":
            try:
                return float(val_str), None
            except ValueError:
                return None, f"Expected numeric value for '{spec.label}', got '{val_str}'"

        elif spec.type == "enum":
            clean_enum = val_str.lower().replace(" ", "_")
            if spec.enum_values and clean_enum not in spec.enum_values:
                allowed = ", ".join(spec.enum_values)
                return None, f"Invalid value '{val_str}'. Allowed values: {allowed}"
            return clean_enum, None

        elif spec.type == "date":
            if isinstance(val, (datetime, date)):
                return (val.date() if isinstance(val, datetime) else val), None
            # Parse string dates
            for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%Y/%m/%d"):
                try:
                    dt = datetime.strptime(val_str, fmt)
                    return dt.date(), None
                except ValueError:
                    continue
            return None, f"Invalid date format for '{spec.label}'. Use YYYY-MM-DD."

        return val_str, None
