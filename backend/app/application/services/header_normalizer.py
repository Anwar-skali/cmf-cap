from __future__ import annotations

import difflib
import re
import unicodedata
from typing import Any


def normalize_header(header: str | None) -> str:
    """
    Central header normalization function.
    Handles:
    - None / empty input
    - Lowercasing and trimming
    - Accents and diacritics stripping (NFKD)
    - Replacing hyphens, underscores, slashes, punctuation, parentheses with spaces
    - Collapsing repeated whitespace
    - Preserves meaningful numbers (e.g. 'Weekly Capacity (parts/week)12' -> 'weekly capacity parts week 12')
    """
    if header is None:
        return ""
    
    text = str(header).strip()
    if not text:
        return ""

    # 1. Normalize unicode diacritics / accents: e.g. "Numéro" -> "Numero"
    nfkd = unicodedata.normalize("NFKD", text)
    ascii_text = "".join(c for c in nfkd if not unicodedata.combining(c))

    # 2. Lowercase
    lowered = ascii_text.lower()

    # 3. Replace all non-alphanumeric characters (including underscores, hyphens, punctuation) with a space
    cleaned = re.sub(r"[^a-z0-9]+", " ", lowered)

    # 4. Collapse multiple spaces and strip
    normalized = re.sub(r"\s+", " ", cleaned).strip()

    return normalized


def _canonicalize_tokens(norm: str) -> str:
    """
    Normalizes common automotive CMF word variations and abbreviations:
    - 'forecasted', 'forecasting' -> 'forecast'
    - 'eval', 'evaluation' -> 'evaluation'
    - 'mgr' -> 'manager'
    - 'no', 'num', 'n' -> 'number'
    """
    if not norm:
        return ""
    words = norm.split()
    mapped = []
    synonyms = {
        "forecasted": "forecast",
        "forecasting": "forecast",
        "eval": "evaluation",
        "evaluations": "evaluation",
        "mgr": "manager",
        "no": "number",
        "num": "number",
        "n": "number",
        "standard": "standard",
        "supplier": "supplier",
        "utilization": "utilization",
        "measured": "measured",
    }
    for w in words:
        mapped.append(synonyms.get(w, w))
    return " ".join(mapped)


def strip_module_prefix(norm: str) -> str:
    """
    Strips module and section prefixes that frequently appear in merged/multi-line Excel headers:
    e.g. 'sqd cat1 forecasted date cw' -> 'cat1 forecasted date cw'
         'buyer supplier name' -> 'supplier name'
         'capacity manager contracted capacity' -> 'contracted capacity'
    """
    if not norm:
        return ""
    cleaned = re.sub(
        r"^(sqd|buyer|capacity\s+manager|capacity|cap|scr|planning|fete\s+tko|management|documentation|team)\s+",
        "",
        norm,
    ).strip()
    return cleaned


def compute_similarity(header_norm: str, candidate_norm: str) -> float:
    """
    Computes a composite similarity score between 0.0 and 1.0 based on:
    - Exact equality (1.0)
    - Prefix-stripped equality (1.0)
    - Canonicalized token equality (1.0)
    - Substring containment with length weighting
    - Token set overlap (Jaccard similarity)
    - SequenceMatcher string distance
    """
    if not header_norm or not candidate_norm:
        return 0.0

    if header_norm == candidate_norm:
        return 1.0

    # Check prefix-stripped match
    stripped_h = strip_module_prefix(header_norm)
    stripped_c = strip_module_prefix(candidate_norm)
    if stripped_h == candidate_norm or header_norm == stripped_c or (stripped_h and stripped_h == stripped_c):
        return 1.0

    # Check canonicalized token match
    canon_h = _canonicalize_tokens(header_norm)
    canon_c = _canonicalize_tokens(candidate_norm)
    if canon_h == canon_c:
        return 1.0

    canon_sh = _canonicalize_tokens(stripped_h)
    canon_sc = _canonicalize_tokens(stripped_c)
    if canon_sh == canon_c or canon_h == canon_sc or (canon_sh and canon_sh == canon_sc):
        return 1.0

    # Sequence distance
    seq_ratio = max(
        difflib.SequenceMatcher(None, header_norm, candidate_norm).ratio(),
        difflib.SequenceMatcher(None, stripped_h, candidate_norm).ratio(),
        difflib.SequenceMatcher(None, canon_h, canon_c).ratio(),
    )

    # Token overlap
    tokens_h = set(canon_h.split()) | set(canon_sh.split())
    tokens_c = set(canon_c.split())
    if tokens_h and tokens_c:
        jaccard = len(tokens_h & tokens_c) / len(tokens_h | tokens_c)
        containment = len(tokens_h & tokens_c) / min(len(tokens_h), len(tokens_c))
    else:
        jaccard = 0.0
        containment = 0.0

    # Substring check with length penalty
    substring_score = 0.0
    for h_test in (header_norm, stripped_h, canon_h, canon_sh):
        if len(h_test) >= 3 and len(candidate_norm) >= 3:
            if h_test in candidate_norm or candidate_norm in h_test:
                min_len = min(len(h_test), len(candidate_norm))
                max_len = max(len(h_test), len(candidate_norm))
                substring_score = max(substring_score, min_len / max_len * 0.95)

    return max(seq_ratio, jaccard, substring_score, containment * 0.85)
