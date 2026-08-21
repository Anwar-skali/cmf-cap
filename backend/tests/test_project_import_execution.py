"""
Test suite verifying Project Excel Import Execution (CREATE, UPDATE, RESTORE).

Covers all 10 scenarios:
- TEST 1: Import a brand-new project (imported: 1)
- TEST 2: Import the same project again (updated: 1, no duplicates)
- TEST 3: Modify one field in Excel and import again (updated: 1, field value updated in DB)
- TEST 4: Create project, soft-delete it, then import it again (restored + updated: 1, skipped: 0)
- TEST 5: Import same deleted project twice (1st: updated: 1, 2nd: updated: 1, 1 DB row)
- TEST 6: Import 678-row Excel twice (1st: 678 imported; 2nd: 678 updated; 0 skipped, 0 failed)
- TEST 7: Invalid row with missing project identifier (skipped: 1 with explicit reason)
- TEST 8: Verify normal /projects listing does not show deleted projects
- TEST 9: Verify importing a deleted project makes it visible again in listing
- TEST 10: Query database and verify unique project identifiers integrity
"""
import io
import uuid
import pytest
import openpyxl
from sqlalchemy import select

from app.application.services.import_engine_service import ImportEngineService
from app.application.services.project_service import ProjectService
from app.application.dto.projects import CreateProjectRequest, ProjectFilter
from app.infrastructure.persistence.models.project import Project as ProjectModel


def _build_excel_file(headers: list[str], rows: list[list[any]], sheet_name: str = "Projects") -> bytes:
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = sheet_name
    ws.append(headers)
    for r in rows:
        ws.append(r)
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


@pytest.mark.asyncio
async def test_1_import_new_project_creates_record(unit_of_work):
    """TEST 1: Import a brand-new project -> imported += 1"""
    import_service = ImportEngineService(unit_of_work)
    file_bytes = _build_excel_file(
        headers=["Project Code", "Project Name", "Description", "Status"],
        rows=[["PRJ-NEW-001", "Alpha Vehicle", "Initial chassis build", "active"]],
    )

    mapping = {
        "Project Code": "code",
        "Project Name": "name",
        "Description": "description",
        "Status": "status",
    }

    result = await import_service.execute_import(
        file_bytes=file_bytes,
        file_name="new_project.xlsx",
        entity_type="projects",
        column_mapping=mapping,
        mode="insert",
    )

    assert result["imported_count"] == 1
    assert result["updated_count"] == 0
    assert result["skipped_count"] == 0
    assert result["failed_count"] == 0

    # Verify DB state
    project = await unit_of_work.projects.get_by_code("PRJ-NEW-001")
    assert project is not None
    assert project.name == "Alpha Vehicle"
    assert project.deleted_at is None


@pytest.mark.asyncio
async def test_2_import_same_project_again_updates_record(unit_of_work):
    """TEST 2: Import the same project again -> updated += 1, no duplicate"""
    import_service = ImportEngineService(unit_of_work)
    file_bytes = _build_excel_file(
        headers=["Project Code", "Project Name", "Description"],
        rows=[["PRJ-DUP-001", "Beta Vehicle", "Version 1.0"]],
    )
    mapping = {"Project Code": "code", "Project Name": "name", "Description": "description"}

    # 1st import
    res1 = await import_service.execute_import(
        file_bytes=file_bytes,
        file_name="project.xlsx",
        entity_type="projects",
        column_mapping=mapping,
        mode="insert",
    )
    assert res1["imported_count"] == 1
    assert res1["updated_count"] == 0

    # 2nd import of same file
    res2 = await import_service.execute_import(
        file_bytes=file_bytes,
        file_name="project.xlsx",
        entity_type="projects",
        column_mapping=mapping,
        mode="insert",
    )
    assert res2["imported_count"] == 0
    assert res2["updated_count"] == 1
    assert res2["skipped_count"] == 0
    assert res2["failed_count"] == 0

    # Confirm only 1 record exists in DB
    stmt = select(ProjectModel).where(ProjectModel.code == "PRJ-DUP-001")
    res = await unit_of_work.session.execute(stmt)
    all_matching = res.scalars().all()
    assert len(all_matching) == 1


