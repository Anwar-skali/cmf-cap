import io
import logging
import re
import time
from typing import Any
import openpyxl

logger = logging.getLogger(__name__)

HEADER_KEYWORDS = {
    "unique_id", "unique id", "supplier_name", "supplier name", "part_number", "part number",
    "part_name", "part name", "apqp", "weekly_capacity", "weekly capacity", "sqe", "sqm",
    "cat1", "cat2", "cat3", "capacity", "supplier", "project", "code", "status", "title",
    "name", "description", "target", "unit", "quantity", "date", "type", "category",
    "email", "phone", "address", "version", "id"
}

# Sheet name or content patterns that strongly suggest non-data sheets (dashboards, summaries, charts, pivot tables)
PENALTY_PATTERNS = re.compile(
    r"\b(dashboard|chart|charts|graph|pivot|pivot table|pivot tables|summary|overview|cover|index|"
    r"kpi|kpi summary|kpi carry-over|report|template|readme|guide|instruction|legend|info|"
    r"master|lookup|reference|ref|drop|dropdown|list|validation|config|sqd list|run scheduling|gst|grand total|row labels|status summary)\b",
    re.IGNORECASE,
)


class ExcelHeaderExtractor:
    """
    Intelligent Excel Extractor with:
    1. Worksheet scoring — automatically finds the data sheet (not dashboards/charts/summaries/pivots)
    2. Header row detection — scores top 20 rows within selected sheet
    3. User override for both worksheet and header row
    4. Zero row data leakage to LLMs
    """

    # ─── Row scoring ──────────────────────────────────────────────────────────

    @staticmethod
    def _score_row(row_cells: list[Any], template_keywords: set[str] | None = None) -> tuple[float, float]:
        """
        Scores a single row. Returns tuple of (raw_score, confidence_percentage).
        """
        non_empty = [str(c).strip() for c in row_cells if c is not None and str(c).strip() != ""]
        if not non_empty:
            return 0.0, 0.0

        score = float(len(non_empty))
        all_keywords = HEADER_KEYWORDS | (template_keywords or set())

        numeric_count = 0
        keyword_hits = 0
        for val in non_empty:
            clean_v = val.lower().replace("_", " ").strip()
            if clean_v in all_keywords:
                score += 10.0
                keyword_hits += 1
            else:
                for kw in all_keywords:
                    if len(kw) >= 3 and (kw in clean_v or clean_v in kw):
                        score += 4.0
                        keyword_hits += 1
                        break

            if re.match(r"^\d+(\.\d+)?$", val) or re.match(r"^\d{4}-\d{2}-\d{2}", val):
                numeric_count += 1

        if len(non_empty) > 0 and (numeric_count / len(non_empty)) > 0.4:
            score -= 20.0

        raw_score = max(score, 0.0)
        # Confidence calculation: ratio of keyword hits & text length
        conf_pct = min(100.0, max(10.0, round((keyword_hits / max(len(non_empty), 1)) * 70.0 + (len(non_empty) / 30.0) * 30.0, 1))) if raw_score > 0 else 0.0
        return raw_score, conf_pct

    # ─── Sheet scoring ────────────────────────────────────────────────────────

    @staticmethod
    def _score_sheet(
        sheet: Any,
        sheet_name: str,
        template_keywords: set[str] | None = None,
    ) -> dict[str, Any]:
        """
        Scores a worksheet on how likely it contains tabular project data.
        Returns a dict with score, confidence %, and metadata.
        """
        name_penalty = 0.0
        if PENALTY_PATTERNS.search(sheet_name):
            name_penalty = -60.0

        rows_sample: list[list[Any]] = []
        try:
            for r in sheet.iter_rows(max_row=20, values_only=True):
                rows_sample.append(list(r) if r else [])
        except Exception:
            pass

        if not rows_sample:
            return {
                "sheet_name": sheet_name,
                "score": 0.0,
                "confidence": 5.0,
                "populated_rows": 0,
                "max_columns": 0,
                "keyword_hits": 0,
                "is_dashboard_name": bool(PENALTY_PATTERNS.search(sheet_name)),
                "preview": [],
            }

        non_empty_rows = 0
        max_cols = 0
        keyword_hits = 0
        penalty_content_hits = 0
        all_keywords = HEADER_KEYWORDS | (template_keywords or set())

        for row in rows_sample:
            non_empty_cells = [str(c).strip() for c in row if c is not None and str(c).strip() != ""]
            if non_empty_cells:
                non_empty_rows += 1
                max_cols = max(max_cols, len(non_empty_cells))
                for cell_val in non_empty_cells:
                    clean = cell_val.lower().replace("_", " ").strip()
                    if PENALTY_PATTERNS.search(clean):
                        penalty_content_hits += 1
                    if clean in all_keywords:
                        keyword_hits += 1
                    else:
                        for kw in all_keywords:
                            if len(kw) >= 3 and (kw in clean or clean in kw):
                                keyword_hits += 1
                                break

        row_score = min(non_empty_rows, 20) * 1.5
        col_score = min(max_cols, 60) * 2.5
        kw_score = min(keyword_hits, 30) * 6.0
        content_penalty = min(penalty_content_hits, 10) * -15.0

        raw_score = row_score + col_score + kw_score + name_penalty + content_penalty
        
        # Calculate 0-100% confidence percentage
        max_benchmark = 30.0 + 150.0 + 180.0  # = 360.0
        if raw_score <= 0:
            confidence_pct = 5.0 if bool(PENALTY_PATTERNS.search(sheet_name)) else 10.0
        else:
            confidence_pct = min(99.0, max(5.0, round((raw_score / max_benchmark) * 100.0, 1)))

        preview_cells: list[str] = []
        for row in rows_sample[:10]:
            cells = [str(c).strip() for c in row if c is not None and str(c).strip() != ""]
            if len(cells) > len(preview_cells):
                preview_cells = cells[:8]

        return {
            "sheet_name": sheet_name,
            "score": round(raw_score, 2),
            "confidence": confidence_pct,
            "populated_rows": non_empty_rows,
            "max_columns": max_cols,
            "keyword_hits": keyword_hits,
            "is_dashboard_name": bool(PENALTY_PATTERNS.search(sheet_name)),
            "preview": preview_cells,
        }

    # ─── Public API ───────────────────────────────────────────────────────────

    @staticmethod
    def extract_workbook_info(file_bytes: bytes, template_keywords: set[str] | None = None) -> dict[str, Any]:
        """
        Reads workbook and returns worksheet scores WITHOUT extracting headers.
        Used in Step 2 of the UI to let user pick the correct worksheet.
        """
        start_t = time.perf_counter()
        if not file_bytes:
            raise ValueError("Empty file payload received.")

        try:
            workbook = openpyxl.load_workbook(io.BytesIO(file_bytes), read_only=True, data_only=True)
        except Exception:
            workbook = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)

        sheet_names = workbook.sheetnames
        if not sheet_names:
            workbook.close()
            raise ValueError("The uploaded Excel workbook contains no worksheets.")

        sheet_scores: list[dict[str, Any]] = []
        best_sheet = sheet_names[0]
        best_score = -9999.0

        for name in sheet_names:
            try:
                ws = workbook[name]
                info = ExcelHeaderExtractor._score_sheet(ws, name, template_keywords)
            except Exception as e:
                logger.debug("[SHEET SCORE] Failed scoring sheet '%s': %s", name, e)
                info = {
                    "sheet_name": name, "score": 0.0, "confidence": 5.0,
                    "populated_rows": 0, "max_columns": 0, "keyword_hits": 0,
                    "is_dashboard_name": False, "preview": [],
                }
            sheet_scores.append(info)
            if info["score"] > best_score:
                best_score = info["score"]
                best_sheet = name

        workbook.close()
        duration_ms = round((time.perf_counter() - start_t) * 1000, 2)

        logger.info(
            "[WORKBOOK SCAN] %d sheets scanned in %.2f ms. Best sheet: '%s' (score=%.1f)",
            len(sheet_names), duration_ms, best_sheet, best_score,
        )
        return {
            "sheets": sheet_scores,
            "detected_sheet": best_sheet,
            "duration_ms": duration_ms,
        }

    @staticmethod
    def extract_headers_with_details(
        file_bytes: bytes,
        specified_header_row: int | None = None,
        specified_sheet_name: str | None = None,
        template_keywords: set[str] | None = None,
    ) -> tuple[list[str], int, float, str, float, list[dict[str, Any]], float]:
        """
        Reads a specific (or auto-detected) worksheet, scores top 20 rows, and extracts headers.

        Returns:
          - headers: list[str]
          - detected_row_index: int (1-based)
          - header_confidence: float (0-100%)
          - sheet_used: str
          - sheet_confidence: float (0-100%)
          - row_previews: list[dict] (preview of top 20 rows)
          - duration_ms: float
        """
        start_t = time.perf_counter()
        if not file_bytes:
            raise ValueError("Empty file payload received.")

        try:
            workbook = openpyxl.load_workbook(io.BytesIO(file_bytes), read_only=True, data_only=True)
        except Exception:
            workbook = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)

        sheet_names = workbook.sheetnames
        if not sheet_names:
            workbook.close()
            raise ValueError("The uploaded Excel workbook contains no worksheets.")

        # Determine target sheet
        sheet_info_map = {}
        best_name = sheet_names[0]
        best_sheet_score = -9999.0

        for name in sheet_names:
            try:
                ws = workbook[name]
                info = ExcelHeaderExtractor._score_sheet(ws, name, template_keywords)
                sheet_info_map[name] = info
                if info["score"] > best_sheet_score:
                    best_sheet_score = info["score"]
                    best_name = name
            except Exception:
                pass

        if specified_sheet_name and specified_sheet_name in sheet_names:
            target_sheet_name = specified_sheet_name
        else:
            target_sheet_name = best_name

        sheet_confidence = sheet_info_map.get(target_sheet_name, {}).get("confidence", 85.0)

        sheet = workbook[target_sheet_name]
        top_20_rows: list[list[Any]] = []

        try:
            for r in sheet.iter_rows(max_row=20, values_only=True):
                top_20_rows.append(list(r) if r else [])
        except Exception as e:
            logger.debug("Failed iterating top 20 rows on sheet '%s': %s", target_sheet_name, e)

        workbook.close()

        if not top_20_rows:
            return [], 1, 0.0, target_sheet_name, sheet_confidence, [], round((time.perf_counter() - start_t) * 1000, 2)

        row_previews: list[dict[str, Any]] = []
        best_row_idx = 1
        best_row_score = -999.0
        best_row_conf = 0.0

        for idx, row in enumerate(top_20_rows, start=1):
            score, conf = ExcelHeaderExtractor._score_row(row, template_keywords)
            non_empty_cells = [str(c).strip() for c in row if c is not None and str(c).strip() != ""]
            row_previews.append({
                "row_number": idx,
                "score": round(score, 2),
                "confidence": conf,
                "non_empty_count": len(non_empty_cells),
                "preview": non_empty_cells[:8],
            })
            if score > best_row_score:
                best_row_score = score
                best_row_idx = idx
                best_row_conf = conf

        target_row_idx = (
            specified_header_row
            if specified_header_row and 1 <= specified_header_row <= len(top_20_rows)
            else best_row_idx
        )
        target_row = top_20_rows[target_row_idx - 1]
        header_confidence = (
            row_previews[target_row_idx - 1]["confidence"]
            if 1 <= target_row_idx <= len(row_previews)
            else best_row_conf
        )

        headers: list[str] = []
        for cell in target_row:
            val = str(cell).strip() if cell is not None else ""
            if val or headers:
                headers.append(val)

        while headers and headers[-1] == "":
            headers.pop()

        duration_ms = round((time.perf_counter() - start_t) * 1000, 2)
        logger.info(
            "[HEADER DETECTED] Sheet: '%s' (conf=%.1f%%) | Row: %d (conf=%.1f%%) | Headers: %d | Elapsed: %.2f ms",
            target_sheet_name, sheet_confidence, target_row_idx, header_confidence, len(headers), duration_ms,
        )
        return headers, target_row_idx, header_confidence, target_sheet_name, sheet_confidence, row_previews, duration_ms

    @staticmethod
    def extract_headers_with_timing(file_bytes: bytes) -> tuple[list[str], float]:
        headers, _, _, _, _, _, duration_ms = ExcelHeaderExtractor.extract_headers_with_details(file_bytes)
        return headers, duration_ms

    @staticmethod
    def extract_headers_from_bytes(file_bytes: bytes) -> list[str]:
        headers, _ = ExcelHeaderExtractor.extract_headers_with_timing(file_bytes)
        return headers
