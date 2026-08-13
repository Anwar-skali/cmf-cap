import pytest
import uuid
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from app.main import app
from app.api.deps import get_current_active_user, get_db
from app.application.services.template_service import (
    _normalize_project_structure_json,
    validate_structure_selectable_fields,
    TemplateService,
)
from app.application.dto.templates import CreateTemplateRequest
from app.core.exceptions import BadRequestException
from app.infrastructure.persistence.models.base import Base
from app.infrastructure.persistence.models.user import User

HIERARCHICAL_STRUCTURE_JSON = {
    "structure": {
        "name": "CMF Supplier Management",
        "code": "CMF_SUPPLIER",
        "version": "1.0",
        "description": "Supplier management project structure",
        "status": "DRAFT",
    },
    "modules": [
        {
            "code": "PROJECT",
            "name": "Project Management",
            "tables": [
                {
                    "name": "project",
                    "fields": [
                        {"name": "project_code", "label": "Project Code", "type": "string", "required": True},
                        {"name": "project_name", "label": "Project Name", "type": "string", "required": True},
                        {"name": "customer", "label": "Customer", "type": "string", "required": True},
                        {"name": "project_status", "label": "Project Status", "type": "status", "required": True},
                    ],
                }
            ],
        },
        {
            "code": "SUPPLIER",
            "name": "Supplier Management",
            "tables": [
                {
                    "name": "supplier",
                    "fields": [
                        {"name": "supplier_code", "label": "Supplier Code", "type": "string", "required": True},
                        {"name": "supplier_name", "label": "Supplier Name", "type": "string", "required": True},
                        {"name": "country", "label": "Country", "type": "string", "required": False},
                        {"name": "supplier_status", "label": "Supplier Status", "type": "status", "required": True},
                    ],
                }
            ],
        },
        {
            "code": "QUALITY",
            "name": "Quality Management",
            "tables": [
                {
                    "name": "quality_assessment",
                    "fields": [
                        {"name": "assessment_date", "label": "Assessment Date", "type": "date", "required": True},
                        {"name": "quality_score", "label": "Quality Score", "type": "percentage", "required": False},
                        {"name": "evaluation", "label": "Evaluation", "type": "status", "required": True},
                    ],
                }
            ],
        },
    ],
    "relationships": [
        {"from": "project", "to": "supplier", "type": "one_to_many"},
        {"from": "supplier", "to": "quality_assessment", "type": "one_to_many"},
    ],
}


def _count_fields(sections):
    return sum(len(fld) for sec in sections for grp in sec["groups"] for fld in [grp["fields"]])


def _flatten_fields(normalized):
    return {
        f["internalName"]: f
        for sec in normalized["sections"]
        for grp in sec["groups"]
        for f in grp["fields"]
    }


