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
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3")
OLLAMA_TIMEOUT = float(os.getenv("OLLAMA_TIMEOUT", "60.0"))


class OllamaMappingService:
    """
    RAG-powered LLM Service for semantic column mapping between Excel headers and database fields.
    Uses local Ollama without sending any row data.
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

    async def check_ollama_reachable(self, timeout: float = 2.0) -> bool:
        """
        Fast health check to verify whether Ollama local service is up and responding.
        """
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                res = await client.get(f"{self.ollama_url}/api/tags")
                return res.status_code == 200
        except Exception as e:
            logger.warning("Ollama health check failed at %s: %s", self.ollama_url, str(e))
            return False

    async def _get_available_model(self, client: httpx.AsyncClient) -> str:
        """
        Attempts to verify if self.model exists, or falls back to an available model installed in Ollama.
        """
        try:
            res = await client.get(f"{self.ollama_url}/api/tags")
            if res.status_code == 200:
                data = res.json()
                models = [m.get("name", "") for m in data.get("models", []) if m.get("name")]
                if not models:
                    return self.model
                # Direct match or prefix match
                for m in models:
                    if m == self.model or m.startswith(f"{self.model}:"):
                        return m
                # Fallback to first available model if self.model not found
                logger.info("Model '%s' not explicitly found in Ollama, using available model '%s'", self.model, models[0])
                return models[0]
        except Exception as e:
            logger.debug("Failed to query Ollama tags: %s", e)
        return self.model

    async def generate_mapping(
        self,
        template_context: TemplateContext,
        excel_headers: list[str],
    ) -> dict[str, Any]:
        """
        Executes RAG prompt on Ollama to map database fields to Excel headers.
        Returns:
        {
            "mapping": {
                "db_field_key": {
                    "excel": "Excel Header Name" | None,
                    "confidence": 0.95,
                    "source": "ollama_llm" | "mapping_memory" | "fuzzy_fallback"
                }
            },
            "prompt_used": str,
            "ollama_active": bool,
            "ollama_reachable": bool,
            "ollama_response_time_ms": float,
            "total_mapping_ms": float
        }
        """
        total_start = time.perf_counter()
        result_mapping: dict[str, Any] = {}

        # 1. Check Ollama reachability fast
        ollama_reachable = await self.check_ollama_reachable(timeout=2.0)
        ollama_active = False
        ollama_response_text = ""
        ollama_response_time_ms = 0.0

        # 2. Build RAG Prompt (only schema + field descriptions + Excel headers)
        prompt_text = self._build_rag_prompt(template_context, excel_headers)

        # 3. Attempt calling Ollama if reachable
        if ollama_reachable:
            ollama_start = time.perf_counter()
            try:
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    target_model = await self._get_available_model(client)
                    res = await client.post(
                        f"{self.ollama_url}/api/generate",
                        json={
                            "model": target_model,
                            "system": "You are an enterprise AI semantic column mapper. Output ONLY raw JSON matching the required target schema without markdown or conversational explanations.",
                            "prompt": prompt_text,
                            "stream": False,
                            "format": "json",
                            "options": {
                                "temperature": 0.1,
                                "num_predict": 512,
                            },
                            "keep_alive": "15m",
                        },
                    )
                    ollama_response_time_ms = round((time.perf_counter() - ollama_start) * 1000, 2)
                    if res.status_code == 200:
                        ollama_active = True
                        data = res.json()
                        ollama_response_text = data.get("response", "")
                        logger.info("Ollama AI mapping query succeeded in %.2f ms (Model: %s)", ollama_response_time_ms, target_model)
                    else:
                        logger.warning("Ollama returned HTTP %s in %.2f ms: %s", res.status_code, ollama_response_time_ms, res.text)
            except Exception as e:
                ollama_response_time_ms = round((time.perf_counter() - ollama_start) * 1000, 2)
                logger.warning("Ollama request failed after %.2f ms: %s. Using fallback matching engine.", ollama_response_time_ms, str(e))
        else:
            logger.warning("Ollama local service is not reachable at %s. Direct fallback matching will be used.", self.ollama_url)

        parsed_llm_mapping: dict[str, Any] = {}
        if ollama_active and ollama_response_text:
            parsed_llm_mapping = self._parse_json_from_llm(ollama_response_text)

        # 4. Synthesize final mapping combining Memory, Ollama RAG, and Fuzzy Fallback
        for field in template_context.fields:
            field_key = field.key

            # A. Check Memory
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
                continue

            # B. Check Ollama output
            if field_key in parsed_llm_mapping:
                llm_item = parsed_llm_mapping[field_key]
                excel_col = llm_item.get("excel")
                conf = float(llm_item.get("confidence", 0.90))

                # Verify excel_col actually exists in uploaded excel_headers
                matched_header = next((h for h in excel_headers if h.lower().strip() == str(excel_col).lower().strip()), None)
                if matched_header:
                    result_mapping[field_key] = {
                        "excel": matched_header,
                        "confidence": round(conf, 2),
                        "source": "ollama_llm",
                    }
                    continue

            # C. Fallback Fuzzy & Semantic Matching Algorithm
            fallback_match = self._fuzzy_fallback_match(field, excel_headers, used_headers=[v["excel"] for v in result_mapping.values() if v.get("excel")])
            result_mapping[field_key] = fallback_match

        total_mapping_ms = round((time.perf_counter() - total_start) * 1000, 2)
        logger.info(
            "Completed column mapping for template '%s' (%d fields, %d headers) in %.2f ms. Ollama Reachable: %s, Active: %s (Ollama Time: %.2f ms)",
            template_context.template_code,
            len(template_context.fields),
            len(excel_headers),
            total_mapping_ms,
            ollama_reachable,
            ollama_active,
            ollama_response_time_ms,
        )

        return {
            "mapping": result_mapping,
            "prompt_used": prompt_text,
            "ollama_active": ollama_active,
            "ollama_reachable": ollama_reachable,
            "ollama_response_time_ms": ollama_response_time_ms,
            "total_mapping_ms": total_mapping_ms,
            "model": self.model,
        }

    def _build_rag_prompt(self, template_context: TemplateContext, excel_headers: list[str]) -> str:
        fields_text = template_context.to_rag_context_text()
        headers_text = "\n".join([f"- {hdr}" for hdr in excel_headers])

        return f"""You are an enterprise CMF import assistant specializing in semantic column mapping.

