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

logger = logging.getLogger(__name__)

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2:1b")
OLLAMA_TIMEOUT = float(os.getenv("OLLAMA_TIMEOUT", "30.0"))


def _build_ollama_timeout(timeout_seconds: float) -> httpx.Timeout:
    """
    Build an httpx.Timeout with configured read timeout for Ollama LLM generation.
    """
    return httpx.Timeout(
        connect=5.0,
        read=timeout_seconds,
        write=15.0,
        pool=5.0,
    )


class OllamaMappingService:
    """
    High-performance LLM Service for semantic column mapping using llama3.2:1b by default.
    Reads ONLY Excel column headers (zero row data sent to LLM).
    Makes a SINGLE request to Ollama with minimal tokens (<150 completion tokens).
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

    async def check_ollama_reachable(self, timeout: float = 2.0) -> bool:
        """
        Fast health check to verify whether local Ollama service is up.
        """
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                res = await client.get(f"{self.ollama_url}/api/tags")
                return res.status_code == 200
        except Exception as e:
            logger.warning("[OLLAMA] Health check failed at %s: %s", self.ollama_url, str(e))
            return False

    async def _get_available_model(self, client: httpx.AsyncClient) -> str:
        """
        Prefers llama3.2:1b or explicitly configured self.model over llama3:latest.
        """
        try:
            res = await client.get(f"{self.ollama_url}/api/tags")
            if res.status_code == 200:
                data = res.json()
                models = [m.get("name", "") for m in data.get("models", []) if m.get("name")]
                if not models:
                    return self.model

                # 1. Direct match on configured model
                for m in models:
                    if m == self.model or m.startswith(f"{self.model}:"):
                        return m

                # 2. Try any llama3.2:1b variant
                for m in models:
                    if "llama3.2:1b" in m or "llama3.2-1b" in m:
                        return m

                # 3. Try any llama3.2 variant
                for m in models:
                    if "llama3.2" in m:
                        return m

                # 4. Return first available model if self.model not found
                logger.info("[OLLAMA] Model '%s' not explicitly found, using installed model '%s'", self.model, models[0])
                return models[0]
        except Exception as e:
            logger.debug("[OLLAMA] Failed to query Ollama tags: %s", e)
        return self.model

    async def generate_mapping(
        self,
        template_context: TemplateContext,
        excel_headers: list[str],
        excel_read_ms: float = 0.0,
    ) -> dict[str, Any]:
        total_start = time.perf_counter()
        result_mapping: dict[str, Any] = {}

        # 1. Debug input statistics
        logger.info("[OLLAMA MAP] Template: '%s' (%s), Fields: %d, Headers: %d",
                    template_context.template_code, template_context.template_name,
                    len(template_context.fields), len(excel_headers))
        logger.debug("[OLLAMA MAP] Fields sent to Ollama: %r",
                     [f.key for f in template_context.fields])
        logger.debug("[OLLAMA MAP] Excel headers passed in: %r", excel_headers)

        # 2. Measure Prompt Build Time & Size
        prompt_build_start = time.perf_counter()
        prompt_text = self._build_rag_prompt(template_context, excel_headers)
        prompt_build_ms = round((time.perf_counter() - prompt_build_start) * 1000, 2)
        prompt_size = len(prompt_text)

        # 3. Check Ollama reachability fast
        ollama_reachable = await self.check_ollama_reachable(timeout=2.0)
        ollama_active = False
        fallback_reason: str | None = None
        ollama_response_text = ""
        ollama_response_time_ms = 0.0
        target_model = self.model
        prompt_tokens = 0
        completion_tokens = 0
        inference_time_ms = 0.0

        # 4. Single Ollama Call (if reachable)
        if not ollama_reachable:
            fallback_reason = f"Ollama local service is not reachable at {self.ollama_url}. Switched to deterministic fuzzy mapping."
            logger.warning("[OLLAMA MAP] %s", fallback_reason)
        else:
            ollama_start = time.perf_counter()
            try:
                async with httpx.AsyncClient(timeout=_build_ollama_timeout(self.timeout)) as client:
                    target_model = await self._get_available_model(client)
                    res = await client.post(
                        f"{self.ollama_url}/api/generate",
                        json={
                            "model": target_model,
                            "system": "Return ONLY valid JSON. No markdown. No explanations. No reasoning. No examples. No comments.",
                            "prompt": prompt_text,
                            "stream": False,
                            "format": "json",
                            "options": {
                                "temperature": 0.0,
                                "top_p": 0.1,
                                "num_predict": 150,
                            },
                            "keep_alive": "15m",
                        },
                    )
                    ollama_response_time_ms = round((time.perf_counter() - ollama_start) * 1000, 2)
                    if res.status_code == 200:
                        data = res.json()
                        ollama_response_text = data.get("response", "")
                        prompt_tokens = data.get("prompt_eval_count", 0)
                        completion_tokens = data.get("eval_count", 0)
                        eval_duration_ns = data.get("eval_duration", 0)
                        if eval_duration_ns > 0:
                            inference_time_ms = round(eval_duration_ns / 1_000_000, 2)
                        else:
                            inference_time_ms = ollama_response_time_ms
                        logger.info("[OLLAMA MAP] LLM Raw Response: %r", ollama_response_text[:500])
                    else:
                        fallback_reason = f"Ollama returned HTTP status {res.status_code}: {res.text[:200]}"
                        logger.warning("[OLLAMA MAP] %s", fallback_reason)
            except httpx.TimeoutException:
                ollama_response_time_ms = round((time.perf_counter() - ollama_start) * 1000, 2)
                fallback_reason = f"Request to Ollama timed out after {self.timeout}s. Automatically switched to deterministic fuzzy mapping."
                logger.warning("[OLLAMA MAP] %s", fallback_reason)
            except Exception as e:
                ollama_response_time_ms = round((time.perf_counter() - ollama_start) * 1000, 2)
                fallback_reason = f"Ollama connection error: {e}. Switched to deterministic fuzzy mapping."
                logger.warning("[OLLAMA MAP] %s", fallback_reason)

        # 5. Measure JSON Parsing Time
        json_parse_start = time.perf_counter()
        parsed_llm_mapping: dict[str, Any] = {}
        if ollama_response_text:
            field_keys = {f.key for f in template_context.fields}
            parsed_llm_mapping = self._parse_json_from_llm(ollama_response_text, field_keys, set(excel_headers))
            if not parsed_llm_mapping and not fallback_reason:
                fallback_reason = "Ollama model returned an unparseable JSON format. Switched to deterministic fuzzy mapping."
        json_parse_ms = round((time.perf_counter() - json_parse_start) * 1000, 2)
        logger.debug("[OLLAMA MAP] JSON Parsed Result: %r", parsed_llm_mapping)

        # 6. Synthesize Final Mapping (Memory -> Single Ollama LLM -> Fuzzy Fallback)
        llm_mapped_count = 0
        conf_scores: dict[str, float] = {}

        for field in template_context.fields:
            field_key = field.key

            # A. Mapping Memory
            cached = None
            for hdr in excel_headers:
                mem = MappingCacheService.get_cached_field(template_context.template_code, hdr)
                if mem and mem.get("target_field") == field_key:
                    cached = {
                        "excel": hdr,
                        "confidence": 0.99,
                        "source": "mapping_memory",
                    }
                    break

            if cached:
                result_mapping[field_key] = cached
                conf_scores[field_key] = 0.99
                continue

            # B. Ollama LLM Match
            if field_key in parsed_llm_mapping:
                llm_item = parsed_llm_mapping[field_key]
                excel_col = llm_item.get("excel")
                conf = float(llm_item.get("confidence", 0.95))

                if excel_col:
                    matched_header = next((h for h in excel_headers if h.lower().strip() == str(excel_col).lower().strip()), None)
                    if matched_header:
                        result_mapping[field_key] = {
                            "excel": matched_header,
                            "confidence": round(conf, 2),
                            "source": "ollama_llm",
                        }
                        conf_scores[field_key] = round(conf, 2)
                        llm_mapped_count += 1
                        continue

            # C. Deterministic Fuzzy Fallback
            fallback_match = self._fuzzy_fallback_match(
                field,
                excel_headers,
                used_headers=[v["excel"] for v in result_mapping.values() if v.get("excel")],
            )
            result_mapping[field_key] = fallback_match
            conf_scores[field_key] = fallback_match.get("confidence", 0.0)

        if llm_mapped_count > 0:
            ollama_active = True
            fallback_reason = None
        else:
            ollama_active = False
            if not fallback_reason:
                fallback_reason = "Ollama returned no valid field matches. Switched to deterministic fuzzy mapping."

        total_mapping_ms = round((time.perf_counter() - total_start) * 1000, 2)

        # Log final mapping
        logger.info(
            "[OLLAMA MAP] Final Mapping Summary (%d/%d fields mapped via LLM):\n%s",
            llm_mapped_count,
            len(template_context.fields),
            "\n".join(
                f"  {fk}: excel='{v.get('excel')}' conf={v.get('confidence')} src={v.get('source')}"
                for fk, v in result_mapping.items()
            ),
        )

        # 7. Log required metrics: Prompt size, Prompt tokens, Completion tokens, Inference time, JSON parse time
        logger.info(
            "\n==================== [OLLAMA LLM METRICS] ====================\n"
            "  - Model:             %s\n"
            "  - Prompt Size:       %d chars\n"
            "  - Prompt Tokens:     %d\n"
            "  - Completion Tokens: %d\n"
            "  - Inference Time:    %.2f ms\n"
            "  - JSON Parse Time:   %.2f ms\n"
            "  - Excel Read Time:   %.2f ms\n"
            "  - Total Mapping:     %.2f ms\n"
            "  - LLM Mapped Fields: %d/%d (Active: %s)\n"
            "==============================================================",
            target_model,
            prompt_size,
            prompt_tokens,
            completion_tokens,
            inference_time_ms if inference_time_ms > 0 else ollama_response_time_ms,
            json_parse_ms,
            excel_read_ms,
            total_mapping_ms,
            llm_mapped_count,
            len(template_context.fields),
            ollama_active,
        )

        return {
            "mapping": result_mapping,
            "prompt_used": prompt_text,
            "ollama_active": ollama_active,
            "ollama_reachable": ollama_reachable,
            "execution_times": {
                "excel_read_ms": excel_read_ms,
                "prompt_build_ms": prompt_build_ms,
                "ollama_response_time_ms": ollama_response_time_ms,
                "json_parse_ms": json_parse_ms,
                "total_mapping_ms": total_mapping_ms,
                "inference_time_ms": inference_time_ms,
            },
            "metrics": {
                "prompt_size_chars": prompt_size,
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens,
                "inference_time_ms": inference_time_ms,
                "json_parse_ms": json_parse_ms,
            },
            "model": target_model,
            "fallback_reason": fallback_reason,
        }

    def _build_rag_prompt(self, template_context: TemplateContext, excel_headers: list[str]) -> str:
        """
        Build ultra-compact prompt containing ONLY Excel headers, template fields, and optional descriptions.
        """
        field_specs = []
        for f in template_context.fields:
            desc_part = f" ({f.description})" if f.description else ""
            field_specs.append(f"- key: {f.key}{desc_part}")

        fields_str = "\n".join(field_specs)
        headers_str = "\n".join([f'- "{h}"' for h in excel_headers])

        return f"""Target database fields:
{fields_str}