class TestNormalizeProjectStructureJson:
    def test_hierarchical_layout_preserves_hierarchy(self):
        normalized = _normalize_project_structure_json(HIERARCHICAL_STRUCTURE_JSON)

        # Metadata preserved
        assert normalized["code"] == "CMF_SUPPLIER"
        assert normalized["name"] == "CMF Supplier Management"
        assert normalized["version"] == "1.0"
        assert normalized["status"] == "DRAFT"

        # 3 modules are reorganized into the role sections the Manuel Project
        # workflow expects (Buyer + SQD for this fixture; General for leftovers).
        assert len(normalized["sections"]) == 3
        assert [s["id"] for s in normalized["sections"]] == ["sec_buyer", "sec_sqd", "sec_general"]
        assert [s["name"] for s in normalized["sections"]] == ["Buyer", "SQD", "General"]

        # 11 fields, top-level keys NOT treated as fields
        by_name = _flatten_fields(normalized)
        assert len(by_name) == 11
        names = list(by_name)
        assert "modules" not in names and "tables" not in names and "relationships" not in names
        assert "project_code" in names and "evaluation" in names

        # Fields are distributed under the correct role sections.
        def section_of(field_name):
            return next(
                sec["id"]
                for sec in normalized["sections"]
                if any(f["internalName"] == field_name for grp in sec["groups"] for f in grp["fields"])
            )

        assert section_of("supplier_code") == "sec_buyer"
        assert section_of("supplier_name") == "sec_buyer"
        assert section_of("quality_score") == "sec_sqd"
        assert section_of("evaluation") == "sec_sqd"
        assert section_of("project_code") == "sec_general"

        # Types mapped onto CMF vocabulary
        assert by_name["project_code"]["type"] == "text"
        assert by_name["quality_score"]["type"] == "percentage"
        assert by_name["assessment_date"]["type"] == "date"
        assert by_name["evaluation"]["type"] == "status"
        assert by_name["country"]["required"] is False
        assert by_name["project_code"]["required"] is True

        # Summary counts + relationships preserved
        assert normalized["modules"] == 3
        assert normalized["tables"] == 3
        assert normalized["fieldCount"] == 11
        assert len(normalized["relationships"]) == 2
        assert normalized["relationships"][0] == {"from": "project", "to": "supplier", "type": "one_to_many"}

    def test_flat_cmf_template_passes_through(self):
        flat = {"code": "K9", "name": "K9", "sections": [{"name": "Buyer", "groups": []}]}
        normalized = _normalize_project_structure_json(flat)
        assert normalized is flat

    def test_unrecognized_shape_raises_structured_error(self):
        with pytest.raises(ValueError) as exc_info:
            _normalize_project_structure_json({"modules": "nope", "relationships": []})
        assert "Invalid Project Structure JSON" in str(exc_info.value)

    def test_flat_keys_never_become_fields(self):
        with pytest.raises(ValueError):
            _normalize_project_structure_json({"foo": "bar", "baz": "qux"})

    def test_selectable_field_options_and_default_preserved(self):
        raw = {
            "structure": {"name": "S", "code": "S", "version": "1.0"},
            "modules": [
                {
                    "code": "QUALITY",
                    "name": "Quality",
                    "tables": [
                        {
                            "name": "quality_assessment",
                            "fields": [
                                {
                                    "name": "evaluation",
                                    "label": "Evaluation",
                                    "type": "status",
                                    "required": True,
                                    "options": ["GREEN", "ORANGE", "RED", "OPEN"],
                                    "default": "GREEN",
                                },
                                {
                                    "name": "capacity_unit",
                                    "label": "Capacity Unit",
                                    "type": "dropdown",
                                    "required": True,
                                    "options": [
                                        {"value": "pcs-sem", "label": "PCS / Semester", "order": 1},
                                        {"value": "pcs-week", "label": "PCS / Week", "order": 2},
                                    ],
                                },
                            ],
                        }
                    ],
                }
            ],
        }
        normalized = _normalize_project_structure_json(raw)
        by_name = _flatten_fields(normalized)

        evaluation = by_name["evaluation"]
        assert evaluation["type"] == "status"
        assert evaluation["required"] is True
        assert evaluation["options"] == [
            {"value": "GREEN", "label": "GREEN", "order": 1},
            {"value": "ORANGE", "label": "ORANGE", "order": 2},
            {"value": "RED", "label": "RED", "order": 3},
            {"value": "OPEN", "label": "OPEN", "order": 4},
        ]
        assert evaluation["defaultValue"] == "GREEN"

        capacity_unit = by_name["capacity_unit"]
        assert capacity_unit["type"] == "dropdown"
        assert capacity_unit["options"] == [
            {"value": "pcs-sem", "label": "PCS / Semester", "order": 1},
            {"value": "pcs-week", "label": "PCS / Week", "order": 2},
        ]
        assert capacity_unit["defaultValue"] is None

    def test_default_falls_back_to_defaultValue(self):
        raw = {
            "code": "CMF_NORMALIZED",
            "name": "Normalized",
            "sections": [
                {
                    "name": "Quality",
                    "groups": [
                        {
                            "name": "qa",
                            "fields": [
                                {
                                    "internalName": "evaluation",
                                    "label": "Evaluation",
                                    "type": "status",
                                    "required": True,
                                    "options": [{"value": "GREEN", "label": "GREEN"}],
                                    "defaultValue": "GREEN",
                                }
                            ],
                        }
                    ],
                }
            ],
        }
        normalized = _normalize_project_structure_json(raw)
        field = normalized["sections"][0]["groups"][0]["fields"][0]
        assert field["options"] == [{"value": "GREEN", "label": "GREEN"}]
        assert field["defaultValue"] == "GREEN"

    def test_direct_module_fields_normalization(self):
        task1_json = {
            "code": "TEST_CMF_STRUCTURE",
            "name": "CMF Test Structure",
            "version": "1.0",
            "status": "DRAFT",
            "description": "Test project structure",
            "orientation": "VERTICAL",
            "modules": [
                {
                    "name": "Project",
                    "fields": [
                        {"name": "project_code", "type": "text", "required": True},
                        {"name": "project_name", "type": "text", "required": True},
                        {"name": "customer", "type": "text", "required": True},
                        {"name": "project_status", "type": "status", "required": True},
                    ],
                },
                {
                    "name": "Supplier",
                    "fields": [
                        {"name": "supplier_code", "type": "text", "required": True},
                        {"name": "supplier_name", "type": "text", "required": True},
                        {"name": "country", "type": "text", "required": False},
                    ],
                },
                {
                    "name": "Quality Assessment",
                    "fields": [
                        {"name": "assessment_date", "type": "date", "required": True},
                        {"name": "quality_score", "type": "percentage", "required": True},
                        {
                            "name": "evaluation",
                            "type": "dropdown",
                            "required": True,
                            "options": [
                                {"label": "Passed", "value": "PASSED"},
                                {"label": "Failed", "value": "FAILED"},
                                {"label": "Pending", "value": "PENDING"},
                            ],
                        },
                    ],
                },
            ],
            "relationships": [
                {"from": "Project", "to": "Supplier", "type": "many-to-one"},
                {"from": "Project", "to": "Quality Assessment", "type": "one-to-many"},
            ],
        }

        normalized = _normalize_project_structure_json(task1_json)

        assert normalized["code"] == "TEST_CMF_STRUCTURE"
        assert normalized["name"] == "CMF Test Structure"
        assert normalized["orientation"] == "VERTICAL"
        assert normalized["modules"] == 3
        assert normalized["fieldCount"] == 10
        assert len(normalized["relationships"]) == 2

        # Reorganized into role sections (Buyer/SQD) + General for leftovers.
        assert len(normalized["sections"]) == 3
        sec_names = [s["name"] for s in normalized["sections"]]
        assert sec_names == ["Buyer", "SQD", "General"]

        by_name = _flatten_fields(normalized)
        assert len(by_name) == 10
        assert by_name["supplier_code"]["required"] is True
        assert by_name["country"]["required"] is False
        raw = {
            "structure": {"name": "S", "code": "S", "version": "1.0"},
            "modules": [
                {
                    "code": "Q",
                    "name": "Q",
                    "tables": [
                        {
                            "name": "qa",
                            "fields": [
                                {
                                    "name": "evaluation",
                                    "type": "status",
                                    "required": True,
                                    "options": ["GREEN", "RED"],
                                    "defaultValue": "RED",
                                }
                            ],
                        }
                    ],
                }
            ],
        }
        normalized = _normalize_project_structure_json(raw)
        field = normalized["sections"][0]["groups"][0]["fields"][0]
        assert field["defaultValue"] == "RED"


