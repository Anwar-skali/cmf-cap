from __future__ import annotations

import logging
from typing import Any
from app.application.services.header_normalizer import normalize_header

logger = logging.getLogger(__name__)

# Structure-specific in-memory mapping cache (keyed by f"{template_code}:{normalized_header}")
_MAPPING_CACHE: dict[str, dict[str, Any]] = {}


class MappingCacheService:
    """
    Stores and retrieves cached header mappings to establish structure-specific mapping memory across imports.
    """

    @staticmethod
    def get_cached_field(template_code: str, excel_header: str) -> dict[str, Any] | None:
        norm = normalize_header(excel_header)
        key = f"{template_code.strip().upper()}:{norm}"
        return _MAPPING_CACHE.get(key)

    @staticmethod
    def save_mapping_memory(template_code: str, mapping: dict[str, str]) -> None:
        """
        Saves user confirmed mapping into mapping memory cache.
        mapping format: { db_field_key: excel_header_name } or { excel_header_name: db_field_key }
        """
        tmpl_code = template_code.strip().upper()
        for k, v in mapping.items():
            if not k or not v or str(v) == "__ignore__":
                continue
            norm_v = normalize_header(v)
            cache_key = f"{tmpl_code}:{norm_v}"
            _MAPPING_CACHE[cache_key] = {
                "target_field": k,
                "excel_header": v,
                "confidence": 0.99,
                "source": "mapping_memory",
            }
            logger.info("[MAPPING CACHE] Saved mapping memory for %s -> %s", cache_key, k)

    @staticmethod
    def get_all_cached_mappings(template_code: str) -> dict[str, str]:
        tmpl_prefix = f"{template_code.strip().upper()}:"
        res: dict[str, str] = {}
        for k, item in _MAPPING_CACHE.items():
            if k.startswith(tmpl_prefix):
                res[item["excel_header"]] = item["target_field"]
        return res

    @staticmethod
    def clear_cache(template_code: str | None = None) -> None:
        """Clears memory cache for a given template_code or all templates."""
        global _MAPPING_CACHE
        if template_code is None:
            _MAPPING_CACHE.clear()
        else:
            tmpl_prefix = f"{template_code.strip().upper()}:"
            _MAPPING_CACHE = {k: v for k, v in _MAPPING_CACHE.items() if not k.startswith(tmpl_prefix)}