@pytest.mark.asyncio
async def test_3_modify_field_and_import_again(unit_of_work):
    """TEST 3: Modify one field in Excel and import again -> updated += 1, DB field changes"""
    import_service = ImportEngineService(unit_of_work)
    mapping = {"Project Code": "code", "Project Name": "name", "Description": "description"}

    # 1st import: Old description
    file_v1 = _build_excel_file(
        headers=["Project Code", "Project Name", "Description"],
        rows=[["PRJ-MOD-001", "Gamma Car", "Old Description"]],
    )
    await import_service.execute_import(
        file_bytes=file_v1,
        file_name="gamma.xlsx",
        entity_type="projects",
        column_mapping=mapping,
        mode="insert",
    )

    p1 = await unit_of_work.projects.get_by_code("PRJ-MOD-001")
    assert p1.description == "Old Description"

    # 2nd import: New description
    file_v2 = _build_excel_file(
        headers=["Project Code", "Project Name", "Description"],
        rows=[["PRJ-MOD-001", "Gamma Car", "NEW Updated Description"]],
    )
    res2 = await import_service.execute_import(
        file_bytes=file_v2,
        file_name="gamma.xlsx",
        entity_type="projects",
        column_mapping=mapping,
        mode="insert",
    )
    assert res2["updated_count"] == 1
    assert res2["imported_count"] == 0

    p2 = await unit_of_work.projects.get_by_code("PRJ-MOD-001")
    assert p2.description == "NEW Updated Description"
    assert p2.id == p1.id  # ID preserved


@pytest.mark.asyncio
async def test_4_soft_deleted_project_restores_and_updates(unit_of_work):
    """TEST 4: Create project, soft-delete it, then import it again -> restored + updated (updated: 1, skipped: 0)"""
    project_service = ProjectService(unit_of_work)
    import_service = ImportEngineService(unit_of_work)

    # 1. Create project
    created = await project_service.create_project(
        CreateProjectRequest(code="PRJ-DEL-001", name="Delete Me Project", description="Before delete")
    )
    created_id = created.id

    # 2. Soft-delete project
    del_ok = await project_service.delete_project(created_id)
    assert del_ok is True

    # Confirm soft-deleted
    stmt = select(ProjectModel).where(ProjectModel.id == created_id)
    res = await unit_of_work.session.execute(stmt)
    stale_p = res.scalars().first()
    assert stale_p is not None
    assert stale_p.deleted_at is not None

    # 3. Import Excel containing this soft-deleted project
    file_bytes = _build_excel_file(
        headers=["Project Code", "Project Name", "Description"],
        rows=[["PRJ-DEL-001", "Delete Me Project Restored", "After restore description"]],
    )
    mapping = {"Project Code": "code", "Project Name": "name", "Description": "description"}

    result = await import_service.execute_import(
        file_bytes=file_bytes,
        file_name="restore_test.xlsx",
        entity_type="projects",
        column_mapping=mapping,
        mode="insert",
    )

    assert result["imported_count"] == 0
    assert result["updated_count"] == 1
    assert result["skipped_count"] == 0
    assert result["failed_count"] == 0

    # 4. Verify project is restored (deleted_at is None) and updated
    restored = await unit_of_work.projects.get_by_code("PRJ-DEL-001")
    assert restored is not None
    assert restored.id == created_id
    assert restored.deleted_at is None
    assert restored.name == "Delete Me Project Restored"
    assert restored.description == "After restore description"


