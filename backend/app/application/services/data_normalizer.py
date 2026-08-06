from __future__ import annotations

import re
import logging
from dataclasses import dataclass
from datetime import datetime, date
from typing import Any, Optional

from app.domain.import_schema import ImportColumnSpec

logger = logging.getLogger(__name__)

# Common null proxies found in Excel business files
NULL_PROXIES = {
    "",
    "none",
    "null",
    "n/a",
    "na",
    "tbd",
    "tbdefined",
    "to be defined",
    "not requested",
    "-",
    "/",
    "--",
    "undefined",
}


@dataclass
class NormalizationResult:
    original_value: Any
    normalized_value: Any
    is_null: bool
    warning: Optional[str] = None
    was_normalized: bool = False


class DataNormalizer:
    """
    Generic Data Normalization Layer for Excel import columns.
    Cleans and normalizes raw cell values before type validation.
    """

    @classmethod
    def normalize(cls, raw_val: Any, spec: ImportColumnSpec) -> NormalizationResult:
        if raw_val is None:
            return NormalizationResult(
                original_value=raw_val,
                normalized_value=None,
                is_null=True,
                warning=None,
                was_normalized=False,
            )

        # Native datetime/date objects directly from openpyxl
        if isinstance(raw_val, (datetime, date)):
            d_val = raw_val.date() if isinstance(raw_val, datetime) else raw_val
            return NormalizationResult(
                original_value=raw_val,
                normalized_value=d_val,
                is_null=False,
                warning=None,
                was_normalized=False,
            )

        val_str = str(raw_val).strip()
        clean_lower = val_str.lower()

        # Check if value is a known null proxy
        if clean_lower in NULL_PROXIES:
            return NormalizationResult(
                original_value=raw_val,
                normalized_value=None,
                is_null=True,
                warning=None,
                was_normalized=val_str != "",
            )

        field_type = (spec.type or "string").lower()

        if field_type in ("integer", "number"):
            return cls._normalize_numeric(raw_val, val_str, field_type)

        elif field_type == "date":
            return cls._normalize_date(raw_val, val_str, spec)

        elif field_type == "enum":
            return cls._normalize_enum(raw_val, val_str)

        else:  # string, text, textarea, etc.
            return cls._normalize_string(raw_val, val_str)

    @classmethod
    def _normalize_numeric(
        cls, raw_val: Any, val_str: str, field_type: str
    ) -> NormalizationResult:
        # Check if already int or float
        if isinstance(raw_val, (int, float)) and not isinstance(raw_val, bool):
            if field_type == "integer":
                norm_val = int(raw_val)
                was_norm = norm_val != raw_val
            else:
                norm_val = float(raw_val)
                was_norm = False
            return NormalizationResult(
                original_value=raw_val,
                normalized_value=norm_val,
                is_null=False,
                warning=None,
                was_normalized=was_norm,
            )

        # Remove currency symbols (€, $, £, ¥) and spaces
        cleaned = re.sub(r"[€$£¥\s]", "", val_str)
        # Remove percentage sign if present
        cleaned = cleaned.rstrip("%")

        # Handle thousand separators vs decimal points: e.g. "5,200" or "5.200,50" or "5,200.50"
        # If string matches "5,200" (digits comma digits, no dots), replace comma with empty
        if re.match(r"^-?\d{1,3}(,\d{3})+(\.\d+)?$", cleaned):
            cleaned = cleaned.replace(",", "")
        elif re.match(r"^-?\d{1,3}(\.\d{3})+(,\d+)?$", cleaned):
            # European format e.g. 5.200,50 -> 5200.50
            cleaned = cleaned.replace(".", "").replace(",", ".")
        else:
            # Simple replacement if comma is used as decimal separator without thousands
            if "," in cleaned and "." not in cleaned:
                # Check if it looks like "5200,5" -> "5200.5"
                cleaned = cleaned.replace(",", ".")

        # Extract leading numeric portion (e.g., "3400 pcs-sem", "5200 pcs/week", "15 weeks")
        # Match pattern: Optional negative sign, digits, optional decimal point, optional decimal digits
        num_match = re.search(r"^-?\d+(\.\d+)?", cleaned)
        if num_match:
            extracted_str = num_match.group(0)
            try:
                if field_type == "integer":
                    # Handle floats like "3400.0" or extracted "3400"
                    norm_val = int(float(extracted_str))
                else:
                    norm_val = float(extracted_str)

                was_norm = str(norm_val) != val_str and str(raw_val) != str(norm_val)
                return NormalizationResult(
                    original_value=raw_val,
                    normalized_value=norm_val,
                    is_null=False,
                    warning=None,
                    was_normalized=was_norm,
                )
            except (ValueError, OverflowError):
                pass

        # If numeric extraction failed completely, pass raw_val through so type validator handles/reports it
        return NormalizationResult(
            original_value=raw_val,
            normalized_value=raw_val,
            is_null=False,
            warning=None,
            was_normalized=False,
        )

    @classmethod
    def _normalize_date(
        cls, raw_val: Any, val_str: str, spec: ImportColumnSpec
    ) -> NormalizationResult:
        # If the value is a bare integer/number like 29 or "29" or "45210" (Excel serial date integer check)
        # Requirement: If the field contains only a number such as 29, do NOT automatically interpret as a date.
        # Instead, leave it as NULL and add a warning: "Ambiguous date value '29' — treated as null"
        if re.match(r"^\d{1,4}$", val_str):
            # 1 to 4 digits like 29, 2026, 123
            warning_msg = f"Ambiguous date value '{val_str}' — treated as null."
            return NormalizationResult(
                original_value=raw_val,
                normalized_value=None,
                is_null=True,
                warning=warning_msg,
                was_normalized=True,
            )

        # Attempt to parse valid business date formats
        # Order of preference: DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD, DD-MM-YYYY, YYYY/MM/DD
        date_formats = (
            "%d/%m/%Y",
            "%m/%d/%Y",
            "%Y-%m-%d",
            "%d-%m-%Y",
            "%Y/%m/%d",
            "%d.%m.%Y",
            "%Y.%m.%d",
        )

        for fmt in date_formats:
            try:
                dt = datetime.strptime(val_str, fmt)
                d_val = dt.date()
                was_norm = val_str != d_val.strftime("%Y-%m-%d")
                return NormalizationResult(
                    original_value=raw_val,
                    normalized_value=d_val,
                    is_null=False,
                    warning=None,
                    was_normalized=was_norm,
                )
            except ValueError:
                continue

        # If unparseable date string (not a null proxy, e.g. "invalid-date-string")
        # Return as normalized_value = val_str so that validator reports exact format error
        return NormalizationResult(
            original_value=raw_val,
            normalized_value=val_str,
            is_null=False,
            warning=None,
            was_normalized=False,
        )

    @classmethod
    def _normalize_enum(cls, raw_val: Any, val_str: str) -> NormalizationResult:
        clean_enum = val_str.lower().strip().replace(" ", "_")
        was_norm = clean_enum != str(raw_val)
        return NormalizationResult(
            original_value=raw_val,
            normalized_value=clean_enum,
            is_null=False,
            warning=None,
            was_normalized=was_norm,
        )

    @classmethod
    def _normalize_string(cls, raw_val: Any, val_str: str) -> NormalizationResult:
        was_norm = val_str != str(raw_val)
        return NormalizationResult(
            original_value=raw_val,
            normalized_value=val_str,
            is_null=False,
            warning=None,
            was_normalized=was_norm,
        )
