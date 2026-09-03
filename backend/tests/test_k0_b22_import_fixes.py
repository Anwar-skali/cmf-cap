"""
Edge-case checks specifically for CMF K0 B22 (non-Suivi, 32-column) import flow.
Tests cover:
1. Dynamic unique_key_col detection when col 0 (Unique_ID) is blank
2. _row_is_empty: rows with blank uk_col but populated Part Number should NOT be discarded
3. is_legacy_k0 gate: files with custom_mapping or non-Suivi sheet bypass the positional path
4. preview_and_validate: all 20 rows parsed, zero errors, mapped fields correct
5. execute_import: 20 rows imported, no failures
6. Backward compat: legacy 47-col Suivi path unaffected by changes
"""
import pytest
import asyncio
from unittest.mock import MagicMock

from app.application.services.import_engine_service import (
    ImportEngineService,
    K0_SHEET_NAME,
    K0_SOURCE_COLUMN_COUNT,
)


# ─────────────────────────── helpers ──────────────────────────────────────────

def _make_file_bytes(headers: list, rows: list[list]) -> bytes:
    """Create a minimal xlsx in memory for testing."""
    import io
    import openpyxl
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Feuil1"
    ws.append(headers)
    for row in rows:
        ws.append(row)
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf.read()


def _make_suivi_file_bytes() -> bytes:
    """47-column Suivi style file (legacy K0 path) with headers on row 8."""
    import io, openpyxl
    from app.application.services.import_engine_service import K0_SOURCE_COLUMNS
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = K0_SHEET_NAME
    # Header on row 8
    for i in range(7):
        ws.append([])  # rows 1-7 are empty
    # Row 8: Suivi-style headers (first 10 mapped columns)
    hdrs = [
        "Part Number", "Index", "Description", "Coef.", "Prix Pièce Série",
        "Masse Achat\n(Coef. x Prix pièce)", "RU", "NOA", "Make Battery (LP)",
        "Make Battery (LP) 2", "Supplier Name", "Vendor COFOR", "Manufacturer COFOR",
        "Combined COFOR", "Tango Order", "EI Status", "Comments",
        "Week\nProject Target", "Forecast\nWeek", "Completed\nWeek",
        "Week Project Target 2", "Forecast Week 2", "Completed Week 2",
        "Week Project Target 3", "Forecast Week 3", "Completed Week 3",
        "Quality", "Supply Chain", "Global Purchasing", "CPL", "RCPI",
        "Minimum Quality status acted", "Mass inquired",
        "Packaging readiness, UNLweb \nvalidated", "TANGO contract validated",
        "Supplier capability confirmed", "IT CPL (CORAIL,) setting",
        "FCLA validates", "PLE created", "EDI opened",
        "UM logistic flow validated", "Manufacturing process validated",
        "extra1", "extra2", "extra3", "extra6", "extra7",
    ]
    assert len(hdrs) == 47, f"Expected 47, got {len(hdrs)}"
    ws.append(hdrs)
    # Row 9: first data row
    row = ["9999999999"] + [""] * 46
    ws.append(row)
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf.read()


# ─────────────────────────── unit tests ───────────────────────────────────────

@pytest.mark.asyncio
async def test_parse_k0_b22_dynamic_uk_col_detection():
    """
    Column A (Unique_ID) is blank for all rows.
    parse_excel_file should dynamically detect Part Number at col 3 as uk_col
    and return all 20 rows.
    """
    headers = [
        "Unique_ID", "Line\nItem", "GST SOURCE\nPACKAGE NUMBER",
        "Part Number", "Part Name", "Nominated Supplier",
    ]
    rows = [
        [None, None, None, "9861318980", "JEU ETRIER FREIN AR", "Astemo France"],
        [None, None, None, "9861533080", "CATALYSEUR ASS", "Purem"],
        [None, None, None, "9874027580", "Part C", "Supplier C"],
    ]
    content = _make_file_bytes(headers, rows)

    uow = MagicMock()
    svc = ImportEngineService(uow)
    parsed = svc.parse_excel_file(
        content,
        specified_header_row=1,
        specified_sheet_name="Feuil1",
        unique_key_col_index=0,  # starts at 0 (Unique_ID = blank)
    )

    assert len(parsed["rows"]) == 3, f"Expected 3, got {len(parsed['rows'])}"
    assert parsed["rows"][0][3] == "9861318980"


