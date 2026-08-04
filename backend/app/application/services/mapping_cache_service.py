from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)

# In-memory mapping cache (keyed by f"{template_code}:{excel_header_clean}")
_MAPPING_CACHE: dict[str, dict[str, Any]] = {}


class MappingCacheService:
    """
    Stores and retrieves cached header mappings to establish mapping memory across imports.
    Serves as an extensible service for future AI features (value normalization, confidence history).
    """

    @staticmethod
    def get_cached_field(template_code: str, excel_header: str) -> dict[str, Any] | None:
        key = f"{template_code.upper()}:{excel_header.strip().lower()}"
        return _MAPPING_CACHE.get(key)

    @staticmethod
    def save_mapping_memory(template_code: str, mapping: dict[str, str]) -> None:
        """
        Saves user confirmed mapping into mapping memory cache.
        mapping format: { db_field_key: excel_header_name } or { excel_header_name: db_field_key }
        """
        tmpl_code = template_code.upper()
        for k, v in mapping.items():
            if not k or not v:
                continue
            # Store bidirectional cache key
            cache_key = f"{tmpl_code}:{v.strip().lower()}"
            _MAPPING_CACHE[cache_key] = {
                "target_field": k,
                "excel_header": v,
                "confidence": 0.99,
                "source": "mapping_memory",
            }
            logger.info("Saved mapping memory for %s -> %s", cache_key, k)

    @staticmethod
    def get_all_cached_mappings(template_code: str) -> dict[str, str]:
        tmpl_prefix = f"{template_code.upper()}:"
        res: dict[str, str] = {}
        for k, item in _MAPPING_CACHE.items():
            if k.startswith(tmpl_prefix):
                res[item["excel_header"]] = item["target_field"]
        return res
