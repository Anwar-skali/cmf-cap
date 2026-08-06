import pytest
import io
import json
import uuid
import openpyxl
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from app.main import app
from app.api.deps import get_current_active_user, get_db
from app.infrastructure.persistence.models.base import Base
from app.infrastructure.persistence.models.user import User


@pytest.fixture
def sample_excel_bytes():
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(["Project Code", "Project Name", "Budget", "Start Date", "Status"])
    ws.append(["PRJ-101", "Subframe Redesign", "3400 pcs-sem", "29", "Active"])
    ws.append(["PRJ-102", "Battery Module", "$12,500.50", "2026-07-29", "TBD"])
    output = io.BytesIO()
    wb.save(output)
    return output.getvalue()


def make_overrides(engine):
    from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async def override_get_db():
        async with async_session() as session:
            yield session

    mock_user = User(
        id=uuid.UUID("00000000-0000-0000-0000-000000000001"),
        email="testuser@example.com",
        role="buyer",
        is_active=True,
    )

    app.dependency_overrides[get_current_active_user] = lambda: mock_user
    app.dependency_overrides[get_db] = override_get_db


@pytest.mark.asyncio
async def test_import_templates_endpoint():
    """GET /import-templates returns 200."""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    make_overrides(engine)
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            res = await ac.get("/api/v1/import/import-templates")
            assert res.status_code == 200, f"Templates failed: {res.text}"
    finally:
        app.dependency_overrides.clear()
        await engine.dispose()


@pytest.mark.asyncio
async def test_extract_headers_endpoint(sample_excel_bytes):
    """POST /extract-headers returns correct headers from Excel bytes."""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    make_overrides(engine)
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            res = await ac.post(
                "/api/v1/import/extract-headers",
                files={"file": ("test.xlsx", sample_excel_bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
            )
            assert res.status_code == 200, f"Extract headers failed: {res.text}"
            data = res.json()
            assert "headers" in data
            assert "Project Code" in data["headers"]
    finally:
        app.dependency_overrides.clear()
        await engine.dispose()


@pytest.mark.asyncio
async def test_preview_returns_normalization_warnings(sample_excel_bytes):
    """POST /preview returns normalization_warnings and ambiguous date warning for '29'."""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    make_overrides(engine)
    mapping = json.dumps({
        "Project Code": "code",
        "Project Name": "name",
        "Budget": "budget",
        "Start Date": "start_date",
        "Status": "status",
    })
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            res = await ac.post(
                "/api/v1/import/preview",
                data={"entity_type": "projects", "custom_mapping_json": mapping},
                files={"file": ("test.xlsx", sample_excel_bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
            )
            assert res.status_code == 200, f"Preview failed: {res.text}"
            data = res.json()
            assert "preview_rows" in data
            assert "normalization_warnings" in data
            warnings = data["normalization_warnings"]
            ambiguous = [w for w in warnings if "Ambiguous" in w.get("warning", "")]
            assert len(ambiguous) >= 1, f"Expected ambiguous date warning for '29', got: {warnings}"
    finally:
        app.dependency_overrides.clear()
        await engine.dispose()


@pytest.mark.asyncio
async def test_execute_import_no_date_json_error(sample_excel_bytes):
    """
    Regression test: execute_import must NOT return 500 when date fields are present.

    Root cause: datetime.date objects inside the `data` JSON column were not
    serializable by SQLAlchemy. Fixed via _make_json_safe() which converts
    date -> ISO string before the ORM flush.
    """
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    make_overrides(engine)
    mapping = json.dumps({
        "Project Code": "code",
        "Project Name": "name",
        "Budget": "budget",
        "Start Date": "start_date",
        "Status": "status",
    })
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            res = await ac.post(
                "/api/v1/import/execute",
                data={
                    "entity_type": "projects",
                    "mode": "insert",
                    "strategy": "skip_invalid",
                    "column_mapping_json": mapping,
                },
                files={"file": ("test.xlsx", sample_excel_bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
            )
            assert res.status_code != 500, f"500 — date serialization bug still present: {res.text}"
            assert res.status_code == 200, f"Execute import failed: {res.text}"
            data = res.json()
            assert data.get("imported_count", 0) + data.get("skipped_count", 0) > 0, \
                f"No rows processed: {data}"
    finally:
        app.dependency_overrides.clear()
        await engine.dispose()
