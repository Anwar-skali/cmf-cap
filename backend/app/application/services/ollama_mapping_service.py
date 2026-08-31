from __future__ import annotations

import json
import logging
import os
import re
import time
from typing import Any
import httpx

from app.application.services.template_context_service import TemplateContext, TemplateFieldSpec
from app.application.services.mapping_cache_service import MappingCacheService
from app.application.services.header_normalizer import normalize_header, compute_similarity, strip_module_prefix

logger = logging.getLogger(__name__)

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2:1b")
OLLAMA_TIMEOUT = float(os.getenv("OLLAMA_TIMEOUT", "5.0"))


def _build_ollama_timeout(timeout_seconds: float) -> httpx.Timeout:
    return httpx.Timeout(
        connect=2.0,
        read=timeout_seconds,
        write=5.0,
        pool=2.0,
    )


class OllamaMappingService:
    """
    Optimized Column Mapping Service:
    1. Level 0: Structure-specific Mapping Cache
    2. Level 1: Exact Normalized Match
    3. Level 2: Known Aliases Match
    4. Level 3: Fuzzy Match (threshold >= 0.90 auto-mapped, 0.75-0.89 ambiguous)
    5. Level 4: AI Fallback (ONLY for unresolved/ambiguous columns, 5s timeout, validated output)
    """

    def __init__(
        self,
        ollama_url: str = OLLAMA_BASE_URL,
        model: str = OLLAMA_MODEL,
        timeout: float = OLLAMA_TIMEOUT,
    ) -> None:
        self.ollama_url = ollama_url.rstrip("/")
        self.model = model
        self.timeout = timeout
        logger.info("[OLLAMA] Configured timeout: %.1fs, default model: %s, url: %s", timeout, model, self.ollama_url)

    async def check_ollama_reachable(self, timeout: float = 1.5) -> bool:
        """
        Fast health check to verify whether local Ollama service is up.
        """
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                res = await client.get(f"{self.ollama_url}/api/tags")
                return res.status_code == 200
        except Exception as e:
            logger.debug("[OLLAMA] Health check failed at %s: %s", self.ollama_url, str(e))
            return False

    async def _get_available_model(self, client: httpx.AsyncClient) -> str:
        try:
            res = await client.get(f"{self.ollama_url}/api/tags")
            if res.status_code == 200:
                data = res.json()
                models = [m.get("name", "") for m in data.get("models", []) if m.get("name")]
                if not models:
                    return self.model

                for m in models:
                    if m == self.model or m.startswith(f"{self.model}:"):
                        return m

                for m in models:
                    if "llama3.2:1b" in m or "llama3.2-1b" in m or "llama3.2" in m:
                        return m

                return models[0]
        except Exception:
            pass
        return self.model

    async def generate_mapping(
        self,
        template_context: TemplateContext,
        excel_headers: list[str],
        excel_read_ms: float = 0.0,
    ) -> dict[str, Any]:
        total_start = time.perf_counter()
        result_mapping: dict[str, Any] = {}
        used_headers: set[str] = set()
        mapped_field_keys: set[str] = set()

        stats = {
            "exact": 0,
            "alias": 0,
            "fuzzy": 0,
            "cache": 0,
            "ai": 0,
            "unresolved": 0,
        }

        # ─── LEVEL 0: Structure-Specific Mapping Cache ────────────────────────
        for field in template_context.fields:
            if field.key in mapped_field_keys:
                continue
            for hdr in excel_headers:
                if hdr in used_headers:
                    continue
                mem = MappingCacheService.get_cached_field(template_context.template_code, hdr)
                if mem and mem.get("target_field") == field.key:
                    result_mapping[field.key] = {
                        "excel": hdr,
                        "confidence": 0.99,
                        "source": "mapping_memory",
                    }
                    used_headers.add(hdr)
                    mapped_field_keys.add(field.key)
                    stats["cache"] += 1
                    break

        # ─── LEVEL 1: Exact Normalized Match ─────────────────────────────────
        for field in template_context.fields:
            if field.key in mapped_field_keys:
                continue
            norm_key = normalize_header(field.key)
            norm_label = normalize_header(field.label)

            for hdr in excel_headers:
                if hdr in used_headers:
                    continue
                norm_hdr = normalize_header(hdr)
                if not norm_hdr:
                    continue

                stripped_hdr = strip_module_prefix(norm_hdr)
                if norm_hdr == norm_key or norm_hdr == norm_label or (stripped_hdr and (stripped_hdr == norm_key or stripped_hdr == norm_label)):
                    result_mapping[field.key] = {
                        "excel": hdr,
                        "confidence": 1.0,
                        "source": "exact_match",
                    }
                    used_headers.add(hdr)
                    mapped_field_keys.add(field.key)
                    stats["exact"] += 1
                    break

        # ─── LEVEL 2: Known Aliases Match ─────────────────────────────────────
        for field in template_context.fields:
            if field.key in mapped_field_keys:
                continue
            norm_aliases = {normalize_header(a) for a in field.aliases if a}

            for hdr in excel_headers:
                if hdr in used_headers:
                    continue
                norm_hdr = normalize_header(hdr)
                if not norm_hdr:
                    continue

                stripped_hdr = strip_module_prefix(norm_hdr)
                if norm_hdr in norm_aliases or (stripped_hdr and stripped_hdr in norm_aliases):
                    result_mapping[field.key] = {
                        "excel": hdr,
                        "confidence": 0.96,
                        "source": "alias_match",
                    }
                    used_headers.add(hdr)
                    mapped_field_keys.add(field.key)
                    stats["alias"] += 1
                    break

        # ─── LEVEL 3: Fuzzy Match ─────────────────────────────────────────────
        # Conf >= 0.90 -> Auto-mapped
        # 0.75 <= Conf < 0.90 -> Ambiguous candidate
        ambiguous_candidates: dict[str, tuple[str, float]] = {}  # field_key -> (header, score)

        for field in template_context.fields:
            if field.key in mapped_field_keys:
                continue

            norm_key = normalize_header(field.key)
            norm_label = normalize_header(field.label)
            norm_aliases = [normalize_header(a) for a in field.aliases if a]

            best_hdr = None
            best_score = 0.0

            for hdr in excel_headers:
                if hdr in used_headers:
                    continue
                norm_hdr = normalize_header(hdr)
                if not norm_hdr:
                    continue

                # Compute similarity against key, label, aliases
                score_k = compute_similarity(norm_hdr, norm_key)
                score_l = compute_similarity(norm_hdr, norm_label)
                score_a = max([compute_similarity(norm_hdr, a) for a in norm_aliases], default=0.0)
                max_score = max(score_k, score_l, score_a)

                if max_score > best_score:
                    best_score = max_score
                    best_hdr = hdr

            if best_hdr and best_score >= 0.90:
                result_mapping[field.key] = {
                    "excel": best_hdr,
                    "confidence": round(best_score, 2),
                    "source": "fuzzy_match",
                }
                used_headers.add(best_hdr)
                mapped_field_keys.add(field.key)
                stats["fuzzy"] += 1
            elif best_hdr and best_score >= 0.75:
                ambiguous_candidates[field.key] = (best_hdr, round(best_score, 2))

        # ─── LEVEL 4: AI Fallback (ONLY for unresolved/ambiguous columns) ─────
        unresolved_headers = [h for h in excel_headers if h not in used_headers]
        unmapped_fields = [f for f in template_context.fields if f.key not in mapped_field_keys]

        ollama_active = False
        ollama_reachable = False
        fallback_reason: str | None = None
        ai_duration_ms = 0.0
        ai_response_text = ""
        prompt_tokens = 0
        completion_tokens = 0
        target_model = self.model

        if not unresolved_headers or not unmapped_fields:
            # 0 AI calls needed: all columns/fields deterministically resolved
            fallback_reason = "Columns mapped automatically."
            logger.info("[IMPORT] 0 columns unresolved. Skipping AI mapping entirely.")
        else:
            # AI Fallback path
            stats["unresolved"] = len(unresolved_headers)
            logger.info(
                "[IMPORT] %d unresolved header(s) and %d unmapped field(s). Invoking AI fallback...",
                len(unresolved_headers),
                len(unmapped_fields),
            )

            ollama_reachable = await self.check_ollama_reachable(timeout=1.5)
            if not ollama_reachable:
                fallback_reason = "AI mapping unavailable — deterministic mapping used."
                logger.warning("[OLLAMA] Offline / unreachable. Using deterministic fallback.")
            else:
                ai_start = time.perf_counter()
                prompt_text = self._build_minimal_ai_prompt(unmapped_fields, unresolved_headers)
                try:
                    async with httpx.AsyncClient(timeout=_build_ollama_timeout(self.timeout)) as client:
                        target_model = await self._get_available_model(client)
                        res = await client.post(
                            f"{self.ollama_url}/api/generate",
                            json={
                                "model": target_model,
                                "system": "Return ONLY valid JSON mapping unresolved Excel headers to available field keys. No explanation.",
                                "prompt": prompt_text,
                                "stream": False,
                                "format": "json",
                                "options": {
                                    "temperature": 0.0,
                                    "top_p": 0.1,
                                    "num_predict": 120,
                                },
                            },
                        )
                        ai_duration_ms = round((time.perf_counter() - ai_start) * 1000, 2)
                        if res.status_code == 200:
                            data = res.json()
                            ai_response_text = data.get("response", "")
                            prompt_tokens = data.get("prompt_eval_count", 0)
                            completion_tokens = data.get("eval_count", 0)
                            logger.info("[OLLAMA] AI response received in %.1fms: %s", ai_duration_ms, ai_response_text[:300])
                        else:
                            fallback_reason = "AI mapping unavailable — deterministic mapping used."
                except httpx.TimeoutException:
                    ai_duration_ms = round((time.perf_counter() - ai_start) * 1000, 2)
                    fallback_reason = "AI mapping unavailable — deterministic mapping used."
                    logger.warning("[OLLAMA] Timed out after %.1fs. Using deterministic fallback.", self.timeout)
                except Exception as e:
                    ai_duration_ms = round((time.perf_counter() - ai_start) * 1000, 2)
                    fallback_reason = "AI mapping unavailable — deterministic mapping used."
                    logger.warning("[OLLAMA] Call failed: %s. Using deterministic fallback.", e)

                # Validate and apply AI output
                if ai_response_text:
                    valid_ai_mappings = self._validate_ai_mappings(
                        ai_response_text,
                        unmapped_fields,
                        unresolved_headers,
                    )
                    for field_key, matched_hdr in valid_ai_mappings.items():
                        if field_key not in mapped_field_keys and matched_hdr not in used_headers:
                            result_mapping[field_key] = {
                                "excel": matched_hdr,
                                "confidence": 0.95,
                                "source": "ollama_ai",
                            }
                            used_headers.add(matched_hdr)
                            mapped_field_keys.add(field_key)
                            stats["ai"] += 1
                            ollama_active = True

        # ─── Post-AI fallback for any remaining ambiguous fields ──────────────
        for field in template_context.fields:
            if field.key not in result_mapping or not result_mapping[field.key].get("excel"):
                if field.key in ambiguous_candidates:
                    cand_hdr, cand_score = ambiguous_candidates[field.key]
                    if cand_hdr not in used_headers:
                        result_mapping[field.key] = {
                            "excel": cand_hdr,
                            "confidence": cand_score,
                            "source": "fuzzy_fallback",
                        }
                        used_headers.add(cand_hdr)
                        mapped_field_keys.add(field.key)
                        continue

                result_mapping[field.key] = {
                    "excel": None,
                    "confidence": 0.0,
                    "source": "none",
                }

        total_mapping_ms = round((time.perf_counter() - total_start) * 1000, 2)

        # Performance measurement logs
        logger.info(
            "[IMPORT] Workbook parsed: %.1fms\n"
            "[IMPORT] Headers detected: %d\n"
            "[IMPORT] Exact mappings: %d\n"
            "[IMPORT] Alias mappings: %d\n"
            "[IMPORT] Fuzzy mappings: %d\n"
            "[IMPORT] Cache mappings: %d\n"
            "[IMPORT] Unresolved: %d\n"
            "[IMPORT] AI invoked: %d column(s)\n"
            "[IMPORT] AI duration: %.1fms\n"
            "[IMPORT] Total: %.1fms",
            excel_read_ms,
            len(excel_headers),
            stats["exact"],
            stats["alias"],
            stats["fuzzy"],
            stats["cache"],
            stats["unresolved"],
            stats["ai"],
            ai_duration_ms,
            total_mapping_ms,
        )

        return {
            "mapping": result_mapping,
            "ollama_active": ollama_active,
            "ollama_reachable": ollama_reachable,
            "model": target_model,
            "fallback_reason": fallback_reason,
            "stats": {
                "headers_detected": len(excel_headers),
                "exact_mappings": stats["exact"],
                "alias_mappings": stats["alias"],
                "fuzzy_mappings": stats["fuzzy"],
                "cache_mappings": stats["cache"],
                "ai_mappings": stats["ai"],
                "unresolved_columns": stats["unresolved"],
            },
            "execution_times": {
                "excel_read_ms": excel_read_ms,
                "ai_duration_ms": ai_duration_ms,
                "total_mapping_ms": total_mapping_ms,
            },
            "metrics": {
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens,
                "ai_duration_ms": ai_duration_ms,
            },
        }

    def _build_minimal_ai_prompt(
        self,
        unmapped_fields: list[TemplateFieldSpec],
        unresolved_headers: list[str],
    ) -> str:
        """
        Builds minimal payload containing ONLY unresolved headers and unmapped fields.
        """
        field_lines = [
            f"- key: '{f.key}' (label: '{f.label}'{f', desc: {f.description}' if f.description else ''})"
            for f in unmapped_fields
        ]
        header_lines = [f'- "{h}"' for h in unresolved_headers]

        return (
            "Match each unresolved Excel header to the best available database field key.\n"
            "Available fields:\n"
            + "\n".join(field_lines)
            + "\n\nUnresolved Excel headers:\n"
            + "\n".join(header_lines)
            + '\n\nReturn JSON ONLY. Format: {"Excel Header Name": "field_key"}'
        )

    def _validate_ai_mappings(
        self,
        ai_raw_json: str,
        unmapped_fields: list[TemplateFieldSpec],
        unresolved_headers: list[str],
    ) -> dict[str, str]:
        """
        Validates AI output strictly:
        - Valid JSON syntax
        - Source column must exist in unresolved_headers
        - Target field key must exist in unmapped_fields
        - No duplicate target assignments
        Returns: { field_key: excel_header }
        """
        clean_text = ai_raw_json.strip()
        if "```" in clean_text:
            match = re.search(r"```(?:json)?\s*(\{[\s\S]*?\})\s*```", clean_text)
            if match:
                clean_text = match.group(1)

        try:
            parsed = json.loads(clean_text)
        except Exception:
            start = clean_text.find("{")
            end = clean_text.rfind("}")
            if start != -1 and end != -1:
                try:
                    parsed = json.loads(clean_text[start : end + 1])
                except Exception:
                    return {}
            else:
                return {}

        if not isinstance(parsed, dict):
            return {}

        # Unwrap wrappers if present
        for wrapper in ["mapping", "mappings", "result", "columns", "matches"]:
            if wrapper in parsed and isinstance(parsed[wrapper], dict):
                parsed = parsed[wrapper]
                break

        valid_fields = {f.key: f for f in unmapped_fields}
        valid_fields_lower = {f.key.lower(): f.key for f in unmapped_fields}
        valid_headers_lower = {normalize_header(h): h for h in unresolved_headers}

        valid_mappings: dict[str, str] = {}
        used_targets: set[str] = set()

        for k, v in parsed.items():
            if not k or not v:
                continue

            str_k = str(k).strip()
            str_v = str(v).strip()

            # Direction 1: {"Excel Header": "field_key"}
            norm_k = normalize_header(str_k)
            if norm_k in valid_headers_lower and str_v.lower() in valid_fields_lower:
                fk = valid_fields_lower[str_v.lower()]
                orig_h = valid_headers_lower[norm_k]
                if fk not in used_targets:
                    valid_mappings[fk] = orig_h
                    used_targets.add(fk)
                continue

            # Direction 2: {"field_key": "Excel Header"}
            norm_v = normalize_header(str_v)
            if str_k.lower() in valid_fields_lower and norm_v in valid_headers_lower:
                fk = valid_fields_lower[str_k.lower()]
                orig_h = valid_headers_lower[norm_v]
                if fk not in used_targets:
                    valid_mappings[fk] = orig_h
                    used_targets.add(fk)
                continue

        logger.info("[OLLAMA VALIDATION] Filtered %d valid mappings from AI raw response.", len(valid_mappings))
        return valid_mappings
