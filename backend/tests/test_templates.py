import pytest
from app.application.services.template_service import TemplateService
from app.application.services.project_service import ProjectService
from app.application.dto.templates import CreateTemplateRequest
from app.application.dto.projects import CreateProjectRequest


@pytest.mark.asyncio
async def test_seed_does_not_resurrect_deleted_template(unit_of_work):
    service = TemplateService(unit_of_work)
    created = await service.create_template(
        CreateTemplateRequest(
            code="CUSTOM_TEST_TMPL",
            name="Custom Template",
            version="1.0",
            status="PUBLISHED",
            schema_json={"sections": []},
        )
    )
    assert created is not None

    # Simulate the user deleting the custom template from the UI.
    await service.delete_template(created.id)
    assert await unit_of_work.templates.get_by_code_including_deleted("CUSTOM_TEST_TMPL") is not None

    # Seeding should not bring back deleted custom template
    listed = await service.get_templates()
    codes = [t.code for t in listed.items]
    assert "CUSTOM_TEST_TMPL" not in codes


@pytest.mark.asyncio
async def test_seed_then_recreate_via_create_template(unit_of_work):
    service = TemplateService(unit_of_work)
    created = await service.create_template(
        CreateTemplateRequest(
            code="CUSTOM_TEST_TMPL_2",
            name="Custom Template 2",
            version="1.0",
            status="PUBLISHED",
            schema_json={"sections": []},
        )
    )
    await service.delete_template(created.id)

    # Recreating the code via create_template must revive the soft-deleted row
    # (no UNIQUE constraint violation) and keep it visible.
    revived = await service.create_template(
        CreateTemplateRequest(
            code="CUSTOM_TEST_TMPL_2",
            name="Custom Template 2 Recreated",
            version="1.0",
            status="DRAFT",
            schema_json={"sections": []},
        )
    )
    assert revived.id == created.id
    assert await unit_of_work.templates.get_by_code("CUSTOM_TEST_TMPL_2") is not None

    listed = await service.get_templates()
    codes = [t.code for t in listed.items]
    assert "CUSTOM_TEST_TMPL_2" in codes


@pytest.mark.asyncio
async def test_delete_template_soft_deletes_dependent_projects(unit_of_work):
    tservice = TemplateService(unit_of_work)
    pservice = ProjectService(unit_of_work)

    tmpl = await tservice.create_template(
        CreateTemplateRequest(
            code="CUSTOM_TEST_TMPL_3",
            name="Custom Template 3",
            version="1.0",
            status="PUBLISHED",
            schema_json={"sections": []},
        )
    )
    project = await pservice.create_project(
        CreateProjectRequest(code="CUST-P1", name="Custom Project", template_id=str(tmpl.id)),
        user_role="admin",
    )
    assert await unit_of_work.projects.get_by_code("CUST-P1") is not None

    await tservice.delete_template(tmpl.id)

    # Dependent project must be soft-deleted together with its structure.
    assert await unit_of_work.projects.get_by_code_including_deleted("CUST-P1") is not None
    assert await unit_of_work.projects.get_by_code("CUST-P1") is None


@pytest.mark.asyncio
async def test_k9_template_validation():
    # Test sample validation rule logic
    template_schema = {
        "sections": [
            {
                "groups": [
                    {
                        "fields": [
                            {
                                "internalName": "project_name",
                                "label": "Project Name",
                                "required": True,
                                "validation": {"type": "minLength", "value": 3}
                            },
                            {
                                "internalName": "duns_number",
                                "label": "DUNS Number",
                                "required": False,
                                "validation": {"type": "regex", "value": "^[0-9]{9}$"}
                            }
                        ]
                    }
                ]
            }
        ]
    }

    service = TemplateService(uow=None)

    # Missing required field
    errors = service.validate_project_data(template_schema, {})
    assert len(errors) == 1
    assert "required" in errors[0]

    # Valid field
    errors_valid = service.validate_project_data(template_schema, {"project_name": "K9 SUV", "duns_number": "123456789"})
    assert len(errors_valid) == 0

    # Invalid regex field
    errors_invalid_duns = service.validate_project_data(template_schema, {"project_name": "K9 SUV", "duns_number": "ABC"})
    assert len(errors_invalid_duns) == 1
    assert "format is invalid" in errors_invalid_duns[0]
