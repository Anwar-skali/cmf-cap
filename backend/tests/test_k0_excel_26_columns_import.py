"""
Comprehensive tests for K0 Excel 47-column import and mapping logic.
Guards against duplicate-header collisions and verifies all 47 columns are imported.
"""
import io
import os
import pytest
import openpyxl

from app.application.services.import_engine_service import (
    ImportEngineService,
    K0_SOURCE_COLUMNS,
    K0_SOURCE_COLUMN_COUNT,
    K0_HEADER_ROW,
    K0_DATA_START_ROW,
    _build_k0_index_mapping,
    _build_k0_column_mapping,
)
from app.application.services.template_service import TemplateService
from app.infrastructure.persistence.unit_of_work import UnitOfWork


def _create_synthetic_k0_excel() -> bytes:
    """Create a realistic K0 Excel workbook simulating the 8-row header and 47 columns."""
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Pilot Sheet (Suivi)"

    # Rows 1-7: Metadata / French sub-headers
    ws.append(["Transfert MTCC to CPL Make Battery"])
    ws.append(["Notes & Instructions"])
    ws.append(["Legend"])
    ws.append([])
    ws.append(["NOA", "RCP", "GPSC"])
    ws.append([])
    ws.append(["Référence", "Indice", "Désignation", "Coef.", "Prix Pièce Série", "Masse Achat"])

    # Row 8: Authoritative English headers (47 source columns)
    row_8 = [
        "Part Number", "Index", "Description", "Coef.", "Serial Piece Price ",
        "Mass Purchase\n(Coef. x Price per part)", "RU", "NOA",
        "Make Battery (LP)", "Make Battery (LP)",
        "#REF!", "#REF!", "#REF!", "#REF!", "libre",
        "Supplier name", "Vendor COFOR", "Manufacturer COFOR", "Combined COFOR",
        "Tango order", "EI status", "Comments",
        "Week\nProject Target", "Forecast\nWeek", "Completed\nWeek",
        "Week\nProject Target", "Forecast\nWeek", "Completed\nWeek",
        "Week\nProject Target", "Forecast\nWeek", "Completed\nWeek",
        "Quality", "Supply Chain", "Global Purchasing", "CPL", "RCPI",
        "Minimum Quality status acted", "Mass inquired",
        "Packaging readiness, UNLweb \nvalidated", "TANGO contract validated",
        "Supplier capability confirmed", "IT CPL (CORAIL,) setting",
        "FCLA Validates", "PLE created", "EDI opened",
        "UM logistic flow validated", "Manufacturing process validated",
    ]
    ws.append(row_8)

    # Row 9: Data Row 1 (Part 9876895380)
    row_9 = [
        "9876895380", "00", "BATTERY MANAGEMENT MODULE", 1, 51.46,
        51.46, 1, "TAOUFIK ROUNDI",
        0, 0,
        None, None, None, None, None,
        "LIGOO (Shandong)", "A020SS 01", "A020SS 01", "A020SS 01",
        87313185, None, "Active battery part",
        None, "202548", None,
        None, None, None,
        None, None, None,
        202618, 202548, 202612, 202619, 202614,
        "OK", "OK", "OK", "OK", "OK", "OK", "OK", "OK", "OK", "OK", "OK",
    ]
    ws.append(row_9)

    # Row 10: Data Row 2 (Part 9874725380)
    row_10 = [
        "9874725380", "00", "CELL SENSOR CABLE", 1, 8.41,
        8.41, 1, "ROUNDI",
        0, 0,
        None, None, None, None, None,
        "LEONI WIRING", "B010XX", "B010XX", "B010XX",
        87399999, None, "Sensor cable",
        202624, "202620", None,
        202626, "202620", None,
        None, None, None,
        202618, 202548, 202612, 202619, 202614,
        "OK", "OK", "OK", "OK", "OK", "OK", "OK", "OK", "OK", "OK", "OK",
    ]
    ws.append(row_10)

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


@pytest.mark.asyncio
async def test_k0_preview_and_validate_47_columns(unit_of_work):
    """Test preview_and_validate on K0 Excel supports all 47 columns."""
    tmpl_svc = TemplateService(unit_of_work)
    await tmpl_svc.seed_template_by_code("K0", "k0_template.json")
    await unit_of_work.commit()

    import_svc = ImportEngineService(unit_of_work)
    file_bytes = _create_synthetic_k0_excel()

    report = await import_svc.preview_and_validate(
        file_bytes=file_bytes,
        file_name="k0_test.xlsx",
        entity_type="K0",
    )

    assert report["total_rows"] == 2
    assert report["record_rows_count"] == 2
    assert report["valid_rows_count"] == 2
    assert report["error_rows_count"] == 0
    assert len(report["headers"]) == 47

    # Verify preview rows have exact 47-column values
    rows = report["preview_rows"]
    assert len(rows) == 2

    row2 = rows[1]  # Part 9874725380
    assert str(row2["part_number"]) == "9874725380"
    assert float(row2["serial_piece_price"]) == 8.41
    assert float(row2["mass_purchase"]) == 8.41
    assert str(row2["week_project_target_1"]) == "202624"
    assert str(row2["forecast_week_1"]) == "202620"
    assert str(row2["week_project_target_2"]) == "202626"
    assert row2.get("manufacturing_process_validated") == "OK"


