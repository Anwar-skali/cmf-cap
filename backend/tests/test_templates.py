import pytest
from app.application.services.template_service import TemplateService
from app.application.dto.templates import CreateTemplateRequest

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
