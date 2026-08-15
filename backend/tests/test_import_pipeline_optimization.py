from __future__ import annotations

import io
import json
import openpyxl
import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, patch, MagicMock

from app.application.services.excel_header_extractor import ExcelHeaderExtractor
from app.application.services.header_normalizer import normalize_header, compute_similarity
from app.application.services.ollama_mapping_service import OllamaMappingService
from app.application.services.mapping_cache_service import MappingCacheService
from app.application.services.template_context_service import TemplateContext, TemplateFieldSpec
from app.application.services.import_engine_service import ImportEngineService
from app.domain.import_schema import EntityImportSchema, ImportColumnSpec


def create_excel_bytes(rows: list[list[any]]) -> bytes:
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Data"
    for r in rows:
        ws.append(r)
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


@pytest.fixture(autouse=True)
def clean_mapping_cache():
    MappingCacheService.clear_cache()
    yield
    MappingCacheService.clear_cache()


def sample_template_context() -> TemplateContext:
    return TemplateContext(
        template_code="K0",
        template_name="K0 Battery Module",
        fields=[
            TemplateFieldSpec(key="part_number", label="Part Number", aliases=["pn", "part no", "part-number", "part_number"], required=True),
            TemplateFieldSpec(key="supplier_name", label="Supplier Name", aliases=["supplier", "vendor", "company"], required=True),
            TemplateFieldSpec(key="description", label="Description", aliases=["desc", "part description"]),
            TemplateFieldSpec(key="weekly_capacity_contract", label="Weekly Capacity Contract", aliases=["capa contract", "contract capacity"]),
            TemplateFieldSpec(key="supplier_capacity", label="Supplier Capacity", aliases=["supp capa", "supplier max capacity"]),
            TemplateFieldSpec(key="sqe_name", label="SQE Name", aliases=["sqe", "quality engineer"]),
        ],
    )


# ─── 1. Header row 1 detection ───────────────────────────────────────────────
def test_header_row_1_detection():
    data = [
        ["Part Number", "Supplier Name", "Description", "Weekly Capacity"],
        ["PN-101", "Acme Corp", "Battery Shell", 5000],
        ["PN-102", "Globex", "Anode Plate", 3000],
    ]
    file_bytes = create_excel_bytes(data)
    headers, detected_row, conf, sheet, sheet_conf, _, _, orient = ExcelHeaderExtractor.extract_headers_with_details(file_bytes)
    assert detected_row == 1
    assert "Part Number" in headers
    assert "Supplier Name" in headers


# ─── 2. Header row 3 detection ───────────────────────────────────────────────
def test_header_row_3_detection():
    data = [
        ["Project Title: Battery CMF 2026", None, None, None],
        ["Confidential Document - Internal Use Only", None, None, None],
        ["Part Number", "Supplier Name", "Description", "Weekly Capacity"],
        ["PN-101", "Acme Corp", "Battery Shell", 5000],
        ["PN-102", "Globex", "Anode Plate", 3000],
    ]
    file_bytes = create_excel_bytes(data)
    headers, detected_row, conf, sheet, sheet_conf, _, _, orient = ExcelHeaderExtractor.extract_headers_with_details(file_bytes)
    assert detected_row == 3
    assert "Part Number" in headers
    assert "Supplier Name" in headers


# ─── 3. Header row 8 detection ───────────────────────────────────────────────
def test_header_row_8_detection():
    data = [
        ["CMF PLATFORM REPORT", None, None, None],
        ["Author: Engineering Dept", None, None, None],
        ["Date: 2026-08-15", None, None, None],
        ["Status: Active", None, None, None],
        ["Notes: K0 Module Specifications", None, None, None],
        [None, None, None, None],
        [None, None, None, None],
        ["Part Number", "Supplier Name", "Description", "Weekly Capacity"],
        ["PN-101", "Acme Corp", "Battery Shell", 5000],
        ["PN-102", "Globex", "Anode Plate", 3000],
    ]
    file_bytes = create_excel_bytes(data)
    headers, detected_row, conf, sheet, sheet_conf, _, _, orient = ExcelHeaderExtractor.extract_headers_with_details(file_bytes)
    assert detected_row == 8
    assert "Part Number" in headers


