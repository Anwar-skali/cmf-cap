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


def compute_similarity(header_norm: str, candidate_norm: str) -> float:
    """
    Computes a composite similarity score between 0.0 and 1.0 based on:
    - Exact equality (1.0)
    - Substring containment with length weighting
    - Token set overlap (Jaccard similarity)
    - SequenceMatcher string distance
    """
    if not header_norm or not candidate_norm:
        return 0.0

    if header_norm == candidate_norm:
        return 1.0

    # Sequence distance
    seq_ratio = difflib.SequenceMatcher(None, header_norm, candidate_norm).ratio()

    # Token overlap
    tokens_h = set(header_norm.split())
    tokens_c = set(candidate_norm.split())
    if tokens_h and tokens_c:
        jaccard = len(tokens_h & tokens_c) / len(tokens_h | tokens_c)
        containment = len(tokens_h & tokens_c) / min(len(tokens_h), len(tokens_c))
    else:
        jaccard = 0.0
        containment = 0.0

    # Substring check with length penalty
    substring_score = 0.0
    if len(header_norm) >= 3 and len(candidate_norm) >= 3:
        if header_norm in candidate_norm or candidate_norm in header_norm:
            min_len = min(len(header_norm), len(candidate_norm))
            max_len = max(len(header_norm), len(candidate_norm))
            substring_score = min_len / max_len * 0.95

    return max(seq_ratio, jaccard, substring_score, containment * 0.85)
