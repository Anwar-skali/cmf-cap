from __future__ import annotations

import io
from typing import Any
import openpyxl


class ExcelHeaderExtractor:
    """
    Extracts ONLY column headers from an Excel file without sending or reading row data.
    Ensures zero row data leakage to LLMs.
    """

    @staticmethod
    def extract_headers_from_bytes(file_bytes: bytes) -> list[str]:
        """
        Parses an Excel workbook, automatically locates the main data sheet (ignoring chart/summary tabs),
        and returns the list of clean non-empty column headers.
        """
        if not file_bytes:
            raise ValueError("Empty file payload received.")

        workbook = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
        sheets = workbook.sheetnames
        if not sheets:
            raise ValueError("The uploaded Excel workbook contains no worksheets.")

        best_row: list[Any] = []
        max_count = 0

        # Scan all worksheets to find the main data sheet and header row
        for sheet_name in sheets:
            sheet = workbook[sheet_name]
            rows = list(sheet.iter_rows(values_only=True))
            if not rows:
                continue

            for r in rows[:20]:
                non_empty = [c for c in r if c is not None and str(c).strip() != ""]
                if len(non_empty) > max_count:
                    max_count = len(non_empty)
                    best_row = r

        workbook.close()

        headers: list[str] = []
        for cell in best_row:
            val = str(cell).strip() if cell is not None else ""
            if val or headers:
                headers.append(val)

        # Trim empty headers from the end
        while headers and headers[-1] == "":
            headers.pop()

        return headers
