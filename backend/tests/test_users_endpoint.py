import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.api.deps import get_current_active_user
from app.infrastructure.persistence.models.user import User

@pytest.mark.asyncio
async def test_list_users_as_active_buyer():
    mock_buyer = User(
        id="00000000-0000-0000-0000-000000000001",
        email="buyer@example.com",
        role="buyer",
        is_active=True,
    )
    
    app.dependency_overrides[get_current_active_user] = lambda: mock_buyer
    
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