@pytest.mark.asyncio
async def test_5_import_same_deleted_project_twice(unit_of_work):
    """TEST 5: Import same deleted project twice -> 1st: updated: 1; 2nd: updated: 1; No duplicates"""
    project_service = ProjectService(unit_of_work)
    import_service = ImportEngineService(unit_of_work)

    created = await project_service.create_project(
        CreateProjectRequest(code="PRJ-TWICE-001", name="Twice Test")
    )
    await project_service.delete_project(created.id)

    file_bytes = _build_excel_file(
        headers=["Project Code", "Project Name"],
        rows=[["PRJ-TWICE-001", "Twice Test Restored"]],
    )
    mapping = {"Project Code": "code", "Project Name": "name"}

    # 1st import
    res1 = await import_service.execute_import(
        file_bytes=file_bytes,
        file_name="twice.xlsx",
        entity_type="projects",
        column_mapping=mapping,
        mode="insert",
    )
    assert res1["updated_count"] == 1

    # 2nd import
    res2 = await import_service.execute_import(
        file_bytes=file_bytes,
        file_name="twice.xlsx",
        entity_type="projects",
        column_mapping=mapping,
        mode="insert",
    )
    assert res2["updated_count"] == 1
    assert res2["imported_count"] == 0
    assert res2["skipped_count"] == 0

    # Confirm only 1 row in DB
    stmt = select(ProjectModel).where(ProjectModel.code == "PRJ-TWICE-001")
    res = await unit_of_work.session.execute(stmt)
    rows = res.scalars().all()
    assert len(rows) == 1
    assert rows[0].deleted_at is None


@pytest.mark.asyncio
async def test_6_import_678_rows_excel_twice_prevents_duplicates(unit_of_work):
    """TEST 6: Import 678-row Excel twice -> 1st: 678 imported; 2nd: 678 updated, total records = 678"""
    import_service = ImportEngineService(unit_of_work)

    data_rows = [
        [f"PRJ-678-{i:04d}", f"Vehicle Component Batch {i}", f"Desc {i}"]
        for i in range(1, 679)
    ]
    file_bytes = _build_excel_file(
        headers=["Project Code", "Project Name", "Description"],
        rows=data_rows,
    )
    mapping = {"Project Code": "code", "Project Name": "name", "Description": "description"}

    # 1st import: 678 imported
    res1 = await import_service.execute_import(
        file_bytes=file_bytes,
        file_name="large_678.xlsx",
        entity_type="projects",
        column_mapping=mapping,
        mode="insert",
    )
    assert res1["imported_count"] == 678
    assert res1["updated_count"] == 0
    assert res1["skipped_count"] == 0
    assert res1["failed_count"] == 0

    # 2nd import: 678 updated
    res2 = await import_service.execute_import(
        file_bytes=file_bytes,
        file_name="large_678.xlsx",
        entity_type="projects",
        column_mapping=mapping,
        mode="insert",
    )
    assert res2["imported_count"] == 0
    assert res2["updated_count"] == 678
    assert res2["skipped_count"] == 0
    assert res2["failed_count"] == 0

    # Verify total DB count is exactly 678
    stmt = select(ProjectModel)
    res = await unit_of_work.session.execute(stmt)
    all_projects = res.scalars().all()
    assert len(all_projects) == 678


@pytest.mark.asyncio
async def test_7_invalid_row_with_missing_identifier(unit_of_work):
    """TEST 7: Invalid row with missing project identifier -> skipped: 1 with explicit reason"""
    import_service = ImportEngineService(unit_of_work)
    file_bytes = _build_excel_file(
        headers=["Project Code", "Project Name"],
        rows=[
            ["PRJ-VALID-001", "Valid Project"],
            ["", "Invalid No Code Project"],
        ],
    )
    mapping = {"Project Code": "code", "Project Name": "name"}

    result = await import_service.execute_import(
        file_bytes=file_bytes,
        file_name="invalid_test.xlsx",
        entity_type="projects",
        column_mapping=mapping,
        mode="insert",
    )

    assert result["imported_count"] == 1
    assert result["skipped_count"] == 1
    assert len(result["skipped_details"]) > 0
    assert result["skipped_details"][0]["row_index"] == 2
    assert "reason" in result["skipped_details"][0]


@pytest.mark.asyncio
async def test_8_listing_hides_deleted_projects(unit_of_work):
    """TEST 8: Verify normal /projects listing does not show deleted projects"""
    project_service = ProjectService(unit_of_work)

    p1 = await project_service.create_project(CreateProjectRequest(code="PRJ-ACTIVE-01", name="Active One"))
    p2 = await project_service.create_project(CreateProjectRequest(code="PRJ-DELETE-02", name="To Delete"))

    # Delete p2
    await project_service.delete_project(p2.id)

    # Fetch listing via ProjectService (which backs /projects endpoint)
    listing = await project_service.get_projects(ProjectFilter())
    codes_in_listing = [p.code for p in listing.items]

    assert "PRJ-ACTIVE-01" in codes_in_listing
    assert "PRJ-DELETE-02" not in codes_in_listing


