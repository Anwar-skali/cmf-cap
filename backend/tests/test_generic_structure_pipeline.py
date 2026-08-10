import pytest
import uuid
from app.application.dto.projects import CreateProjectRequest, ProjectFilter
from app.application.services.project_service import ProjectService
from app.application.services.template_service import TemplateService
from app.application.services.import_engine_service import ImportEngineService

@pytest.mark.asyncio
async def test_generic_project_structure_pipeline(unit_of_work):
    uow = unit_of_work
    tmpl_svc = TemplateService(uow)
    await tmpl_svc.seed_k9_if_missing()

    # Get seed templates
    templates = await uow.templates.get_multi()
    assert len(templates) >= 2
    k0_tmpl = next((t for t in templates if t.code == "K0"), templates[0])
    k9_tmpl = next((t for t in templates if t.code == "K9"), templates[1])

    prj_svc = ProjectService(uow)

    # 1. Create project manually under K0 structure
    k0_project = await prj_svc.create_project(
        CreateProjectRequest(
            name="K0 Platform Assembly",
            code="K0-PRJ-TEST-001",
            template_id=str(k0_tmpl.id),
            template_version=k0_tmpl.version,
            data={"part_name": "K0 Front Chassis", "unique_id": "K0-PRJ-TEST-001"},
        )
    )
    assert str(k0_project.template_id) == str(k0_tmpl.id)

    # 2. Create project manually under K9 structure
    k9_project = await prj_svc.create_project(
        CreateProjectRequest(
            name="K9 EV Chassis",
            code="K9-PRJ-TEST-001",
            template_id=str(k9_tmpl.id),
            template_version=k9_tmpl.version,
            data={"part_name": "K9 Rear Axle", "unique_id": "K9-PRJ-TEST-001"},
        )
    )
    assert str(k9_project.template_id) == str(k9_tmpl.id)

    # 3. Verify filtering projects by template_id
    k0_filtered = await prj_svc.get_projects(ProjectFilter(template_id=k0_tmpl.id))
    assert k0_filtered.total == 1
    assert k0_filtered.items[0].code == "K0-PRJ-TEST-001"

    k9_filtered = await prj_svc.get_projects(ProjectFilter(template_id=k9_tmpl.id))
    assert k9_filtered.total == 1
    assert k9_filtered.items[0].code == "K9-PRJ-TEST-001"

    # 4. Verify import engine template lookup by UUID
    import_svc = ImportEngineService(uow)
    schema_by_uuid = await import_svc._get_schema(str(k0_tmpl.id))
    assert schema_by_uuid.display_name == k0_tmpl.name