# ─── 4. Exact normalized mapping & distinguishing numbers ────────────────────
def test_normalization_and_number_preservation():
    assert normalize_header("Part Number") == "part number"
    assert normalize_header("PART_NUMBER") == "part number"
    assert normalize_header("part-number") == "part number"
    assert normalize_header("  part   number  ") == "part number"
    assert normalize_header("Numéro de Pièce") == "numero de piece"
    assert normalize_header("Pièce_N°") == "piece n"

    # Distinguishing numbers preserved
    norm12 = normalize_header("Weekly Capacity (parts/week)12")
    norm13 = normalize_header("Weekly Capacity (parts/week)13")
    assert norm12 == "weekly capacity parts week 12"
    assert norm13 == "weekly capacity parts week 13"
    assert norm12 != norm13


# ─── 5. Alias mapping ────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_alias_mapping():
    ctx = sample_template_context()
    headers = ["PN", "Supplier", "Desc", "SQE"]
    service = OllamaMappingService()
    
    # Fast path: exact and alias matches
    res = await service.generate_mapping(ctx, headers)
    mapping = res["mapping"]

    assert mapping["part_number"]["excel"] == "PN"
    assert mapping["part_number"]["source"] == "alias_match"
    assert mapping["supplier_name"]["excel"] == "Supplier"
    assert mapping["supplier_name"]["source"] == "alias_match"
    assert mapping["description"]["excel"] == "Desc"
    assert mapping["description"]["source"] == "alias_match"
    assert mapping["sqe_name"]["excel"] == "SQE"
    assert mapping["sqe_name"]["source"] == "alias_match"
    assert res["ollama_active"] is False


# ─── 6. Fuzzy mapping thresholds ─────────────────────────────────────────────
@pytest.mark.asyncio
async def test_fuzzy_mapping_thresholds():
    ctx = TemplateContext(
        template_code="TEST",
        template_name="Test",
        fields=[
            TemplateFieldSpec(key="part_description", label="Part Description"),
            TemplateFieldSpec(key="supplier_quality_engineer", label="Supplier Quality Engineer"),
        ],
    )
    # High confidence fuzzy match (>= 0.90)
    headers = ["Part Descriptions", "Supplier Quality Engineerr"]
    service = OllamaMappingService()
    res = await service.generate_mapping(ctx, headers)
    mapping = res["mapping"]

    assert mapping["part_description"]["excel"] == "Part Descriptions"
    assert mapping["part_description"]["confidence"] >= 0.90
    assert mapping["part_description"]["source"] == "fuzzy_match"
    assert mapping["supplier_quality_engineer"]["excel"] == "Supplier Quality Engineerr"
    assert mapping["supplier_quality_engineer"]["confidence"] >= 0.90


# ─── 7. AI fallback ONLY for unresolved columns ──────────────────────────────
@pytest.mark.asyncio
async def test_ai_fallback_only_for_unresolved_columns():
    ctx = sample_template_context()
    # 4 resolved deterministically (Exact/Alias), 2 unresolved/ambiguous with NO aliases
    headers = ["Part Number", "Supplier Name", "Description", "SQE Name", "Unmatched Column X", "Unmatched Column Y"]

    service = OllamaMappingService()

    # Mock Ollama response returning only unresolved mappings
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "response": json.dumps({
            "Unmatched Column X": "weekly_capacity_contract",
            "Unmatched Column Y": "supplier_capacity",
        }),
        "prompt_eval_count": 45,
        "eval_count": 25,
    }

    with patch.object(service, "check_ollama_reachable", return_value=True):
        with patch("httpx.AsyncClient.post", new=AsyncMock(return_value=mock_response)):
            res = await service.generate_mapping(ctx, headers)

    mapping = res["mapping"]
    assert mapping["part_number"]["excel"] == "Part Number"
    assert mapping["part_number"]["source"] == "exact_match"
    assert mapping["supplier_name"]["excel"] == "Supplier Name"
    assert mapping["supplier_name"]["source"] == "exact_match"
    assert mapping["description"]["excel"] == "Description"
    assert mapping["description"]["source"] == "exact_match"
    assert mapping["sqe_name"]["excel"] == "SQE Name"
    assert mapping["sqe_name"]["source"] == "exact_match"

    # AI mapped the remaining 2
    assert mapping["weekly_capacity_contract"]["excel"] == "Unmatched Column X"
    assert mapping["supplier_capacity"]["excel"] == "Unmatched Column Y"
    assert res["ollama_active"] is True