@pytest.mark.asyncio
async def test_9_importing_deleted_project_makes_it_visible_in_listing(unit_of_work):
    """TEST 9: Verify importing a deleted project makes it visible again in /projects listing"""
    project_service = ProjectService(unit_of_work)
    import_service = ImportEngineService(unit_of_work)

    # 1. Create and delete project
    p = await project_service.create_project(CreateProjectRequest(code="PRJ-RESHOW-001", name="Ghost Project"))
    await project_service.delete_project(p.id)

    # Confirm it's not in listing
    listing_before = await project_service.get_projects(ProjectFilter())
    assert "PRJ-RESHOW-001" not in [x.code for x in listing_before.items]

    # 2. Import Excel
    file_bytes = _build_excel_file(
        headers=["Project Code", "Project Name"],
        rows=[["PRJ-RESHOW-001", "Resurrected Project"]],
    )
    mapping = {"Project Code": "code", "Project Name": "name"}
    await import_service.execute_import(
        file_bytes=file_bytes,
        file_name="reshow.xlsx",
        entity_type="projects",
        column_mapping=mapping,
        mode="insert",
    )

    # 3. Listing now includes it
    listing_after = await project_service.get_projects(ProjectFilter())
    codes_after = [x.code for x in listing_after.items]
    assert "PRJ-RESHOW-001" in codes_after


@pytest.mark.asyncio
async def test_10_unique_project_identifiers_integrity(unit_of_work):
    """TEST 10: Query database and verify unique project identifiers integrity (no duplicate codes)"""
    import_service = ImportEngineService(unit_of_work)

    # Import multiple batches with overlaps
    batch1 = _build_excel_file(
        headers=["Project Code", "Project Name"],
        rows=[["PRJ-UNIQ-100", "Unique 100"], ["PRJ-UNIQ-200", "Unique 200"]],
    )
    batch2 = _build_excel_file(
        headers=["Project Code", "Project Name"],
        rows=[["PRJ-UNIQ-200", "Unique 200 Updated"], ["PRJ-UNIQ-300", "Unique 300"]],
    )
    mapping = {"Project Code": "code", "Project Name": "name"}

    await import_service.execute_import(
        file_bytes=batch1, file_name="b1.xlsx", entity_type="projects", column_mapping=mapping, mode="insert"
    )
    await import_service.execute_import(
        file_bytes=batch2, file_name="b2.xlsx", entity_type="projects", column_mapping=mapping, mode="insert"
    )

    # Query all project codes in DB
    stmt = select(ProjectModel.code)
    res = await unit_of_work.session.execute(stmt)
    all_codes = list(res.scalars().all())

    # Ensure no duplicates exist in DB
    assert len(all_codes) == len(set(all_codes))
    assert set(all_codes) == {"PRJ-UNIQ-100", "PRJ-UNIQ-200", "PRJ-UNIQ-300"}


