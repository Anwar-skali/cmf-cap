import pytest
import uuid
from app.application.services.project_service import ProjectService
from app.application.services.template_service import TemplateService
from app.application.dto.projects import CreateProjectRequest, UpdateProjectRequest
from app.core.exceptions import ForbiddenException


@pytest.mark.asyncio
async def test_k9_template_seeding(unit_of_work):
    service = TemplateService(unit_of_work)
    k9 = await service.seed_k9_if_missing()
    assert k9 is not None
    assert k9.code == "K9"
    assert k9.version == "2.0"
    sections = k9.schema_json.get("sections", [])
    section_ids = [s.get("id") for s in sections]
    assert "sec_buyer text" != ""
    assert "sec_buyer" in section_ids
    assert "sec_capacity_manager" in section_ids
    assert "sec_sqd" in section_ids


@pytest.mark.asyncio
async def test_k9_project_creation_permissions(unit_of_work):
    tmpl_service = TemplateService(unit_of_work)
    k9 = await tmpl_service.seed_k9_if_missing()

    prj_service = ProjectService(unit_of_work)

    # Non-capacity_manager roles should fail to create K9 project
    with pytest.raises(ForbiddenException):
        await prj_service.create_project(
            CreateProjectRequest(
                name="K9 Test Vehicle",
                template_id=k9.id,
                data={"unique_id": "K9-TEST-001", "part_name": "Door Panel"},
            ),
            user_role="buyer",
        )

    # Capacity Manager role should succeed
    prj = await prj_service.create_project(
        CreateProjectRequest(
            name="K9 Test Vehicle",
            template_id=k9.id,
            data={"unique_id": "K9-TEST-001", "gst_no": "GST-001"},
        ),
        user_role="capacity_manager",
    )
    assert prj is not None
    assert prj.data.get("workflow_step") == 2


@pytest.mark.asyncio
async def test_k9_role_field_update_restrictions(unit_of_work):
    tmpl_service = TemplateService(unit_of_work)
    k9 = await tmpl_service.seed_k9_if_missing()
    prj_service = ProjectService(unit_of_work)

    # 1. Capacity Manager creates project
    prj = await prj_service.create_project(
        CreateProjectRequest(
            name="K9 Component Project",
            template_id=k9.id,
            data={"gst_no": "K9-COMP-001", "capacity": 3000},
        ),
        user_role="capacity_manager",
    )

    # 2. Capacity Manager tries editing SQD field -> should be forbidden
    with pytest.raises(ForbiddenException):
        await prj_service.update_project(
            prj.id,
            UpdateProjectRequest(data={"cat_evaluation": "GREEN"}),
            user_role="capacity_manager",
        )

    # 3. Capacity Manager updates Capacity field -> allowed, workflow step becomes 2
    updated_cap = await prj_service.update_project(
        prj.id,
        UpdateProjectRequest(data={"capacity": 5000, "contracted_capacity": 4800}),
        user_role="capacity_manager",
    )
    assert updated_cap.data.get("capacity") == 5000
    assert updated_cap.data.get("workflow_step") == 2

    # 4. SQD tries editing Buyer field -> forbidden
    with pytest.raises(ForbiddenException):
        await prj_service.update_project(
            prj.id,
            UpdateProjectRequest(data={"part_name": "Tampered Name"}),
            user_role="sqd",
        )

    # 5. SQD updates CAT evaluation GREEN -> allowed, workflow step becomes 4 (Completed)
    updated_sqd = await prj_service.update_project(
        prj.id,
        UpdateProjectRequest(data={"cat_evaluation": "GREEN", "weekly_capacity_measured": 4800}),
        user_role="sqd",
    )
    assert updated_sqd.data.get("cat_evaluation") == "GREEN"
    assert updated_sqd.data.get("workflow_step") == 4
    assert updated_sqd.status == "completed"
