import pytest
import pytest_asyncio
from app.application.services.import_engine_service import ImportEngineService
from app.domain.import_schema import EntityImportSchema, ImportColumnSpec

@pytest.mark.asyncio
async def test_normalize_column_mapping_preserves_excel_header_keys():
    """Verify that _normalize_column_mapping keeps exact raw Excel headers as dict keys."""
    schema = EntityImportSchema(
        entity_type="K9",
        display_name="K9 Template",
        sample_rows=[],
        columns=[
            ImportColumnSpec(key="unique_id", label="Unique_ID", required=True, unique_key=True),
            ImportColumnSpec(key="buyer", label="Buyer", required=True),
            ImportColumnSpec(key="part_name", label="Part Name", required=True),
        ],
    )
    
    headers = ["Unique_ID", "Buyer", "Part name"]
    custom_mapping = {"Unique_ID": "unique_id", "Buyer": "buyer", "Part name": "part_name"}

    normalized = ImportEngineService._normalize_column_mapping(custom_mapping, schema, headers)

    assert normalized["Unique_ID"] == "unique_id"
    assert normalized["Buyer"] == "buyer"
    assert normalized["Part name"] == "part_name"
