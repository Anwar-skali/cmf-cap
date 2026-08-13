import pytest
import uuid
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.api.deps import get_current_active_user
from app.infrastructure.persistence.models.user import User


mock_admin = User(
    id=uuid.uuid4(),
    email="admin@stellantis.com",
    first_name="Admin",
    last_name="User",
    role="admin",
    is_active=True,
)


@pytest.mark.asyncio
async def test_projects_pagination_and_bulk_delete():
    app.dependency_overrides[get_current_active_user] = lambda: mock_admin
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            # 1. Test List Projects with page & page_size
            res = await ac.get("/api/v1/projects?page=1&page_size=5")
            assert res.status_code == 200
            data = res.json()
            assert "items" in data
            assert "total" in data
            assert "page" in data
            assert data["page"] == 1
            assert data["page_size"] == 5
            assert "total_pages" in data

            # 2. Create 2 test projects to bulk delete
            p1 = await ac.post("/api/v1/projects", json={"name": "Bulk Test Prj 1", "currency": "EUR"})
            p2 = await ac.post("/api/v1/projects", json={"name": "Bulk Test Prj 2", "currency": "EUR"})
            assert p1.status_code == 200
            assert p2.status_code == 200

            id1 = p1.json()["id"]
            id2 = p2.json()["id"]

            # 3. Bulk delete the 2 projects
            del_res = await ac.post("/api/v1/projects/bulk-delete", json={"project_ids": [id1, id2]})
            assert del_res.status_code == 200
            del_data = del_res.json()
            assert del_data["deleted_count"] == 2
            assert id1 in del_data["deleted_ids"]
            assert id2 in del_data["deleted_ids"]

            # 4. Verify getting deleted project returns 404
            get_res = await ac.get(f"/api/v1/projects/{id1}")
            assert get_res.status_code == 404
    finally:
        app.dependency_overrides.pop(get_current_active_user, None)