async def _create_cmf_arch_template(unit_of_work):
    existing = await unit_of_work.templates.get_by_code("CMF_ARCH_TEST_V1")
    if existing:
        return existing
    template_data = {
        "code": "CMF_ARCH_TEST_V1",
        "name": "CMF Architecture Test V1",
        "description": "Multi-module structure with BUYER, CAPACITY, SQD",
        "version": "1.0",
        "schema_json": {
            "sections": [
                {
                    "id": "sec_buyer",
                    "title": "BUYER Module",
                    "groups": [
                        {
                            "id": "grp_buyer",
                            "title": "General Buyer Info",
                            "fields": [
                                {"id": "fld_1", "key": "project_code", "label": "Project Code", "required": True, "type": "string"},
                                {"id": "fld_2", "key": "project_name", "label": "Project Name", "required": True, "type": "string"},
                                {"id": "fld_3", "key": "customer", "label": "Customer", "required": False, "type": "string"},
                                {"id": "fld_4", "key": "project_status", "label": "Project Status", "required": False, "type": "string"},
                                {"id": "fld_5", "key": "start_date", "label": "Start Date", "required": False, "type": "date"},
                            ],
                        }
                    ],
                },
                {
                    "id": "sec_capacity",
                    "title": "CAPACITY Module",
                    "groups": [
                        {
                            "id": "grp_capacity",
                            "title": "Capacity Assessment",
                            "fields": [
                                {"id": "fld_6", "key": "forecast_week", "label": "Forecast Week", "required": False, "type": "integer"},
                                {"id": "fld_7", "key": "assessment_date", "label": "Assessment Date", "required": False, "type": "date"},
                                {"id": "fld_8", "key": "required_capacity", "label": "Required Capacity", "required": False, "type": "number"},
                                {"id": "fld_9", "key": "available_capacity", "label": "Available Capacity", "required": False, "type": "number"},
                                {"id": "fld_10", "key": "capacity_status", "label": "Capacity Status", "required": False, "type": "string"},
                            ],
                        }
                    ],
                },
                {
                    "id": "sec_sqd",
                    "title": "SQD Module",
                    "groups": [
                        {
                            "id": "grp_sqd",
                            "title": "Quality Details",
                            "fields": [
                                {"id": "fld_11", "key": "quality_score", "label": "Quality Score", "required": False, "type": "number"},
                                {"id": "fld_12", "key": "quality_status", "label": "Quality Status", "required": False, "type": "string"},
                                {"id": "fld_13", "key": "comments", "label": "Comments", "required": False, "type": "textarea"},
                            ],
                        }
                    ],
                },
            ]
        },
    }
    return await unit_of_work.templates.create(template_data)


@pytest.mark.asyncio
async def test_11_cmf_arch_test_v1_three_rows_import(unit_of_work):
    """TEST 11: 3-row import for custom structure (CMF_ARCH_TEST_V1) with modules (BUYER, CAPACITY, SQD) -> 3 imported, 0 skipped, 0 failed"""
    await _create_cmf_arch_template(unit_of_work)
    import_service = ImportEngineService(unit_of_work)

    # Build 3 Excel rows matching the exact user structure
    headers = [
        "project code", "project name", "customer", "project status",
        "start date", "forecast week", "assessment date", "comments",
        "required capacity", "available capacity", "capacity status",
        "quality score", "quality status"
    ]
    rows = [
        [
            "PRJ-ARCH-001", "Project Chassis Alpha", "OEM Stellantis", "active",
            "2026-03-01", 12, "2026-03-15", "Chassis module on track",
            1000, 1200, "OK", 95.5, "GREEN"
        ],
        [
            "PRJ-ARCH-002", "Project Battery Beta", "OEM Renault", "active",
            "2026-04-01", 14, "2026-04-10", "Battery pack prototype testing",
            500, 450, "WARNING", 88.0, "YELLOW"
        ],
        [
            "PRJ-ARCH-003", "Project Motor Gamma", "OEM BMW", "draft",
            "2026-05-01", 18, "2026-05-20", "E-motor stator winding",
            800, 800, "OK", 99.0, "GREEN"
        ],
    ]
    file_bytes = _build_excel_file(headers=headers, rows=rows)

    mapping = {
        "project code": "project_code",
        "project name": "project_name",
        "customer": "customer",
        "project status": "project_status",
        "start date": "start_date",
        "forecast week": "forecast_week",
        "assessment date": "assessment_date",
        "comments": "comments",
        "required capacity": "required_capacity",
        "available capacity": "available_capacity",
        "capacity status": "capacity_status",
        "quality score": "quality_score",
        "quality status": "quality_status",
    }

    # Execute import with custom structure entity_type CMF_ARCH_TEST_V1
    result = await import_service.execute_import(
        file_bytes=file_bytes,
        file_name="cmf_arch_test_v1.xlsx",
        entity_type="CMF_ARCH_TEST_V1",
        column_mapping=mapping,
        mode="insert",
    )

    # Assert exact 3-row import result
    assert result["imported_count"] == 3
    assert result["updated_count"] == 0
    assert result["skipped_count"] == 0
    assert result["failed_count"] == 0
    assert result["total_rows"] == 3

    # Verify all 3 projects exist in the database with their custom module data
    p1 = await unit_of_work.projects.get_by_code("PRJ-ARCH-001")
    assert p1 is not None
    assert p1.name == "Project Chassis Alpha"
    assert p1.client_name == "OEM Stellantis"
    assert p1.data.get("required_capacity") == 1000
    assert p1.data.get("quality_score") == 95.5

    p2 = await unit_of_work.projects.get_by_code("PRJ-ARCH-002")
    assert p2 is not None
    assert p2.name == "Project Battery Beta"
    assert p2.client_name == "OEM Renault"
    assert p2.data.get("capacity_status") == "WARNING"

    p3 = await unit_of_work.projects.get_by_code("PRJ-ARCH-003")
    assert p3 is not None
    assert p3.name == "Project Motor Gamma"
    assert p3.client_name == "OEM BMW"


