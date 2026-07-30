"""
Tests for CMF K0 project template: seeding, creation restrictions, role field
boundaries, and workflow step progression.
"""
import pytest
import pytest_asyncio
from app.application.services.template_service import TemplateService
from app.application.services.project_service import (
    ProjectService,
    K0_BUYER_FIELDS,
    K0_CAPACITY_FIELDS,
    K0_SQD_FIELDS,
    calculate_workflow_step,
)
from app.application.dto.projects import CreateProjectRequest, UpdateProjectRequest
from app.core.exceptions import ForbiddenException


# ---------------------------------------------------------------------------
# Template seeding
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_k0_template_seeded(unit_of_work):
    """K0 template must be auto-seeded into the database."""
    svc = TemplateService(unit_of_work)
    await svc.seed_template_by_code("K0", "k0_template.json")
    tmpl = await unit_of_work.templates.get_by_code("K0")
    assert tmpl is not None
    assert tmpl.code == "K0"
    assert tmpl.status == "PUBLISHED"
    # Verify all 3 sections exist in schema
    sections = {s["id"] for s in tmpl.schema_json.get("sections", [])}
    assert "sec_buyer" in sections
    assert "sec_capacity_manager" in sections
    assert "sec_sqd" in sections


# ---------------------------------------------------------------------------
# Creation restrictions
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_k0_creation_forbidden_for_non_buyer(unit_of_work):
    """Capacity Manager and SQD roles must NOT be able to create K0 projects."""
    svc = TemplateService(unit_of_work)
    await svc.seed_template_by_code("K0", "k0_template.json")
    tmpl = await unit_of_work.templates.get_by_code("K0")

    proj_svc = ProjectService(unit_of_work)
    payload = CreateProjectRequest(
        name="Test K0 Part",
        template_id=str(tmpl.id),
        template_version=tmpl.version,
    )

    for forbidden_role in ("capacity_manager", "sqd", "viewer"):
        with pytest.raises(ForbiddenException):
            await proj_svc.create_project(payload, user_role=forbidden_role)


@pytest.mark.asyncio
async def test_k0_creation_allowed_for_buyer_and_admin(unit_of_work):
    """Buyer and Admin roles must be able to create K0 projects."""
    svc = TemplateService(unit_of_work)
    await svc.seed_template_by_code("K0", "k0_template.json")
    tmpl = await unit_of_work.templates.get_by_code("K0")

    proj_svc = ProjectService(unit_of_work)

    for allowed_role in ("buyer", "admin"):
        payload = CreateProjectRequest(
            name=f"K0 Project by {allowed_role}",
            template_id=str(tmpl.id),
            template_version=tmpl.version,
        )
        project = await proj_svc.create_project(payload, user_role=allowed_role)
        assert project is not None
        assert project.name == f"K0 Project by {allowed_role}"


# ---------------------------------------------------------------------------
# Role field boundary enforcement
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_k0_buyer_cannot_edit_capacity_or_sqd_fields(unit_of_work):
    """Buyer must not be allowed to edit K0 Capacity or SQD fields."""
    svc = TemplateService(unit_of_work)
    await svc.seed_template_by_code("K0", "k0_template.json")
    tmpl = await unit_of_work.templates.get_by_code("K0")

    proj_svc = ProjectService(unit_of_work)
    project = await proj_svc.create_project(
        CreateProjectRequest(
            name="K0 Boundary Test",
            template_id=str(tmpl.id),
            template_version=tmpl.version,
        ),
        user_role="buyer",
    )

    # Pick one field from each non-buyer section
    for restricted_field in ("contracted_capacity", "cat_rating"):
        with pytest.raises(ForbiddenException):
            await proj_svc.update_project(
                project.id,
                UpdateProjectRequest(data={restricted_field: "test_value"}),
                user_role="buyer",
            )


@pytest.mark.asyncio
async def test_k0_capacity_manager_cannot_edit_buyer_or_sqd_fields(unit_of_work):
    """Capacity Manager must not be allowed to edit K0 Buyer or SQD fields."""
    svc = TemplateService(unit_of_work)
    await svc.seed_template_by_code("K0", "k0_template.json")
    tmpl = await unit_of_work.templates.get_by_code("K0")

    proj_svc = ProjectService(unit_of_work)
    project = await proj_svc.create_project(
        CreateProjectRequest(
            name="K0 Cap Boundary Test",
            template_id=str(tmpl.id),
            template_version=tmpl.version,
        ),
        user_role="buyer",
    )

    for restricted_field in ("part_number", "cat_rating"):
        with pytest.raises(ForbiddenException):
            await proj_svc.update_project(
                project.id,
                UpdateProjectRequest(data={restricted_field: "test_value"}),
                user_role="capacity_manager",
            )


@pytest.mark.asyncio
async def test_k0_sqd_cannot_edit_buyer_or_capacity_fields(unit_of_work):
    """SQD must not be allowed to edit K0 Buyer or Capacity fields."""
    svc = TemplateService(unit_of_work)
    await svc.seed_template_by_code("K0", "k0_template.json")
    tmpl = await unit_of_work.templates.get_by_code("K0")

    proj_svc = ProjectService(unit_of_work)
    project = await proj_svc.create_project(
        CreateProjectRequest(
            name="K0 SQD Boundary Test",
            template_id=str(tmpl.id),
            template_version=tmpl.version,
        ),
        user_role="buyer",
    )

    for restricted_field in ("part_name", "contracted_capacity"):
        with pytest.raises(ForbiddenException):
            await proj_svc.update_project(
                project.id,
                UpdateProjectRequest(data={restricted_field: "test_value"}),
                user_role="sqd",
            )


# ---------------------------------------------------------------------------
# Workflow step progression
# ---------------------------------------------------------------------------

def test_k0_workflow_step_logic():
    """Verify K0 workflow step calculation independent of the database."""
    # Step 1: no data
    assert calculate_workflow_step({}, "K0") == 1

    # Step 2: capacity field filled
    assert calculate_workflow_step({"weekly_capacity_requested_gst": 4000}, "K0") == 2
    assert calculate_workflow_step({"contracted_capacity": 4500}, "K0") == 2

    # Step 3: SQD data present but rating not GREEN
    assert calculate_workflow_step({"sqvl": "John", "cat_rating": "ORANGE"}, "K0") == 3

    # Step 4: SQD present and rating is GREEN
    assert calculate_workflow_step({"sqvl": "John", "cat_rating": "GREEN"}, "K0") == 4


def test_k0_field_sets_do_not_overlap():
    """Buyer, Capacity, and SQD field sets for K0 must be disjoint."""
    buyer_cap = K0_BUYER_FIELDS & K0_CAPACITY_FIELDS
    buyer_sqd = K0_BUYER_FIELDS & K0_SQD_FIELDS
    cap_sqd = K0_CAPACITY_FIELDS & K0_SQD_FIELDS
    assert not buyer_cap, f"Overlap between Buyer and Capacity: {buyer_cap}"
    assert not buyer_sqd, f"Overlap between Buyer and SQD: {buyer_sqd}"
    assert not cap_sqd, f"Overlap between Capacity and SQD: {cap_sqd}"
