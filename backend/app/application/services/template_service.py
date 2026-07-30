from __future__ import annotations

import json
import re
import uuid
from pathlib import Path
from typing import Any

from app.application.dto.templates import (
    CreateTemplateRequest,
    TemplateListResponse,
    TemplateResponse,
    UpdateTemplateRequest,
)
from app.application.interfaces.services import IUnitOfWork
from app.core.exceptions import BadRequestException, ConflictException, NotFoundException


class TemplateService:
    def __init__(self, uow: IUnitOfWork) -> None:
        self._uow = uow

    async def seed_template_by_code(self, code: str, filename: str) -> Any:
        json_path = Path(__file__).parent.parent.parent / "domain" / filename
        if not json_path.exists():
            return None

        with open(json_path, "r", encoding="utf-8") as f:
            schema_json = json.load(f)

        file_version = schema_json.get("version", "1.0")
        existing = await self._uow.templates.get_by_code(code.upper())
        if existing is not None:
            if existing.version != file_version:
                updated = await self._uow.templates.update(
                    existing.id,
                    {
                        "name": schema_json.get("name", f"CMF {code} Project Template"),
                        "version": file_version,
                        "description": schema_json.get("description"),
                        "schema_json": schema_json,
                        "status": "PUBLISHED",
                    },
                )
                await self._uow.templates.create_version(
                    existing.id, file_version, schema_json, f"Updated to version {file_version}"
                )
                await self._uow.commit()
                return updated
            return existing

        template_data = {
            "code": code.upper(),
            "name": schema_json.get("name", f"CMF {code} Project Template"),
            "version": file_version,
            "status": "PUBLISHED",
            "description": schema_json.get("description", f"Default CMF {code} Template"),
            "schema_json": schema_json,
        }
        tmpl = await self._uow.templates.create(template_data)
        await self._uow.templates.create_version(tmpl.id, file_version, schema_json, "Initial seed version")
        await self._uow.commit()
        return tmpl

    async def seed_k9_if_missing(self) -> Any:
        await self.seed_template_by_code("K0", "k0_template.json")
        return await self.seed_template_by_code("K9", "k9_template.json")

    async def get_templates(self) -> TemplateListResponse:
        await self.seed_k9_if_missing()
        templates = await self._uow.templates.get_multi(sort_by="code", sort_desc=False)
        items = [self._build_response(t) for t in templates]
        return TemplateListResponse(items=items, total=len(items))

    async def get_template(self, id: uuid.UUID | str) -> TemplateResponse:
        tmpl = await self._uow.templates.get(id)
        if tmpl is None:
            raise NotFoundException("Template not found")
        return self._build_response(tmpl)

    async def get_template_by_code(self, code: str) -> TemplateResponse:
        await self.seed_k9_if_missing()
        tmpl = await self._uow.templates.get_by_code(code.upper())
        if tmpl is None:
            raise NotFoundException(f"Template with code '{code}' not found")
        return self._build_response(tmpl)

    async def create_template(self, data: CreateTemplateRequest) -> TemplateResponse:
        code = data.code.upper().strip()
        existing = await self._uow.templates.get_by_code(code)
        if existing is not None:
            raise ConflictException(f"Template code '{code}' already exists")

        payload = {
            "code": code,
            "name": data.name,
            "description": data.description,
            "version": data.version,
            "status": data.status,
            "schema_json": data.schema_json,
        }
        tmpl = await self._uow.templates.create(payload)
        await self._uow.templates.create_version(tmpl.id, data.version, data.schema_json, "Created template")
        await self._uow.commit()
        return self._build_response(tmpl)

    async def update_template(self, id: uuid.UUID | str, data: UpdateTemplateRequest) -> TemplateResponse:
        tmpl = await self._uow.templates.get(id)
        if tmpl is None:
            raise NotFoundException("Template not found")

        update_dict: dict[str, Any] = {}
        if data.name is not None:
            update_dict["name"] = data.name
        if data.description is not None:
            update_dict["description"] = data.description
        if data.status is not None:
            update_dict["status"] = data.status
        if data.schema_json is not None:
            update_dict["schema_json"] = data.schema_json
            # bump patch version if updated
            parts = tmpl.version.split(".")
            if len(parts) == 2:
                try:
                    update_dict["version"] = f"{parts[0]}.{int(parts[1]) + 1}"
                except ValueError:
                    pass

        updated_tmpl = await self._uow.templates.update(id, update_dict)
        if updated_tmpl is None:
            raise NotFoundException("Template update failed")

        if data.schema_json is not None:
            await self._uow.templates.create_version(
                updated_tmpl.id,
                updated_tmpl.version,
                updated_tmpl.schema_json,
                data.change_log or "Updated template configuration",
            )

        await self._uow.commit()
        return self._build_response(updated_tmpl)

    async def duplicate_template(self, id: uuid.UUID | str) -> TemplateResponse:
        tmpl = await self._uow.templates.get(id)
        if tmpl is None:
            raise NotFoundException("Template not found")

        new_code = f"{tmpl.code}_COPY_{uuid.uuid4().hex[:4].upper()}"
        new_schema = dict(tmpl.schema_json)
        new_schema["code"] = new_code
        new_schema["name"] = f"{tmpl.name} (Copy)"

        dup = await self._uow.templates.create({
            "code": new_code,
            "name": f"{tmpl.name} (Copy)",
            "description": f"Duplicated from {tmpl.code}",
            "version": "1.0",
            "status": "DRAFT",
            "schema_json": new_schema,
        })
        await self._uow.templates.create_version(dup.id, "1.0", new_schema, f"Duplicated from {tmpl.code}")
        await self._uow.commit()
        return self._build_response(dup)

    async def publish_template(self, id: uuid.UUID | str) -> TemplateResponse:
        tmpl = await self._uow.templates.get(id)
        if tmpl is None:
            raise NotFoundException("Template not found")

        updated = await self._uow.templates.update(id, {"status": "PUBLISHED"})
        await self._uow.commit()
        return self._build_response(updated)

    async def archive_template(self, id: uuid.UUID | str) -> TemplateResponse:
        tmpl = await self._uow.templates.get(id)
        if tmpl is None:
            raise NotFoundException("Template not found")

        updated = await self._uow.templates.update(id, {"status": "ARCHIVED"})
        await self._uow.commit()
        return self._build_response(updated)

    async def delete_template(self, id: uuid.UUID | str) -> bool:
        res = await self._uow.templates.delete(id)
        await self._uow.commit()
        return res

    async def import_template_json(self, raw_json: dict[str, Any]) -> TemplateResponse:
        code = raw_json.get("code") or f"TMPL_{uuid.uuid4().hex[:6].upper()}"
        code = code.upper().strip()

        name = raw_json.get("name") or f"Imported Template {code}"
        version = str(raw_json.get("version", "1.0"))

        existing = await self._uow.templates.get_by_code(code)
        if existing is not None:
            # update existing template
            return await self.update_template(
                existing.id,
                UpdateTemplateRequest(
                    name=name,
                    schema_json=raw_json,
                    change_log="Imported updated JSON definition",
                ),
            )

        return await self.create_template(
            CreateTemplateRequest(
                code=code,
                name=name,
                version=version,
                status="DRAFT",
                description=raw_json.get("description"),
                schema_json=raw_json,
            )
        )

    def validate_project_data(self, template_schema: dict[str, Any], data: dict[str, Any]) -> list[str]:
        errors: list[str] = []
        sections = template_schema.get("sections", [])
        for sec in sections:
            for grp in sec.get("groups", []):
                for fld in grp.get("fields", []):
                    name = fld.get("internalName")
                    label = fld.get("label", name)
                    val = data.get(name)

                    # Required check
                    if fld.get("required") and (val is None or val == "" or val == []):
                        errors.append(f"Field '{label}' is required.")

                    # Type / Format / Range Validation
                    v_rule = fld.get("validation")
                    if val is not None and val != "" and v_rule:
                        v_type = v_rule.get("type")
                        v_val = v_rule.get("value")
                        msg = v_rule.get("message")

                        if v_type == "minLength" and isinstance(val, str) and len(val) < int(v_val):
                            errors.append(msg or f"Field '{label}' must be at least {v_val} characters.")

                        elif v_type == "maxLength" and isinstance(val, str) and len(val) > int(v_val):
                            errors.append(msg or f"Field '{label}' must not exceed {v_val} characters.")

                        elif v_type == "regex" and isinstance(val, str) and v_val:
                            if not re.match(str(v_val), val):
                                errors.append(msg or f"Field '{label}' format is invalid.")

                        elif v_type == "numberRange" and isinstance(val, (int, float)):
                            if isinstance(v_val, dict):
                                if "min" in v_val and val < v_val["min"]:
                                    errors.append(msg or f"Field '{label}' must be >= {v_val['min']}.")
                                if "max" in v_val and val > v_val["max"]:
                                    errors.append(msg or f"Field '{label}' must be <= {v_val['max']}.")

        return errors

    def _build_response(self, tmpl: Any) -> TemplateResponse:
        return TemplateResponse(
            id=tmpl.id,
            code=tmpl.code,
            name=tmpl.name,
            description=tmpl.description,
            version=tmpl.version,
            status=tmpl.status,
            schema_json=tmpl.schema_json,
            created_at=tmpl.created_at,
            updated_at=tmpl.updated_at,
        )