@pytest.mark.asyncio
async def test_12_cmf_arch_test_v1_three_rows_second_import_updates(unit_of_work):
    """TEST 12: Importing same 3 rows again updates the existing records without duplicates"""
    await _create_cmf_arch_template(unit_of_work)
    import_service = ImportEngineService(unit_of_work)

    headers = ["project code", "project name", "customer", "required capacity"]
    rows = [
        ["PRJ-ARCH-001", "Project Chassis Alpha V2", "OEM Stellantis", 1500],
        ["PRJ-ARCH-002", "Project Battery Beta V2", "OEM Renault", 600],
        ["PRJ-ARCH-003", "Project Motor Gamma V2", "OEM BMW", 900],
    ]
    file_bytes = _build_excel_file(headers=headers, rows=rows)
    mapping = {
        "project code": "project_code",
        "project name": "project_name",
        "customer": "customer",
        "required capacity": "required_capacity",
    }

    # 1st import: creates 3
    res1 = await import_service.execute_import(
        file_bytes=file_bytes,
        file_name="arch_v1.xlsx",
        entity_type="CMF_ARCH_TEST_V1",
        column_mapping=mapping,
        mode="insert",
    )
    assert res1["imported_count"] == 3
    assert res1["updated_count"] == 0

    # 2nd import: updates 3
    res2 = await import_service.execute_import(
        file_bytes=file_bytes,
        file_name="arch_v1.xlsx",
        entity_type="CMF_ARCH_TEST_V1",
        column_mapping=mapping,
        mode="insert",
    )
    assert res2["imported_count"] == 0
    assert res2["updated_count"] == 3
    assert res2["skipped_count"] == 0
    assert res2["failed_count"] == 0

    p1 = await unit_of_work.projects.get_by_code("PRJ-ARCH-001")
    assert p1.name == "Project Chassis Alpha V2"
    assert p1.data.get("required_capacity") == 1500


@pytest.mark.asyncio
async def test_13_cmf_arch_test_v1_invalid_row_explicit_skip(unit_of_work):
    """TEST 13: Invalid row with empty project code is skipped with explicit reason and message"""
    await _create_cmf_arch_template(unit_of_work)
    import_service = ImportEngineService(unit_of_work)

    headers = ["project code", "project name"]
    rows = [
        ["PRJ-VALID-010", "Valid Project"],
        ["", "Invalid No Code Project"],
    ]
    file_bytes = _build_excel_file(headers=headers, rows=rows)
    mapping = {"project code": "project_code", "project name": "project_name"}

    result = await import_service.execute_import(
        file_bytes=file_bytes,
        file_name="test_invalid.xlsx",
        entity_type="CMF_ARCH_TEST_V1",
        column_mapping=mapping,
        mode="insert",
    )

    assert result["imported_count"] == 1
    assert result["skipped_count"] == 1
    assert len(result["skipped_details"]) > 0
    assert result["skipped_details"][0]["row_index"] == 2
    assert result["skipped_details"][0]["reason"] in ("Ignored non-record row", "Missing unique identifier")


