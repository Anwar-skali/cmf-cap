import pytest
from app.application.services.template_service import (
    TemplateService,
    role_field_sets_from_schema,
    _normalize_project_structure_json,
    _bucket_sections_into_roles,
)


def _hierarchical_json(fields: list[dict]) -> dict:
    return {
        "structure": {
            "code": "F_K0_MAKE_BATTERY_V1",
            "name": "K0 Make Battery CMF Project",
            "version": "1.0",
            "status": "DRAFT",
            "description": "Test structure - one module, one table",
        },
        "modules": [
            {
                "code": "BATTERY",
                "name": "Battery Module",
                "tables": [
                    {
                        "name": "battery_master",
                        "fields": fields,
                    }
                ],
            }
        ],
        "relationships": [],
    }


def _fields():
    return [
        {"name": "supplier_name", "label": "Supplier Name", "type": "text", "required": True},
        {"name": "supplier_location", "label": "Supplier Location", "type": "text"},
        {"name": "rfq_reference", "label": "RFQ Reference", "type": "text"},
        {"name": "price", "label": "Price", "type": "currency"},
        {"name": "currency", "label": "Currency", "type": "text"},
        {"name": "part_number", "label": "Part Number", "type": "text", "required": True},
        {"name": "part_name", "label": "Part Name", "type": "text", "required": True},
        {"name": "weekly_capacity", "label": "Weekly Capacity", "type": "integer", "required": True},
        {"name": "capacity_step", "label": "Capacity Step", "type": "text"},
        {"name": "contracted_capacity", "label": "Contracted Capacity", "type": "integer"},
        {"name": "shift_count", "label": "Shifts", "type": "integer"},
        {"name": "tooling_ref", "label": "Tooling Reference", "type": "text"},
        {"name": "sqe", "label": "SQE", "type": "user"},
        {"name": "sqm", "label": "SQM", "type": "user"},
        {"name": "apqp_grid", "label": "APQP Grid", "type": "text"},
        {"name": "cat_forecast_date", "label": "CAT Forecast Date", "type": "date"},
        {"name": "evaluation", "label": "Evaluation", "type": "status"},
        {"name": "project_name", "label": "Project Name", "type": "text"},
        {"name": "notes", "label": "Notes", "type": "textarea"},
    ]


def _flatten(result):
    out = {}
    for sec in result["sections"]:
        for grp in sec.get("groups", []):
            for fld in grp.get("fields", []):
                out[fld["internalName"]] = {"section": sec, "field": fld}
    return out


@pytest.mark.asyncio
async def test_hierarchical_import_builds_role_sections(unit_of_work):
    service = TemplateService(unit_of_work)
    created = await service.import_template_json(_hierarchical_json(_fields()))

    schema = created.schema_json
    sections = schema["sections"]
    section_ids = [s["id"] for s in sections]

    # The imported structure must expose the existing 3-role Manuel Project sections.
    assert "sec_buyer" in section_ids
    assert "sec_capacity_manager" in section_ids
    assert "sec_sqd" in section_ids

    # No field is lost during bucketing.
    flat = _flatten(schema)
    assert len(flat) == len(_fields())

    # Fields land under the correct role.
    assert flat["supplier_name"]["section"]["id"] == "sec_buyer"
    assert flat["price"]["section"]["id"] == "sec_buyer"
    assert flat["part_number"]["section"]["id"] == "sec_buyer"

    assert flat["weekly_capacity"]["section"]["id"] == "sec_capacity_manager"
    assert flat["contracted_capacity"]["section"]["id"] == "sec_capacity_manager"

    assert flat["sqe"]["section"]["id"] == "sec_sqd"
    assert flat["evaluation"]["section"]["id"] == "sec_sqd"

    # Unclassified fields fall into a General section and are still persisted.
    assert flat["project_name"]["section"]["id"] == "sec_general"
    assert flat["notes"]["section"]["id"] == "sec_general"

    # Role sections carry permissions for the role-based workflow.
    buyer_sec = next(s for s in sections if s["id"] == "sec_buyer")
    assert buyer_sec["permissions"]["rolesAllowedToEdit"] == ["buyer", "admin"]


@pytest.mark.asyncio
async def test_hierarchical_import_preserves_explicit_role(unit_of_work):
    fields = [
        {"name": "capacity", "label": "Capacity", "type": "integer", "role": "CAPACITY_MANAGER"},
        {"name": "quality_score", "label": "Quality Score", "type": "percentage",
         "permissions": {"rolesAllowedToEdit": ["sqd", "admin"]}},
        {"name": "supplier_name", "label": "Supplier Name", "type": "text",
         "permissions": {"rolesAllowedToEdit": ["buyer", "admin"]}},
    ]
    schema = _normalize_project_structure_json(_hierarchical_json(fields))
    flat = _flatten(schema)

    # Explicit `role` is honored above name heuristics.
    assert flat["capacity"]["section"]["id"] == "sec_capacity_manager"
    assert flat["capacity"]["field"]["permissions"]["rolesAllowedToEdit"] == ["capacity_manager", "admin"]

    # Explicit permissions are preserved and drive classification.
    assert flat["quality_score"]["section"]["id"] == "sec_sqd"
    assert flat["quality_score"]["field"]["permissions"]["rolesAllowedToEdit"] == ["sqd", "admin"]
    assert flat["supplier_name"]["section"]["id"] == "sec_buyer"


@pytest.mark.asyncio
async def test_flat_cmf_json_is_preserved(unit_of_work):
    # An already-role-sectioned CMF template (e.g. an existing structure) must be stored as-is.
    flat = {
        "code": "K0",
        "name": "CMF K0 Project Template",
        "version": "1.0",
        "status": "PUBLISHED",
        "sections": [
            {
                "id": "sec_buyer",
                "name": "Buyer",
                "permissions": {"rolesAllowedToEdit": ["buyer", "admin"]},
                "groups": [
                    {
                        "id": "grp_general_info",
                        "name": "General Information",
                        "fields": [
                            {"id": "fld_part_number", "internalName": "part_number", "label": "Part Number",
                             "type": "text", "required": True}
                        ],
                    }
                ],
            }
        ],
    }
    service = TemplateService(unit_of_work)
    created = await service.import_template_json(flat)
    assert created.schema_json["sections"][0]["id"] == "sec_buyer"
    assert created.schema_json["sections"][0]["permissions"]["rolesAllowedToEdit"] == ["buyer", "admin"]


@pytest.mark.asyncio
async def test_role_field_sets_from_schema():
    schema = _normalize_project_structure_json(_hierarchical_json(_fields()))

    sets = role_field_sets_from_schema(schema)
    assert "part_number" in sets["buyer"]
    assert "weekly_capacity" in sets["capacity_manager"]
    assert "evaluation" in sets["sqd"]
    assert "project_name" not in sets["sqd"]

    assert role_field_sets_from_schema(None) == {
        "buyer": set(), "capacity_manager": set(), "sqd": set()
    }