@pytest.mark.asyncio
async def test_k0_execute_import_47_columns(unit_of_work):
    """Test full execute_import for K0 imports all 47 source columns."""
    tmpl_svc = TemplateService(unit_of_work)
    await tmpl_svc.seed_template_by_code("K0", "k0_template.json")
    await unit_of_work.commit()

    import_svc = ImportEngineService(unit_of_work)
    file_bytes = _create_synthetic_k0_excel()

    result = await import_svc.execute_import(
        file_bytes=file_bytes,
        file_name="k0_test.xlsx",
        entity_type="K0",
        column_mapping={},
        mode="insert",
        strategy="skip_invalid",
    )

    assert result["imported_count"] == 2
    assert result["failed_count"] == 0
    assert result["status"] == "completed"

    # Verify in DB
    p1 = await unit_of_work.projects.get_by_code("9876895380")
    assert p1 is not None
    assert str(p1.data["part_number"]) == "9876895380"
    assert float(p1.data["serial_piece_price"]) == 51.46
    assert float(p1.data["mass_purchase"]) == 51.46

    p2 = await unit_of_work.projects.get_by_code("9874725380")
    assert p2 is not None
    assert str(p2.data["part_number"]) == "9874725380"
    assert float(p2.data["serial_piece_price"]) == 8.41
    assert float(p2.data["mass_purchase"]) == 8.41
    assert str(p2.data["week_project_target_1"]) == "202624"
    assert str(p2.data["week_project_target_2"]) == "202626"
    assert p2.data.get("manufacturing_process_validated") == "OK"


@pytest.mark.asyncio
async def test_k0_actual_xlsm_import_if_file_present(unit_of_work):
    """If the real uploaded K0 Excel workbook exists on disk, test importing it directly."""
    real_file_path = r"C:\projects\pfa-anwar\cmf-platform\Suivi_Transfert_Make_Battery_Macro. 1.xlsm"
    if not os.path.exists(real_file_path):
        pytest.skip("Real K0 XLSM file not present on system, skipping real file test.")

    with open(real_file_path, "rb") as f:
        file_bytes = f.read()

    tmpl_svc = TemplateService(unit_of_work)
    await tmpl_svc.seed_template_by_code("K0", "k0_template.json")
    await unit_of_work.commit()

    import_svc = ImportEngineService(unit_of_work)
    report = await import_svc.preview_and_validate(
        file_bytes=file_bytes,
        file_name="Suivi_Transfert_Make_Battery_Macro. 1.xlsm",
        entity_type="K0",
    )

    assert report["record_rows_count"] == 29
    assert report["valid_rows_count"] == 29
    assert len(report["headers"]) == 47


@pytest.mark.asyncio
async def test_k0_mapping_resolves_duplicate_headers_positionally(unit_of_work):
    """Verify that K0 mapping endpoint / resolution maps milestone 2 & 3 duplicate headers."""
    from app.application.services.template_context_service import TemplateContextService
    from app.application.services.ollama_mapping_service import OllamaMappingService
    from app.application.services.import_engine_service import _K0_CODES

    tmpl_svc = TemplateService(unit_of_work)
    await tmpl_svc.seed_template_by_code("K0", "k0_template.json")
    await unit_of_work.commit()

    ctx_svc = TemplateContextService(unit_of_work)
    template_context = await ctx_svc.get_template_context("K0")

    excel_headers = [
        "Part Number", "Index", "Description", "Coef.", "Serial Piece Price ",
        "Mass Purchase\n(Coef. x Price per part)", "RU", "NOA",
        "Make Battery (LP)", "Make Battery (LP)",
        "#REF!", "#REF!", "#REF!", "#REF!", "libre",
        "Supplier name", "Vendor COFOR", "Manufacturer COFOR", "Combined COFOR",
        "Tango order", "EI status", "Comments",
        "Week\nProject Target", "Forecast\nWeek", "Completed\nWeek",
        "Week\nProject Target", "Forecast\nWeek", "Completed\nWeek",
        "Week\nProject Target", "Forecast\nWeek", "Completed\nWeek",
        "Quality", "Supply Chain", "Global Purchasing", "CPL", "RCPI",
        "Minimum Quality status acted", "Mass inquired",
        "Packaging readiness, UNLweb \nvalidated", "TANGO contract validated",
        "Supplier capability confirmed", "IT CPL (CORAIL,) setting",
        "FCLA Validates", "PLE created", "EDI opened",
        "UM logistic flow validated", "Manufacturing process validated",
    ]

    ollama_svc = OllamaMappingService()
    result = await ollama_svc.generate_mapping(template_context, excel_headers)

    # Apply K0 positional fallback
    is_k0_template = "K0" in _K0_CODES
    if is_k0_template:
        for col_idx, f_key in enumerate(K0_SOURCE_COLUMNS):
            if f_key and col_idx < len(excel_headers):
                curr = result["mapping"].get(f_key)
                if not curr or not curr.get("excel") or curr.get("confidence", 0) == 0:
                    result["mapping"][f_key] = {
                        "excel": excel_headers[col_idx],
                        "confidence": 0.98,
                        "source": "positional_match",
                    }

    mapping = result["mapping"]
    # Verify milestone 1, 2, 3 fields are all mapped
    assert mapping["week_project_target_1"]["excel"] is not None
    assert mapping["week_project_target_2"]["excel"] is not None
    assert mapping["week_project_target_2"]["source"] == "positional_match"
    assert mapping["week_project_target_3"]["excel"] is not None
    assert mapping["week_project_target_3"]["source"] == "positional_match"

    assert mapping["forecast_week_2"]["excel"] is not None
    assert mapping["forecast_week_2"]["source"] == "positional_match"
    assert mapping["forecast_week_3"]["excel"] is not None
    assert mapping["forecast_week_3"]["source"] == "positional_match"

    assert mapping["completed_week_2"]["excel"] is not None
    assert mapping["completed_week_2"]["source"] == "positional_match"
    assert mapping["completed_week_3"]["excel"] is not None
    assert mapping["completed_week_3"]["source"] == "positional_match"

    assert mapping["make_battery_lp_2"]["excel"] is not None
    assert mapping["make_battery_lp_2"]["source"] == "positional_match"

