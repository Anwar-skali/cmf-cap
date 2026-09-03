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
async def test_k0_creation_forbidden_for_non_capacity_manager(unit_of_work):
    """Buyer, SQD, and Viewer roles must NOT be able to create K0 projects."""
    svc = TemplateService(unit_of_work)
    await svc.seed_template_by_code("K0", "k0_template.json")
    tmpl = await unit_of_work.templates.get_by_code("K0")

    proj_svc = ProjectService(unit_of_work)
    payload = CreateProjectRequest(
        name="Test K0 Part",
        template_id=str(tmpl.id),
        template_version=tmpl.version,
    )

    for forbidden_role in ("buyer", "sqd", "viewer"):
        with pytest.raises(ForbiddenException):
            await proj_svc.create_project(payload, user_role=forbidden_role)


@pytest.mark.asyncio
async def test_k0_creation_allowed_for_capacity_manager_and_admin(unit_of_work):
    """Capacity Manager and Admin roles must be able to create K0 projects."""
    svc = TemplateService(unit_of_work)
    await svc.seed_template_by_code("K0", "k0_template.json")
    tmpl = await unit_of_work.templates.get_by_code("K0")

    proj_svc = ProjectService(unit_of_work)

    for allowed_role in ("capacity_manager", "admin"):
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
        user_role="capacity_manager",
    )

    # Buyer must NOT be able to edit Capacity Manager or SQD fields
    for restricted_field in ("week_project_target_1", "quality"):
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
        user_role="capacity_manager",
    )

    # Capacity Manager must NOT be able to edit Buyer or SQD fields
    for restricted_field in ("part_number", "quality"):
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
        user_role="capacity_manager",
    )

    # SQD must NOT be able to edit Buyer or Capacity fields
    for restricted_field in ("part_number", "week_project_target_1"):
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
    # Step 1: no data at all
    assert calculate_workflow_step({}, "K0") == 1

    # Step 1: only buyer fields (no Capacity Manager fields filled)
    assert calculate_workflow_step({"part_number": "9876895380", "supplier_name": "LIGOO"}, "K0") == 1

    # Step 2: a Capacity Manager field is filled
    assert calculate_workflow_step({"week_project_target_1": 202624}, "K0") == 2
    assert calculate_workflow_step({"forecast_week_1": "202548"}, "K0") == 2
    assert calculate_workflow_step({"completed_week_2": "202548"}, "K0") == 2

    # Step 3: SQD field present but quality is not GREEN
    assert calculate_workflow_step({"quality": "ORANGE", "minimum_quality_status_acted": "NOT ACTED"}, "K0") == 3
    assert calculate_workflow_step({"rcpi": "some_value", "quality": "RED"}, "K0") == 3

    # Step 4: SQD field present and quality is GREEN (or unset = defaults GREEN)
    assert calculate_workflow_step({"quality": "GREEN", "minimum_quality_status_acted": "ACTED"}, "K0") == 4
    assert calculate_workflow_step({"manufacturing_process_validated": "YES", "quality": "GREEN"}, "K0") == 4


def test_k0_field_sets_do_not_overlap():
    """Buyer, Capacity, and SQD field sets for K0 must be disjoint."""
    buyer_cap = K0_BUYER_FIELDS & K0_CAPACITY_FIELDS
    buyer_sqd = K0_BUYER_FIELDS & K0_SQD_FIELDS
    cap_sqd = K0_CAPACITY_FIELDS & K0_SQD_FIELDS
    assert not buyer_cap, f"Overlap between Buyer and Capacity: {buyer_cap}"
    assert not buyer_sqd, f"Overlap between Buyer and SQD: {buyer_sqd}"
    assert not cap_sqd, f"Overlap between Capacity and SQD: {cap_sqd}"


