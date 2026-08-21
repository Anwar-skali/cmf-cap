"""Regression tests for record classification in the import engine.

A "record" is a worksheet row that carries a value in the structure's
unique-key column (e.g. ``code`` for the projects schema, ``part_number`` for
K0). Rows without a unique-key value (section headers, notes, placeholders)
must be reported as non-record rows and must NOT be validated or imported.
Previously every non-empty row was counted as a valid record, which produced
reports like "678 valid / 678 imported" for files that only contained a handful
of real records.
"""
import io

import pytest
import openpyxl
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from app.infrastructure.persistence.models.base import Base
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.application.services.import_engine_service import ImportEngineService

PROJECT_MAPPING = {
    "Project Code": "code",
    "Project Name": "name",
    "Status": "status",
}


def make_workbook(rows: list[list]) -> bytes:
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Data"
    ws.append(["Project Code", "Project Name", "Status"])
    for row in rows:
        ws.append(row)
    output = io.BytesIO()
    wb.save(output)
    return output.getvalue()


@pytest.fixture
def engine_factory():
    created = []

    async def _make():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
        created.append(engine)
        return engine, session_maker

    yield _make

    for e in created:
        import asyncio
        try:
            asyncio.get_event_loop().run_until_complete(e.dispose())
        except Exception:
            pass


@pytest.mark.asyncio
async def test_preview_counts_non_record_and_empty_rows(engine_factory):
    engine, session_maker = await engine_factory()
    async with session_maker() as session:
        uow = UnitOfWork(session)
        service = ImportEngineService(uow)
        file_bytes = make_workbook([
            ["PRJ-T1", "Alpha", "active"],  # record
            [None, None, None],             # fully empty row
            ["", "Beta", ""],               # no unique key -> non-record
            ["PRJ-T2", "Gamma", "active"],  # record
        ])
        report = await service.preview_and_validate(
            file_bytes, "test.xlsx", "projects", custom_mapping=PROJECT_MAPPING
        )
        # physical rows include the interspersed empty row
        assert report["physical_rows"] == 4
        assert report["empty_rows_count"] == 1
        # non-empty rows extracted by the parser
        assert report["total_rows"] == 3
        # only rows WITH a unique key are records
        assert report["record_rows_count"] == 2
        assert report["non_record_rows_count"] == 1
        assert report["valid_rows_count"] == 2
        assert report["error_rows_count"] == 0
        assert len(report["validation_errors"]) == 0
    await engine.dispose()


@pytest.mark.asyncio
async def test_preview_flags_duplicates_in_file_and_db(engine_factory):
    engine, session_maker = await engine_factory()
    async with session_maker() as session:
        uow = UnitOfWork(session)
        service = ImportEngineService(uow)
        await uow.projects.create({"code": "PRJ-T3", "name": "Existing"})
        await uow.commit()

        file_bytes = make_workbook([
            ["PRJ-T1", "Alpha", "active"],    # valid, new
            ["PRJ-T1", "Dup", "active"],      # duplicate in file
            ["PRJ-T3", "Existing", "active"], # duplicate in database (valid for update)
        ])
        report = await service.preview_and_validate(
            file_bytes, "test.xlsx", "projects", custom_mapping=PROJECT_MAPPING
        )
        assert report["total_rows"] == 3
        assert report["record_rows_count"] == 3
        # PRJ-T1 (new) and PRJ-T3 (update) are valid; PRJ-T1 (dup in file) is error
        assert report["valid_rows_count"] == 2
        assert report["error_rows_count"] == 1
        assert report["new_count"] == 1
        assert report["update_count"] == 1
        assert report["duplicate_in_excel_count"] == 1
        assert report["duplicate_in_db_count"] == 1
    await engine.dispose()


@pytest.mark.asyncio
async def test_execute_skips_non_record_and_duplicates(engine_factory):
    engine, session_maker = await engine_factory()
    async with session_maker() as session:
        uow = UnitOfWork(session)
        service = ImportEngineService(uow)
        await uow.projects.create({"code": "PRJ-T3", "name": "Existing"})
        await uow.commit()

        file_bytes = make_workbook([
            ["PRJ-T1", "Alpha", "active"],    # new record -> imported
            ["", "Beta", ""],                 # non-record -> skipped
            ["PRJ-T1", "Dup", "active"],      # duplicate in file -> skipped
            ["PRJ-T3", "Existing", "active"], # existing in db -> updated
            ["PRJ-T2", "Gamma", "active"],    # new record -> imported
        ])
        result = await service.execute_import(
            file_bytes,
            "test.xlsx",
            "projects",
            column_mapping=PROJECT_MAPPING,
            mode="insert",
            strategy="skip_invalid",
        )
        assert result["non_record_rows_count"] == 1
        assert result["duplicate_in_excel_count"] == 1
        assert result["imported_count"] == 2
        assert result["updated_count"] == 1
        assert result["failed_count"] == 0
        assert result["skipped_count"] == 2

        projects = await uow.projects.get_multi(limit=100)
        codes = {p.code for p in projects}
        assert codes == {"PRJ-T1", "PRJ-T2", "PRJ-T3"}
        # no junk auto-generated PRJ- codes may be created
        assert not any(c.startswith("PRJ-") and c not in {"PRJ-T1", "PRJ-T2", "PRJ-T3"} for c in codes)
    await engine.dispose()




@pytest.mark.asyncio
async def test_blank_trailing_rows_not_counted_as_physical(engine_factory):
    engine, session_maker = await engine_factory()
    async with session_maker() as session:
        uow = UnitOfWork(session)
        service = ImportEngineService(uow)
        file_bytes = make_workbook([
            ["PRJ-T1", "Alpha", "active"],
            [None, None, None],
            [None, None, None],
        ])
        report = await service.preview_and_validate(
            file_bytes, "test.xlsx", "projects", custom_mapping=PROJECT_MAPPING
        )
        assert report["physical_rows"] == 1
        assert report["empty_rows_count"] == 0
        assert report["record_rows_count"] == 1
        assert report["valid_rows_count"] == 1
    await engine.dispose()