class TestValidateSelectableFields:
    def test_required_selectable_without_options_is_invalid(self):
        schema = {
            "sections": [
                {
                    "name": "Quality",
                    "groups": [
                        {
                            "name": "qa",
                            "fields": [
                                {
                                    "internalName": "evaluation",
                                    "label": "Evaluation",
                                    "type": "status",
                                    "required": True,
                                    "options": [],
                                }
                            ],
                        }
                    ],
                }
            ]
        }
        problems = validate_structure_selectable_fields(schema)
        assert any("Evaluation" in p for p in problems)

    def test_required_selectable_with_options_is_valid(self):
        schema = {
            "sections": [
                {
                    "name": "Quality",
                    "groups": [
                        {
                            "name": "qa",
                            "fields": [
                                {
                                    "internalName": "evaluation",
                                    "label": "Evaluation",
                                    "type": "status",
                                    "required": True,
                                    "options": [{"value": "GREEN", "label": "GREEN"}],
                                }
                            ],
                        }
                    ],
                }
            ]
        }
        assert validate_structure_selectable_fields(schema) == []

    def test_required_selectable_with_default_is_valid(self):
        schema = {
            "sections": [
                {
                    "name": "Quality",
                    "groups": [
                        {
                            "name": "qa",
                            "fields": [
                                {
                                    "internalName": "evaluation",
                                    "label": "Evaluation",
                                    "type": "status",
                                    "required": True,
                                    "defaultValue": "GREEN",
                                }
                            ],
                        }
                    ],
                }
            ]
        }
        assert validate_structure_selectable_fields(schema) == []

    def test_optional_selectable_without_options_is_valid(self):
        schema = {
            "sections": [
                {
                    "name": "Quality",
                    "groups": [
                        {
                            "name": "qa",
                            "fields": [
                                {
                                    "internalName": "note",
                                    "label": "Note",
                                    "type": "status",
                                    "required": False,
                                    "options": [],
                                }
                            ],
                        }
                    ],
                }
            ]
        }
        assert validate_structure_selectable_fields(schema) == []

    def test_non_selectable_required_without_options_is_valid(self):
        schema = {
            "sections": [
                {
                    "name": "Project",
                    "groups": [
                        {
                            "name": "project",
                            "fields": [
                                {
                                    "internalName": "project_name",
                                    "label": "Project Name",
                                    "type": "text",
                                    "required": True,
                                }
                            ],
                        }
                    ],
                }
            ]
        }
        assert validate_structure_selectable_fields(schema) == []