def test_k0_source_column_count():
    """K0 source columns list must have exactly 47 entries (Columns A-AU)."""
    from app.application.services.import_engine_service import K0_SOURCE_COLUMNS, K0_SOURCE_COLUMN_COUNT
    assert len(K0_SOURCE_COLUMNS) == 47
    assert K0_SOURCE_COLUMN_COUNT == 47
    # Verify the mapping starts with part_number and ends with manufacturing_process_validated
    assert K0_SOURCE_COLUMNS[0] == "part_number"                       # Column A (idx=0)
    assert K0_SOURCE_COLUMNS[25] == "week_project_target_2"            # Column Z (idx=25)
    assert K0_SOURCE_COLUMNS[46] == "manufacturing_process_validated"  # Column AU (idx=46)


def test_k0_index_mapping_no_collisions():
    """_build_k0_index_mapping must return 47 unique field keys with no collisions."""
    from app.application.services.import_engine_service import (
        _build_k0_index_mapping,
        K0_SOURCE_COLUMN_COUNT,
        K0_SOURCE_COLUMNS,
    )
    # Simulate the actual K0 Excel Row 8 headers (47 columns)
    simulated_headers = [
        "Part Number", "Index", "Description", "Coef.", "Serial Piece Price",
        "Mass Purchase\n(Coef. x Price per part)", "RU", "NOA",
        "Make Battery (LP)", "Make Battery (LP)",  # cols I & J share the same header
        "#REF!", "#REF!", "#REF!", "#REF!", "libre",
        "Supplier name", "Vendor COFOR", "Manufacturer COFOR", "Combined COFOR",
        "Tango order", "EI status", "Comments",
        "Week\nProject Target", "Forecast\nWeek", "Completed\nWeek",  # cols W, X, Y
        "Week\nProject Target", "Forecast\nWeek", "Completed\nWeek",  # cols Z, AA, AB
        "Week\nProject Target", "Forecast\nWeek", "Completed\nWeek",  # cols AC, AD, AE
        "Quality", "Supply Chain", "Global Purchasing", "CPL", "RCPI",
        "Minimum Quality status acted", "Mass inquired",
        "Packaging readiness, UNLweb \nvalidated", "TANGO contract validated",
        "Supplier capability confirmed", "IT CPL (CORAIL,) setting",
        "FCLA Validates", "PLE created", "EDI opened",
        "UM logistic flow validated", "Manufacturing process validated",
    ]
    index_map = _build_k0_index_mapping(simulated_headers)

    # Must cover exactly 47 columns
    assert len(index_map) == K0_SOURCE_COLUMN_COUNT

    # 42 mapped field keys + None for the 5 dead columns (#REF! and libre)
    mapped_keys = [v for v in index_map.values() if v is not None]
    assert len(mapped_keys) == 42
    assert len(set(mapped_keys)) == 42

    # Columns K..O (10..14) are dead/empty columns (#REF! and libre)
    for dead_idx in (10, 11, 12, 13, 14):
        assert index_map[dead_idx] is None

    # Columns 8 (I) and 9 (J) must map to the two distinct LP fields
    assert index_map[8] == "make_battery_lp_1"   # Col I (0-indexed: 8)
    assert index_map[9] == "make_battery_lp_2"   # Col J (0-indexed: 9)

    # Columns W, X, Y (0-indexed: 22, 23, 24) must map to milestone-1 fields
    assert index_map[22] == "week_project_target_1"
    assert index_map[23] == "forecast_week_1"
    assert index_map[24] == "completed_week_1"

    # Column Z, AA, AB (0-indexed: 25, 26, 27) must map to milestone-2 fields
    assert index_map[25] == "week_project_target_2"
    assert index_map[26] == "forecast_week_2"
    assert index_map[27] == "completed_week_2"

    # Column AC, AD, AE (0-indexed: 28, 29, 30) must map to milestone-3 fields
    assert index_map[28] == "week_project_target_3"
    assert index_map[29] == "forecast_week_3"
    assert index_map[30] == "completed_week_3"

    # Column AU (0-indexed: 46) must map to manufacturing_process_validated
    assert index_map[46] == "manufacturing_process_validated"

