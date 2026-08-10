from __future__ import annotations

import json
from typing import Any
from pydantic import BaseModel, Field

from app.domain.import_schema import ENTITY_IMPORT_SCHEMAS, EntityImportSchema
from app.infrastructure.persistence.unit_of_work import UnitOfWork


class TemplateFieldSpec(BaseModel):
    key: str
    label: str
    description: str = ""
    required: bool = False
    type: str = "string"
    aliases: list[str] = Field(default_factory=list)
    validation_rules: str = ""


class TemplateContext(BaseModel):
    template_code: str
    template_name: str
    description: str = ""
    version: str = "1.0"
    fields: list[TemplateFieldSpec] = Field(default_factory=list)

    def to_rag_context_text(self) -> str:
        """
        Builds a structured string representing the template metadata and database fields
        to be injected into the local Ollama LLM prompt.
        """
        lines = [
            f"The selected template is {self.template_code} ({self.template_name}).",
            f"Template Description: {self.description or 'No description provided.'}",
            "",
            "Here are the available database target fields for this template:",
            "",
        ]

        for field in self.fields:
            req_str = "REQUIRED" if field.required else "OPTIONAL"
            lines.append(f"Field Key: {field.key}")
            lines.append(f"Label: {field.label}")
            lines.append(f"Data Type: {field.type}")
            lines.append(f"Status: {req_str}")
            if field.description:
                lines.append(f"Description: {field.description}")
            if field.aliases:
                lines.append(f"Known Aliases: {', '.join(field.aliases)}")
            if field.validation_rules:
                lines.append(f"Validation Rules: {field.validation_rules}")
            lines.append("---")

        return "\n".join(lines)


class TemplateContextService:
    """
    Extracts structured domain knowledge from project templates (K0, K9, or dynamic DB templates)
    and entity import schemas for RAG prompt construction.
    """

    def __init__(self, uow: UnitOfWork) -> None:
        self._uow = uow

    async def get_template_context(self, template_identifier: str) -> TemplateContext:
        """
        Retrieves template context by code (e.g. 'K9', 'K0') or UUID string or entity_type.
        """
        clean_id = template_identifier.strip()

        # 1. Try matching against database templates
        from app.application.services.template_service import TemplateService
        tmpl_svc = TemplateService(self._uow)
        await tmpl_svc.seed_k9_if_missing()
        tmpl = await self._uow.templates.get_by_code(clean_id.upper())

        if tmpl is None:
            # Try by UUID
            try:
                import uuid
                uuid_obj = uuid.UUID(clean_id)
                tmpl = await self._uow.templates.get(uuid_obj)
            except ValueError:
                pass

        if tmpl is not None:
            return self._build_context_from_db_template(tmpl)

        # 2. Try matching built-in entity import schemas (e.g. 'projects', 'suppliers', 'parts')
        lower_id = clean_id.lower()
        if lower_id in ENTITY_IMPORT_SCHEMAS:
            schema = ENTITY_IMPORT_SCHEMAS[lower_id]
            return self._build_context_from_entity_schema(schema)

        # Fallback default empty context
        return TemplateContext(
            template_code=clean_id.upper(),
            template_name=f"Template {clean_id}",
            fields=[],
        )

    def _build_context_from_db_template(self, tmpl: Any) -> TemplateContext:
        schema = tmpl.schema_json or {}
        fields: list[TemplateFieldSpec] = []

        # Recursively extract fields from sections -> groups -> fields
        sections = schema.get("sections", [])
        for sec in sections:
            groups = sec.get("groups", [])
            for grp in groups:
                grp_fields = grp.get("fields", [])
                for fld in grp_fields:
                    key = fld.get("internalName") or fld.get("key") or fld.get("id")
                    if not key:
                        continue
                    
                    label = fld.get("label") or key
                    desc = fld.get("helpText") or fld.get("description") or fld.get("placeholder") or ""
                    required = bool(fld.get("required", False))
                    data_type = fld.get("type", "text")
                    aliases = fld.get("aliases", [])
                    if not isinstance(aliases, list):
                        aliases = []
                    else:
                        aliases = list(aliases)
                    excel_cfg = fld.get("excel", {})
                    if isinstance(excel_cfg, dict):
                        if excel_cfg.get("columnName") and excel_cfg.get("columnName") not in aliases:
                            aliases.append(excel_cfg.get("columnName"))
                        if excel_cfg.get("importAlias") and excel_cfg.get("importAlias") not in aliases:
                            aliases.append(excel_cfg.get("importAlias"))

                    default_common_aliases = {
                        "unique_id": ["project code", "code", "unique id", "unique_id", "ref", "project ref"],
                        "part_name": ["part name", "project name", "name", "title"],
                        "part_number": ["part number", "part_number", "pn", "part no"],
                        "supplier_name": ["supplier", "supplier name", "company", "vendor"],
                        "cat_evaluation": ["gor", "cat", "cat evaluation", "cat_evaluation"],
                    }
                    if key in default_common_aliases:
                        for alias_candidate in default_common_aliases[key]:
                            if alias_candidate not in aliases:
                                aliases.append(alias_candidate)

                    validation = ""
                    if fld.get("options"):
                        validation = f"Allowed options: {', '.join(str(o) for o in fld.get('options'))}"

                    fields.append(
                        TemplateFieldSpec(
                            key=key,
                            label=label,
                            description=desc,
                            required=required,
                            type=data_type,
                            aliases=aliases,
                            validation_rules=validation,
                        )
                    )

        # If no sections, check if top-level fields exist
        if not fields and "fields" in schema:
            for fld in schema.get("fields", []):
                key = fld.get("internalName") or fld.get("key") or fld.get("id")
                if key:
                    fields.append(
                        TemplateFieldSpec(
                            key=key,
                            label=fld.get("label", key),
                            description=fld.get("description") or fld.get("helpText") or "",
                            required=bool(fld.get("required", False)),
                            type=fld.get("type", "text"),
                            aliases=fld.get("aliases", []),
                        )
                    )

        return TemplateContext(
            template_code=tmpl.code,
            template_name=tmpl.name,
            description=tmpl.description or "",
            version=tmpl.version,
            fields=fields,
        )

    def _build_context_from_entity_schema(self, schema: EntityImportSchema) -> TemplateContext:
        fields = [
            TemplateFieldSpec(
                key=c.key,
                label=c.label,
                description=c.description or "",
                required=c.required,
                type=c.type,
                aliases=c.aliases,
                validation_rules=f"Enum values: {', '.join(c.enum_values)}" if c.enum_values else "",
            )
            for c in schema.columns
        ]

        return TemplateContext(
            template_code=schema.entity_type.upper(),
            template_name=schema.display_name,
            description=f"Standard import schema for {schema.display_name}",
            version="1.0",
            fields=fields,
        )