# ─── 8. Ollama unavailable / offline graceful fallback ───────────────────────
@pytest.mark.asyncio
async def test_ollama_unavailable_graceful_fallback():
    ctx = sample_template_context()
    headers = ["Part Number", "Supplier Name", "Unresolved Col X"]

    service = OllamaMappingService()
    with patch.object(service, "check_ollama_reachable", return_value=False):
        res = await service.generate_mapping(ctx, headers)

    assert res["ollama_active"] is False
    assert res["mapping"]["part_number"]["excel"] == "Part Number"
    assert res["mapping"]["supplier_name"]["excel"] == "Supplier Name"
    assert "AI mapping unavailable" in res["fallback_reason"]


# ─── 9. Ollama timeout graceful fallback ─────────────────────────────────────
@pytest.mark.asyncio
async def test_ollama_timeout_graceful_fallback():
    import httpx
    ctx = sample_template_context()
    headers = ["Part Number", "Supplier Name", "Unresolved Col X"]

    service = OllamaMappingService()
    with patch.object(service, "check_ollama_reachable", return_value=True):
        with patch("httpx.AsyncClient.post", side_effect=httpx.TimeoutException("Timeout")):
            res = await service.generate_mapping(ctx, headers)

    assert res["ollama_active"] is False
    assert res["mapping"]["part_number"]["excel"] == "Part Number"
    assert "AI mapping unavailable" in res["fallback_reason"]


# ─── 10. Invalid AI JSON response handling ───────────────────────────────────
@pytest.mark.asyncio
async def test_invalid_ai_json_graceful_fallback():
    ctx = sample_template_context()
    headers = ["Part Number", "Supplier Name", "Unknown Col"]

    service = OllamaMappingService()
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {"response": "This is not valid JSON {{}}"}

    with patch.object(service, "check_ollama_reachable", return_value=True):
        with patch("httpx.AsyncClient.post", new=AsyncMock(return_value=mock_resp)):
            res = await service.generate_mapping(ctx, headers)

    assert res["ollama_active"] is False
    assert res["mapping"]["part_number"]["excel"] == "Part Number"


# ─── 11. AI suggesting nonexistent field ─────────────────────────────────────
@pytest.mark.asyncio
async def test_ai_suggesting_nonexistent_field():
    ctx = sample_template_context()
    headers = ["Part Number", "Supplier Name", "Strange Header"]

    service = OllamaMappingService()
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "response": json.dumps({"Strange Header": "non_existent_fake_field"})
    }

    with patch.object(service, "check_ollama_reachable", return_value=True):
        with patch("httpx.AsyncClient.post", new=AsyncMock(return_value=mock_resp)):
            res = await service.generate_mapping(ctx, headers)

    assert res["ollama_active"] is False
    assert "non_existent_fake_field" not in res["mapping"]


# ─── 12. Duplicate AI target fields prevention ───────────────────────────────
@pytest.mark.asyncio
async def test_duplicate_ai_target_fields_prevention():
    ctx = sample_template_context()
    headers = ["Part Number", "Supplier Name", "Unresolved Col 1", "Unresolved Col 2"]

    service = OllamaMappingService()
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    # AI attempts to map two different headers to the SAME target field 'description'
    mock_resp.json.return_value = {
        "response": json.dumps({
            "Unresolved Col 1": "description",
            "Unresolved Col 2": "description",
        })
    }

    with patch.object(service, "check_ollama_reachable", return_value=True):
        with patch("httpx.AsyncClient.post", new=AsyncMock(return_value=mock_resp)):
            res = await service.generate_mapping(ctx, headers)

    mapping = res["mapping"]
    assert mapping["description"]["excel"] == "Unresolved Col 1"
    # Ensure no collision or overwrite