{fields_text}

The uploaded Excel contains these column headers:
{headers_text}

Instructions:
Perform semantic matching between the available database target fields and the uploaded Excel columns based on header names, field labels, descriptions, and aliases.

Return ONLY a valid JSON object matching this exact format:
{{
    "field_key_1": {{
        "excel": "Matching Excel Column Name",
        "confidence": 0.98
    }},
    "field_key_2": {{
        "excel": "Matching Excel Column Name",
        "confidence": 0.95
    }}
}}

Rules:
1. Do not include markdown codeblocks outside JSON if possible. Return raw JSON.
2. Ensure confidence is a float between 0.00 and 1.00.
3. Map every database field to the best corresponding Excel column header. If no matching column exists, set "excel": null and "confidence": 0.0.
"""

    def _parse_json_from_llm(self, text: str) -> dict[str, Any]:
        clean_text = text.strip()
        # Remove ```json wrapper if present
        if "```" in clean_text:
            match = re.search(r"```(?:json)?\s*(\{[\s\S]*?\})\s*```", clean_text)
            if match:
                clean_text = match.group(1)

        try:
            return json.loads(clean_text)
        except Exception:
            # Try finding first { and last }
            start = clean_text.find("{")
            end = clean_text.rfind("}")
            if start != -1 and end != -1:
                try:
                    return json.loads(clean_text[start : end + 1])
                except Exception:
                    pass
            return {}

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
