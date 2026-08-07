import pytest
import openpyxl
import io
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.infrastructure.persistence.models.base import Base
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.application.services.import_engine_service import ImportEngineService
from app.domain.import_schema import ImportColumnSpec


@pytest.fixture
def k9_sample_excel():
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "K9_Template"
    headers = [
        "Project Code", "Project Name", "Buyer", "Supplier", "Part Number",
        "Part Name", "Status", "Weekly Capacity", "Lead Time (days)", "CAT", "GOR", "Comments"
    ]
    ws.append(headers)
    ws.append([
        "K9-001", "Front Bumper", "John Smith", "PlasticTech", "PN-100245",
        "Front Bumper LH", "Active", "1200", "14", "CAT2", "green", "Example row"
    ])
    output = io.BytesIO()
    wb.save(output)
    return output.getvalue()


@pytest.mark.asyncio
async def test_preview_auto_mapping_k9(k9_sample_excel):
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with session_maker() as session:
        uow = UnitOfWork(session)
        service = ImportEngineService(uow)
        report = await service.preview_and_validate(k9_sample_excel, "test.xlsx", "K9")
        assert report["total_rows"] == 1
        assert report["valid_rows_count"] == 1
        assert len(report["validation_errors"]) == 0
    await engine.dispose()


@pytest.mark.asyncio
async def test_preview_ollama_dict_mapping_k9(k9_sample_excel):
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with session_maker() as session:
        uow = UnitOfWork(session)
        service = ImportEngineService(uow)
        ollama_mapping = {
            "unique_id": {"excel": "Project Code", "confidence": 0.95},
            "part_name": {"excel": "Project Name", "confidence": 0.95},
            "buyer": {"excel": "Buyer", "confidence": 0.95},
            "supplier_name": {"excel": "Supplier", "confidence": 0.95},
            "part_number": {"excel": "Part Number", "confidence": 0.95},
            "weekly_capacity_measured": {"excel": "Weekly Capacity", "confidence": 0.95},
            "cat_evaluation": {"excel": "GOR", "confidence": 0.95},
        }
        report = await service.preview_and_validate(
            k9_sample_excel, "test.xlsx", "K9", custom_mapping=ollama_mapping
        )
        assert report["total_rows"] == 1
        assert report["valid_rows_count"] == 1
        assert len(report["validation_errors"]) == 0
    await engine.dispose()


@pytest.mark.asyncio
async def test_preview_reverse_dict_mapping_k9(k9_sample_excel):
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with session_maker() as session:
        uow = UnitOfWork(session)
        service = ImportEngineService(uow)
        reverse_mapping = {
            "unique_id": "Project Code",
            "part_name": "Project Name",
            "buyer": "Buyer",
            "supplier_name": "Supplier",
            "part_number": "Part Number",
            "weekly_capacity_measured": "Weekly Capacity",
            "cat_evaluation": "GOR",
        }
        report = await service.preview_and_validate(
            k9_sample_excel, "test.xlsx", "K9", custom_mapping=reverse_mapping
        )
        assert report["total_rows"] == 1
        assert report["valid_rows_count"] == 1
        assert len(report["validation_errors"]) == 0
    await engine.dispose()


def test_enum_case_insensitive_coercion():
    service = ImportEngineService(None)
    spec = ImportColumnSpec(
        key="cat_evaluation",
        label="CAT Evaluation",
        type="enum",
        enum_values=["GREEN", "ORANGE", "RED"],
    )
    val, err = service._validate_and_coerce_type("green", spec)
    assert err is None
    assert val == "GREEN"