# ─── 13. Large Excel file performance & parsing ──────────────────────────────
def test_large_excel_file_parsing(unit_of_work):
    # 100 columns x 500 rows
    headers = [f"Col_Header_{i}" for i in range(100)]
    rows = [headers]
    for r in range(500):
        rows.append([f"val_{r}_{c}" for c in range(100)])

    file_bytes = create_excel_bytes(rows)
    service = ImportEngineService(unit_of_work)
    parsed = service.parse_excel_file(file_bytes)

    assert len(parsed["headers"]) == 100
    assert parsed["total_rows"] == 500


# ─── 14. 678-row K0-style import (100% deterministic validation) ─────────────
@pytest.mark.asyncio
async def test_678_row_k0_style_import_deterministic(unit_of_work):
    headers = ["Part Number", "Supplier Name", "Description", "Weekly Capacity"]
    rows = [headers]
    for i in range(1, 679):
        rows.append([f"PN-K0-{i:04d}", f"Supplier Unique {i}", f"Module Part {i}", 1000 + i])

    file_bytes = create_excel_bytes(rows)
    service = ImportEngineService(unit_of_work)

    mapping = {
        "Part Number": "part_number",
        "Supplier Name": "name",
        "Description": "description",
    }

    report = await service.preview_and_validate(
        file_bytes=file_bytes,
        file_name="K0_678_rows.xlsx",
        entity_type="suppliers",
        custom_mapping=mapping,
    )

    assert report["total_rows"] == 678
    assert report["valid_rows_count"] == 678
    assert report["error_rows_count"] == 0


# ─── 15. K9-style multi-field template import ────────────────────────────────
@pytest.mark.asyncio
async def test_k9_style_import(unit_of_work):
    schema = EntityImportSchema(
        entity_type="k9_module",
        display_name="K9 Project Structure",
        columns=[
            ImportColumnSpec(key="part_number", label="Part Number", required=True, unique_key=True),
            ImportColumnSpec(key="supplier_name", label="Supplier Name", required=True),
            ImportColumnSpec(key="sqe", label="SQE Engineer", aliases=["sqe", "quality engineer"]),
        ],
        sample_rows=[],
    )

    headers = ["part-number", "supplier_name", "sqe"]
    service = ImportEngineService(unit_of_work)
    mapped = service.auto_map_columns(headers, schema)

    assert mapped["part-number"] == "part_number"
    assert mapped["supplier_name"] == "supplier_name"
    assert mapped["sqe"] == "sqe"


# ─── 16. Same headers imported twice using cached mappings (0 AI calls) ──────
@pytest.mark.asyncio
async def test_cached_mappings_second_import_makes_zero_ai_calls():
    ctx = sample_template_context()
    headers = ["Custom Header 1", "Custom Header 2"]

    # Prime cache for K0
    MappingCacheService.save_mapping_memory("K0", {
        "part_number": "Custom Header 1",
        "supplier_name": "Custom Header 2",
    })

    service = OllamaMappingService()
    # With cache primed, even with unfamiliar headers, AI is NOT called
    with patch.object(service, "check_ollama_reachable") as mock_health:
        res = await service.generate_mapping(ctx, headers)
        mock_health.assert_not_called()

    assert res["ollama_active"] is False
    assert res["mapping"]["part_number"]["excel"] == "Custom Header 1"
    assert res["mapping"]["part_number"]["source"] == "mapping_memory"
    assert res["mapping"]["supplier_name"]["excel"] == "Custom Header 2"
    assert res["mapping"]["supplier_name"]["source"] == "mapping_memory"