@pytest.mark.asyncio
async def test_publish_blocks_structure_without_selectable_options(unit_of_work):
    service = TemplateService(unit_of_work)
    invalid_schema = {
        "code": "INVALID_SELECT",
        "name": "Invalid Select",
        "version": "1.0",
        "status": "PUBLISHED",
        "sections": [
            {
                "name": "Quality",
                "groups": [
                    {
                        "name": "qa",
                        "fields": [
                            {
                                "internalName": "evaluation",
                                "label": "Evaluation",
                                "type": "status",
                                "required": True,
                            }
                        ],
                    }
                ],
            }
        ],
    }
    with pytest.raises(BadRequestException):
        await service.create_template(
            CreateTemplateRequest(
                code="INVALID_SELECT",
                name="Invalid Select",
                version="1.0",
                status="PUBLISHED",
                schema_json=invalid_schema,
            )
        )


@pytest.mark.asyncio
async def test_publish_allows_structure_with_selectable_options(unit_of_work):
    service = TemplateService(unit_of_work)
    valid_schema = {
        "code": "VALID_SELECT",
        "name": "Valid Select",
        "version": "1.0",
        "status": "PUBLISHED",
        "sections": [
            {
                "name": "Quality",
                "groups": [
                    {
                        "name": "qa",
                        "fields": [
                            {
                                "internalName": "evaluation",
                                "label": "Evaluation",
                                "type": "status",
                                "required": True,
                                "options": [
                                    {"value": "GREEN", "label": "GREEN"},
                                    {"value": "RED", "label": "RED"},
                                ],
                                "defaultValue": "GREEN",
                            }
                        ],
                    }
                ],
            }
        ],
    }
    tmpl = await service.create_template(
        CreateTemplateRequest(
            code="VALID_SELECT",
            name="Valid Select",
            version="1.0",
            status="PUBLISHED",
            schema_json=valid_schema,
        )
    )
    assert tmpl is not None
    assert tmpl.status == "PUBLISHED"


class TestImportTemplateJsonEndpoint:
    @pytest.mark.asyncio
    async def test_import_hierarchical_json_creates_template(self, tmp_path):
        engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

        async def override_get_db():
            async with async_session() as session:
                yield session

        mock_user = User(
            id=uuid.UUID("00000000-0000-0000-0000-000000000001"),
            email="testuser@example.com",
            role="admin",
            is_active=True,
        )
        app.dependency_overrides[get_current_active_user] = lambda: mock_user
        app.dependency_overrides[get_db] = override_get_db
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
                res = await ac.post("/api/v1/templates/import", json=HIERARCHICAL_STRUCTURE_JSON)
                assert res.status_code == 200, f"Import failed: {res.text}"
                body = res.json()
                assert body["code"] == "CMF_SUPPLIER"
                assert body["name"] == "CMF Supplier Management"
                schema = body["schema_json"]
                assert len(schema["sections"]) == 3
                assert schema["fieldCount"] == 11
                assert len(schema["relationships"]) == 2

                # Appears in the templates listing (reusable Structure, no project)
                listed = await ac.get("/api/v1/templates")
                assert listed.status_code == 200
                codes = [t["code"] for t in listed.json()["items"]]
                assert "CMF_SUPPLIER" in codes
        finally:
            app.dependency_overrides.clear()
            await engine.dispose()

    @pytest.mark.asyncio
    async def test_import_invalid_json_returns_structured_error(self):
        engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

        async def override_get_db():
            async with async_session() as session:
                yield session

        mock_user = User(
            id=uuid.UUID("00000000-0000-0000-0000-000000000001"),
            email="testuser@example.com",
            role="admin",
            is_active=True,
        )
        app.dependency_overrides[get_current_active_user] = lambda: mock_user
        app.dependency_overrides[get_db] = override_get_db
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
                res = await ac.post("/api/v1/templates/import", json={"modules": "not_a_list"})
                assert res.status_code == 400, f"Expected 400, got {res.status_code}: {res.text}"
                body = res.json()
                assert "error" in body and "message" in body["error"]
        finally:
            app.dependency_overrides.clear()
            await engine.dispose()