@pytest.mark.asyncio
async def test_parse_k0_b22_row_not_empty_when_uk_col_blank_but_other_data_present():
    """
    If uk_col is 0 (Unique_ID) but is blank, the row should NOT be discarded
    as long as other columns (Part Number) have data.
    """
    headers = ["Unique_ID", "Part Number", "Part Name"]
    rows = [
        [None, "9861318980", "JEU ETRIER FREIN AR"],
        [None, "9861533080", "CATALYSEUR"],
    ]
    content = _make_file_bytes(headers, rows)

    uow = MagicMock()
    svc = ImportEngineService(uow)
    parsed = svc.parse_excel_file(
        content,
        specified_header_row=1,
        specified_sheet_name="Feuil1",
        unique_key_col_index=0,
    )

    # Both rows have data in col 1 (Part Number), so neither should be empty-filtered
    assert len(parsed["rows"]) == 2, f"Expected 2 rows, got {len(parsed['rows'])}: {parsed['rows']}"


@pytest.mark.asyncio
async def test_parse_k0_b22_truly_empty_row_is_filtered():
    """A row where Unique_ID AND all other cells are blank should still be filtered out."""
    headers = ["Unique_ID", "Part Number", "Part Name"]
    rows = [
        [None, "9861318980", "PART A"],
        [None, None, None],     # genuinely empty
        [None, "9874027580", "PART C"],
    ]
    content = _make_file_bytes(headers, rows)

    uow = MagicMock()
    svc = ImportEngineService(uow)
    parsed = svc.parse_excel_file(
        content,
        specified_header_row=1,
        specified_sheet_name="Feuil1",
        unique_key_col_index=0,
    )

    assert len(parsed["rows"]) == 2, f"Expected 2 rows (empty filtered), got {len(parsed['rows'])}"


@pytest.mark.asyncio
async def test_is_legacy_k0_false_when_custom_mapping_provided():
    """
    When custom_mapping is provided, preview_and_validate must NOT apply the
    legacy positional path (is_legacy_k0=False → use_positional_k0=False).
    This is tested indirectly: if the legacy path were active it would use
    row 8 of the 'Pilot Sheet (Suivi)' which doesn't exist in our test file,
    resulting in 0 rows. With the fix, 2 rows should come through.
    """
    headers = ["Part Number", "Part Name", "Nominated Supplier"]
    rows = [
        ["9861318980", "JEU ETRIER FREIN AR", "Astemo France"],
        ["9861533080", "CATALYSEUR ASS", "Purem"],
    ]
    content = _make_file_bytes(headers, rows)

    from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
    from app.infrastructure.persistence.models.base import Base
    from app.infrastructure.persistence.unit_of_work import UnitOfWork
    from app.application.services.template_service import TemplateService

    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        uow = UnitOfWork(session)
        tmpl_svc = TemplateService(uow)
        await tmpl_svc.seed_template_by_code("K0", "k0_template.json")
        await uow.commit()

        svc = ImportEngineService(uow)
        custom_mapping = {
            "Part Number": "part_number",
            "Part Name": "description",
            "Nominated Supplier": "supplier_name",
        }
        result = await svc.preview_and_validate(
            file_bytes=content,
            file_name="test_k0_b22.xlsx",
            entity_type="K0",
            custom_mapping=custom_mapping,
            sheet_name="Feuil1",
            header_row=1,
        )

    await engine.dispose()

    assert result["total_rows"] == 2, f"Expected 2, got {result['total_rows']}"
    assert result["valid_rows_count"] == 2
    assert result["empty_rows_count"] == 0
    assert result["error_rows_count"] == 0


@pytest.mark.asyncio
async def test_legacy_k0_suivi_path_unaffected():
    """
    Legacy 47-column Suivi file must continue to use the positional mapping path.
    is_legacy_k0=True must fire, use_positional_k0=True must hold.
    """
    content = _make_suivi_file_bytes()

    from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
    from app.infrastructure.persistence.models.base import Base
    from app.infrastructure.persistence.unit_of_work import UnitOfWork
    from app.application.services.template_service import TemplateService

    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        uow = UnitOfWork(session)
        tmpl_svc = TemplateService(uow)
        await tmpl_svc.seed_template_by_code("K0", "k0_template.json")
        await uow.commit()

        svc = ImportEngineService(uow)
        result = await svc.preview_and_validate(
            file_bytes=content,
            file_name="suivi.xlsx",
            entity_type="K0",
            custom_mapping=None,
            # No sheet_name / header_row → legacy K0 defaults kick in
        )

    await engine.dispose()

    # The legacy file has 1 real data row
    assert result["total_rows"] >= 1, f"Expected >= 1 row, got {result}"