Uploaded Excel headers:
{headers_str}

Return ONLY a valid raw JSON object mapping Excel headers to matching target field keys.
No markdown. No explanations. No reasoning. No examples. No comments.
Example format:
{{"Supplier Name": "supplier_name", "Weekly Capacity": "weekly_capacity"}}
"""

    def _parse_json_from_llm(
        self, text: str, field_keys: set[str] | None = None, excel_headers: set[str] | None = None
    ) -> dict[str, Any]:
        clean_text = text.strip()
        if "```" in clean_text:
            match = re.search(r"```(?:json)?\s*(\{[\s\S]*?\})\s*```", clean_text)
            if match:
                clean_text = match.group(1)

        parsed: Any = None
        try:
            parsed = json.loads(clean_text)
        except Exception:
            start = clean_text.find("{")
            end = clean_text.rfind("}")
            if start != -1 and end != -1:
                try:
                    parsed = json.loads(clean_text[start : end + 1])
                except Exception:
                    pass

        if not isinstance(parsed, dict):
            return {}

        # Unwrap top-level wrapper objects if LLM wrapped output (e.g. {"mapping": {...}})
        for wrapper_key in ["mapping", "mappings", "result", "columns", "column_mapping", "matches", "data"]:
            if wrapper_key in parsed and isinstance(parsed[wrapper_key], dict):
                parsed = parsed[wrapper_key]
                break

        keys_lower = {k.lower(): k for k in (field_keys or set())}
        headers_lower = {h.lower(): h for h in (excel_headers or set())}

        normalized: dict[str, Any] = {}
        for k, v in parsed.items():
            str_k = str(k).strip()
            if isinstance(v, dict):
                excel_col = v.get("excel") or v.get("column") or v.get("header") or v.get("matched_column")
                conf = v.get("confidence") or v.get("score") or 0.95
                field_key = v.get("field") or v.get("key") or str_k
                normalized[str(field_key)] = {
                    "excel": str(excel_col) if excel_col is not None else None,
                    "confidence": float(conf),
                }
            elif isinstance(v, str):
                str_v = str(v).strip()

                # Check direction: {"Excel Header": "target_field_key"} vs {"target_field_key": "Excel Header"}
                k_lower = str_k.lower()
                v_lower = str_v.lower()

                if keys_lower and v_lower in keys_lower:
                    # Format: {"Excel Header": "target_field_key"}
                    fk = keys_lower[v_lower]
                    matched_hdr = headers_lower.get(k_lower, str_k)
                    normalized[fk] = {"excel": matched_hdr, "confidence": 0.95}
                elif keys_lower and k_lower in keys_lower:
                    # Format: {"target_field_key": "Excel Header"}
                    fk = keys_lower[k_lower]
                    matched_hdr = headers_lower.get(v_lower, str_v)
                    normalized[fk] = {"excel": matched_hdr, "confidence": 0.95}
                else:
                    # Fallback key-value
                    normalized[str_k] = {"excel": str_v, "confidence": 0.95}
            elif v is None:
                normalized[str_k] = {"excel": None, "confidence": 0.0}

        return normalized

    def _fuzzy_fallback_match(
        self, field: TemplateFieldSpec, headers: list[str], used_headers: list[str]
    ) -> dict[str, Any]:
        clean_key = field.key.lower().strip().replace("_", " ")
        clean_label = field.label.lower().strip().replace("_", " ")
        aliases = [a.lower().strip() for a in field.aliases]

        best_header = None
        best_conf = 0.0

        for hdr in headers:
            if hdr in used_headers:
                continue

            clean_hdr = hdr.lower().strip().replace("_", " ")

            # Exact match on key or label
            if clean_hdr == clean_key or clean_hdr == clean_label:
                return {"excel": hdr, "confidence": 0.99, "source": "exact_match"}

            # Alias match
            if clean_hdr in aliases:
                return {"excel": hdr, "confidence": 0.96, "source": "alias_match"}

            # Substring match (min 3 chars to avoid false positives on short words)
            if len(clean_hdr) >= 3 and len(clean_key) >= 3:
                if clean_key in clean_hdr or clean_hdr in clean_key or (clean_label and len(clean_label) >= 3 and (clean_label in clean_hdr or clean_hdr in clean_label)):
                    score = 0.85
                    if score > best_conf:
                        best_conf = score
                        best_header = hdr

        if best_header:
            return {"excel": best_header, "confidence": best_conf, "source": "fuzzy_fallback"}

        return {"excel": None, "confidence": 0.0, "source": "none"}


