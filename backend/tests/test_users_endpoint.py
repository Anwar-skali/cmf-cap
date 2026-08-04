import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from app.main import app
from app.api.deps import get_current_active_user, get_db
from app.infrastructure.persistence.models.base import Base
from app.infrastructure.persistence.models.user import User


@pytest.mark.asyncio
async def test_list_users_as_active_buyer():
    # --- in-memory DB with all tables ---
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async def override_get_db():
        async with async_session() as session:
            yield session

    mock_buyer = User(
        id="00000000-0000-0000-0000-000000000001",
        email="buyer@example.com",
        role="buyer",
        is_active=True,
    )

    app.dependency_overrides[get_current_active_user] = lambda: mock_buyer
    app.dependency_overrides[get_db] = override_get_db

    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as ac:
            res = await ac.get("/api/v1/users?page_size=200")
            assert res.status_code == 200
            data = res.json()
            assert "items" in data
            assert "total" in data
    finally:
        app.dependency_overrides.clear()
        await engine.dispose()
