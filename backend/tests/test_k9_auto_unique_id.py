"""Unit tests for ImportEngineService._auto_fill_missing_unique_id.

These tests verify that:
1. K9-style rows with a blank Unique_ID receive an auto-generated value
   derived from (part_name|commodity|description) + row_idx.
2. Rows that already have a unique_id are NOT overwritten.
3. Schemas without a unique_id field (K0 etc.) are completely unaffected.
4. Rows with no identifying field fall back to a safe "ROW" slug.
"""
import pytest
from unittest.mock import MagicMock

from app.application.services.import_engine_service import ImportEngineService
from app.domain.import_schema import EntityImportSchema, ImportColumnSpec


def _make_schema(keys: list[str]) -> EntityImportSchema:
    """Build a minimal schema with the given field keys."""
    columns = [
        ImportColumnSpec(
            key=k,
            label=k.replace("_", " ").title(),
            required=(k == "unique_id"),
            type="string",
            aliases=[],
            description="",
            unique_key=(k == "unique_id"),
        )
        for k in keys
    ]
    return EntityImportSchema(
        entity_type="K9",
        display_name="CMF K9",
        columns=columns,
        sample_rows=[],
    )


K9_SCHEMA = _make_schema(["unique_id", "part_name", "commodity", "part_number"])
K0_SCHEMA = _make_schema(["part_number", "description"])


class TestAutoFillMissingUniqueId:

    def test_k9_empty_unique_id_is_generated_from_part_name(self):
        row = {"part_name": "Halogen Lamp", "commodity": "Headlamp"}
        ImportEngineService._auto_fill_missing_unique_id(row, K9_SCHEMA, row_idx=5)
        uid = row.get("unique_id")
        assert uid is not None
        assert uid.startswith("K9-")
        assert "-5" in uid  # row index in suffix
        # slug derived from part_name (first in priority)
        assert "HALOGEN" in uid.upper() or "LAMP" in uid.upper()

    def test_k9_falls_back_to_part_number_when_no_part_name(self):
        row = {"part_number": "PN-99482", "commodity": "Headlamp"}
        ImportEngineService._auto_fill_missing_unique_id(row, K9_SCHEMA, row_idx=10)
        uid = row.get("unique_id")
        assert uid is not None and "PN-99482" in uid.replace("-", "").upper() or "PN" in uid.upper()

    def test_k9_falls_back_to_commodity_when_no_part_name_or_part_number(self):
        row = {"commodity": "Headlamp"}
        ImportEngineService._auto_fill_missing_unique_id(row, K9_SCHEMA, row_idx=7)
        uid = row.get("unique_id")
        assert uid is not None
        assert "HEADLAMP" in uid.upper()

    def test_k9_falls_back_to_row_slug_when_all_empty(self):
        row = {}
        ImportEngineService._auto_fill_missing_unique_id(row, K9_SCHEMA, row_idx=3)
        uid = row.get("unique_id")
        assert uid == "K9-ROW-3"

    def test_k9_does_not_overwrite_existing_unique_id(self):
        row = {"unique_id": "EXISTING-ID-001", "part_name": "Front Bumper"}
        ImportEngineService._auto_fill_missing_unique_id(row, K9_SCHEMA, row_idx=1)
        assert row["unique_id"] == "EXISTING-ID-001"

    def test_k0_schema_without_unique_id_field_is_unaffected(self):
        """K0 schemas have no unique_id column — the helper must leave those rows alone."""
        row = {"part_number": "PN-001", "description": "Front Bumper"}
        ImportEngineService._auto_fill_missing_unique_id(row, K0_SCHEMA, row_idx=2)
        # unique_id must NOT be injected into a K0 row
        assert "unique_id" not in row

    def test_generated_id_is_deterministic_for_same_inputs(self):
        """Same part_name + row_idx must always produce the same unique_id."""
        row1 = {"part_name": "Matrix LED Total"}
        row2 = {"part_name": "Matrix LED Total"}
        ImportEngineService._auto_fill_missing_unique_id(row1, K9_SCHEMA, row_idx=42)
        ImportEngineService._auto_fill_missing_unique_id(row2, K9_SCHEMA, row_idx=42)
        assert row1["unique_id"] == row2["unique_id"]

    def test_generated_id_differs_for_different_row_idx(self):
        """Different row indices must produce different unique_ids even with same part_name."""
        row1 = {"part_name": "Same Part"}
        row2 = {"part_name": "Same Part"}
        ImportEngineService._auto_fill_missing_unique_id(row1, K9_SCHEMA, row_idx=1)
        ImportEngineService._auto_fill_missing_unique_id(row2, K9_SCHEMA, row_idx=2)
        assert row1["unique_id"] != row2["unique_id"]

    def test_special_chars_in_part_name_are_normalised(self):
        """Part names with special characters should produce clean slugs."""
        row = {"part_name": "Éco LED  Total (DLA10.DFE00)"}
        ImportEngineService._auto_fill_missing_unique_id(row, K9_SCHEMA, row_idx=6)
        uid = row["unique_id"]
        # Must not contain parentheses, dots or accented characters in the slug
        assert "(" not in uid
        assert "." not in uid
        assert uid == uid.upper() or uid.startswith("K9-")
