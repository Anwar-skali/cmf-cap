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

        # 2. Try matching built-in domain template JSONs (K0, K9)
        from pathlib import Path
        domain_dir = Path(__file__).parent.parent.parent / "domain"
        upper_id = clean_id.upper()
        if upper_id in ("K0", "K0_MAKE_BATTERY"):
            json_p = domain_dir / "k0_template.json"
            if json_p.exists():
                with open(json_p, "r", encoding="utf-8") as f:
                    data = json.load(f)
                class _TmplProxy:
                    code = "K0"
                    name = data.get("name", "CMF K0 Project Template")
                    description = data.get("description", "")
                    version = data.get("version", "1.0")
                    schema_json = data
                return self._build_context_from_db_template(_TmplProxy())

        if upper_id == "K9":
            json_p = domain_dir / "k9_template.json"
            if json_p.exists():
                with open(json_p, "r", encoding="utf-8") as f:
                    data = json.load(f)
                class _TmplProxy:
                    code = "K9"
                    name = data.get("name", "CMF K9 Project Template")
                    description = data.get("description", "")
                    version = data.get("version", "1.0")
                    schema_json = data
                return self._build_context_from_db_template(_TmplProxy())

        # 3. Try matching built-in entity import schemas (e.g. 'projects', 'suppliers', 'parts')
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
                        "unique_id": ["project code", "code", "unique id", "unique_id", "ref", "project ref", "id piece", "id"],
                        "part_name": ["part name", "project name", "name", "title", "designation", "part designation"],
                        "part_number": ["part number", "part_number", "pn", "part no", "part n", "ref piece"],
                        "supplier_name": ["supplier", "supplier name", "company", "vendor", "fournisseur", "supplier_name"],
                        "manufacturing_cofor": ["manufacturing cofor", "cofor", "supplier cofor", "cofor code", "buyer cofor", "manufacturing_cofor", "code cofor"],
                        "production_location": ["production location", "plant location", "location", "factory location", "production_location", "plant"],
                        "use_case": ["use case", "application", "usecase", "use_case", "vehicle application"],
                        "apqp": ["apqp", "apqp phase", "apqp status", "apqp_phase"],
                        "contracted_capacity": ["contracted capacity", "capacity contracted", "contract capacity", "contracted_capacity"],
                        "capacity_standard": ["capacity standard", "standard capacity", "capacity standard parts week", "capacity_standard"],
                        "technical_manager": ["technical manager", "sqd technical manager", "tech manager", "responsable technique", "technical_manager"],
                        "k9_sck": ["k9 sck", "sck", "k9_sck", "sqd k9 sck", "sqd sck", "supplier capacity checklist"],
                        "cat1_forecast_date_cw": [
                            "cat1 forecast date cw",
                            "cat1 forecasted date cw",
                            "cat1 forecasted date",
                            "cat1 forecast date",
                            "cat1 forecast",
                            "cat1 cw",
                            "cat1_cw",
                            "cat 1 forecast date cw",
                            "cat 1 forecasted date cw",
                            "cat 1 forecasted date",
                            "cat 1 forecast date",
                            "cat 1 forecast",
                            "cat 1 cw",
                            "cat 1",
                            "cat1",
                            "sqd cat1",
                            "sqd cat 1",
                            "sqd cat1 cw",
                            "sqd cat 1 cw",
                            "forecasted date cw",
                            "forecast date cw",
                            "cat1 forecasted date cw",
                            "sqd cat1 forecast date cw",
                            "sqd cat1 forecasted date cw",
                            "sqd cat1 forecasted date",
                            "sqd cat1 forecast date",
                            "sqd cat 1 forecast date cw",
                            "sqd cat 1 forecasted date cw",
                            "sqd cat 1 forecasted date",
                            "sqd cat 1 forecast date",
                            "cat1_forecast_date_cw",
                        ],
                        "cat2_forecast_date": [
                            "cat2 forecast date",
                            "cat2 forecasted date",
                            "cat2 forecast",
                            "cat 2 forecast date",
                            "cat 2 forecasted date",
                            "cat 2 forecast",
                            "sqd cat2 forecast date",
                            "sqd cat2 forecasted date",
                            "sqd cat 2 forecast date",
                            "sqd cat 2 forecasted date",
                            "cat2_forecast_date",
                        ],
                        "cat3_forecast_date": [
                            "cat3 forecast date",
                            "cat3 forecasted date",
                            "cat3 forecast",
                            "cat 3 forecast date",
                            "cat 3 forecasted date",
                            "cat 3 forecast",
                            "sqd cat3 forecast date",
                            "sqd cat3 forecasted date",
                            "sqd cat 3 forecast date",
                            "sqd cat 3 forecasted date",
                            "cat3_forecast_date",
                        ],
                        "cat1_2_3_type": [
                            "cat1 2 3 type",
                            "cat type",
                            "cat1 2 3",
                            "cat audit type",
                            "sqd cat1 2 3 type",
                            "sqd cat type",
                            "cat 1 2 3 type",
                            "cat1_2_3_type",
                        ],
                        "weekly_capacity_measured": [
                            "weekly capacity measured",
                            "measured weekly capacity",
                            "capacity measured",
                            "sqd weekly capacity measured",
                            "weekly capacity",
                            "measured capacity",
                            "weekly_capacity_measured",
                        ],
                        "cat_evaluation": [
                            "gor",
                            "cat",
                            "cat evaluation",
                            "cat_evaluation",
                            "cat1 2 3 evaluation",
                            "sqd evaluation",
                            "cat 1 2 3 evaluation",
                            "evaluation cat",
                            "evaluation sqd",
                        ],
                        "comments": ["comments", "sqd comments", "auditor comments", "notes", "observations"],
                        "sqe": ["sqe", "supplier quality engineer", "sqd engineer", "sqe name"],
                        "sqm": ["sqm", "supplier quality manager", "sqd manager", "sqm name"],
                        "team": ["team", "sqd team", "responsible team", "equipe"],
                        "family_multiplier": ["family multiplier", "family factor", "multiplier", "family_multiplier"],
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
