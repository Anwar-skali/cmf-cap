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
from app.core.exceptions import BadRequestException, ConflictException, ForbiddenException, NotFoundException

# Maps generic JSON schema field types onto the CMF field-type vocabulary.
_JSON_FIELD_TYPE_MAP: dict[str, str] = {
    "string": "text",
    "text": "text",
    "textarea": "textarea",
    "longtext": "textarea",
    "integer": "integer",
    "int": "integer",
    "number": "decimal",
    "float": "decimal",
    "double": "decimal",
    "decimal": "decimal",
    "money": "currency",
    "currency": "currency",
    "date": "date",
    "datetime": "date",
    "time": "date",
    "week": "week",
    "boolean": "boolean",
    "bool": "boolean",
    "email": "email",
    "phone": "phone",
    "telephone": "phone",
    "dropdown": "dropdown",
    "enum": "dropdown",
    "select": "dropdown",
    "multiselect": "multiselect",
    "checkbox": "checkbox",
    "radio": "radio",
    "status": "status",
    "cat_status": "cat_status",
    "percentage": "percentage",
    "file": "file_upload",
    "file_upload": "file_upload",
    "attachment": "file_upload",
    "user": "user",
    "supplier": "supplier",
    "project": "project",
    "calculated": "calculated",
    "readonly": "readonly",
}


def _slugify(name: str) -> str:
    return re.sub(r"[^a-zA-Z0-9_]+", "_", str(name).lower()).strip("_")


# ── Business-role classification ────────────────────────────────────────────
# The CMF Manuel Project workflow organizes fields into three role sections:
# Buyer, Capacity Manager, and SQD. These keyword sets mirror the frontend
# ProjectStructureExtractor so both import paths classify identically.
ROLE_FIELD_KEYWORDS: dict[str, dict[str, set[str]]] = {
    "buyer": {
        "name": {"buyer", "part", "supplier", "package", "rfq", "price", "currency"},
        "label": {"buyer", "part", "supplier"},
    },
    "capacity_manager": {
        "name": {"capacity", "volume", "weekly", "shift", "tooling"},
        "label": {"capacity", "volume"},
    },
    "sqd": {
        "name": {"sqd", "sqe", "sqm", "apqp", "ppap", "quality", "audit", "eval", "cat"},
        "label": {"quality", "apqp", "eval"},
    },
}

ALL_ROLE_NAMES: list[str] = ["buyer", "capacity_manager", "sqd"]
ROLE_VIEW_ROLES: list[str] = ["buyer", "capacity_manager", "sqd", "admin", "viewer"]

# Canonical role-section descriptors (role, section id, name, description).
_ROLE_SECTION_SPECS: list[tuple[str, str, str, str]] = [
    (
        "buyer",
        "sec_buyer",
        "Buyer",
        "Purchasing, RFQ packages, and commercial attributes.",
    ),
    (
        "capacity_manager",
        "sec_capacity_manager",
        "Capacity Manager",
        "Weekly capacity, volume requirements, and tooling assessment.",
    ),
    (
        "sqd",
        "sec_sqd",
        "SQD",
        "Supplier quality development, APQP status, and quality ratings.",
    ),
]


def _canonical_role(value: Any) -> str | None:
    """Map an arbitrary role label (e.g. 'CAPACITY MANAGER', 'buyer') to a canonical role name."""
    v = str(value).strip().lower().replace("-", "_").replace(" ", "_")
    if v in ("buyer", "purchasing"):
        return "buyer"
    if v in ("capacity_manager", "capacity", "capacitymanager"):
        return "capacity_manager"
    if v in ("sqd", "quality", "quality_lead", "sqd_team"):
        return "sqd"
    return None


def _section_role(sec: dict[str, Any]) -> str | None:
    """Return the canonical role for a section id/name, or None when it is not a role section."""
    sid = str(sec.get("id") or "").lower()
    sname = str(sec.get("name") or "").lower()
    if "sqd" in sid or "sqd" in sname:
        return "sqd"
    if "capacity" in sid or "capacity" in sname:
        return "capacity_manager"
    if "buyer" in sid or "buyer" in sname:
        return "buyer"
    return None


def _classify_field_role(field: dict[str, Any]) -> str:
    """
    Determine the business role responsible for a field.
    Precedence: explicit permissions -> role keywords in internalName/label -> 'general'.
    """
    perms = field.get("permissions")
    if isinstance(perms, dict):
        edit = perms.get("rolesAllowedToEdit") or []
        roles = [r for r in edit if r in ALL_ROLE_NAMES]
        if len(roles) == 1:
            return roles[0]

    name = str(field.get("internalName") or field.get("name") or "").lower()
    label = str(field.get("label") or "").lower()
    for role, kws in ROLE_FIELD_KEYWORDS.items():
        if any(kw in name for kw in kws["name"]):
            return role
        if any(kw in label for kw in kws["label"]):
            return role
    return "general"


def role_field_sets_from_schema(schema_json: dict[str, Any] | None) -> dict[str, set[str]]:
    """
    Derive the per-role field sets (internalNames) from a template schema's role
    sections. Used by the backend role-edit boundaries so imported structures
    enforce the same Buyer / Capacity Manager / SQD permissions as seeded ones.
    """
    result: dict[str, set[str]] = {role: set() for role in ALL_ROLE_NAMES}
    if not isinstance(schema_json, dict):
        return result
    sections = schema_json.get("sections")
    if not isinstance(sections, list):
        return result
    for sec in sections:
        role = _section_role(sec) if isinstance(sec, dict) else None
        if role is None:
            continue
        groups = sec.get("groups", [])
        if not isinstance(groups, list):
            continue
        for grp in groups:
            if not isinstance(grp, dict):
                continue
            fields = grp.get("fields", [])
            if not isinstance(fields, list):
                continue
            for fld in fields:
                if isinstance(fld, dict) and fld.get("internalName"):
                    result[role].add(str(fld["internalName"]))
    return result


def _bucket_sections_into_roles(sections: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    Reorganize hierarchical (modules -> tables -> fields) sections into the CMF
    role sections the Manuel Project workflow expects: Buyer, Capacity Manager,
    SQD, plus a General section for unclassified fields. Field-level role and
    permissions metadata is preserved and takes precedence over name heuristics.
    """
    buckets: dict[str, dict[str, list[dict[str, Any]]]] = {}
    for sec in sections:
        groups = sec.get("groups", []) if isinstance(sec, dict) else []
        for grp in groups:
            if not isinstance(grp, dict):
                continue
            gname = str(grp.get("name") or "General")
            fields = grp.get("fields", []) if isinstance(grp, list) else grp.get("fields", [])
            if not isinstance(fields, list):
                continue
            for fld in fields:
                role = _classify_field_role(fld)
                buckets.setdefault(role, {})
                buckets[role].setdefault(gname, []).append(fld)

    result: list[dict[str, Any]] = []
    for role, sec_id, sec_name, sec_desc in _ROLE_SECTION_SPECS:
        groups_by_name = buckets.get(role)
        if not groups_by_name:
            continue
        groups: list[dict[str, Any]] = []
        gidx = 0
        for gname, fields in groups_by_name.items():
            if not fields:
                continue
            gidx += 1
            groups.append(
                {
                    "id": f"grp_{role}_{gidx}",
                    "name": gname,
                    "order": gidx,
                    "fields": fields,
                }
            )
        result.append(
            {
                "id": sec_id,
                "name": sec_name,
                "order": len(result) + 1,
                "description": sec_desc,
                "permissions": {
                    "rolesAllowedToEdit": [role, "admin"],
                    "rolesAllowedToView": list(ROLE_VIEW_ROLES),
                },
                "groups": groups,
            }
        )

    general_by_name = buckets.get("general")
    if general_by_name:
        groups = []
        gidx = 0
        for gname, fields in general_by_name.items():
            if not fields:
                continue
            gidx += 1
            groups.append(
                {
                    "id": f"grp_general_{gidx}",
                    "name": gname,
                    "order": gidx,
                    "fields": fields,
                }
            )
        result.append(
            {
                "id": "sec_general",
                "name": "General",
                "order": len(result) + 1,
                "description": "General information not assigned to a specific role.",
                "groups": groups,
            }
        )

    return result


def _map_json_type(raw_type: Any) -> str:
    if raw_type is None:
        return "text"
    return _JSON_FIELD_TYPE_MAP.get(str(raw_type).strip().lower(), "text")


# Field types whose inputs render as selectable choices in the project form.
# Required fields of these types are unusable unless they carry options or a default.
SELECTABLE_FIELD_TYPES: set[str] = {"status", "dropdown", "radio", "multiselect", "cat_status"}


def _normalize_field_options(raw: Any) -> list[dict[str, Any]] | None:
    """
    Normalize the JSON structure `options` property onto the CMF DropdownOption shape
    ({value, label, order?}). Accepts string arrays, object arrays, or a comma-separated string.
    """
    if raw is None:
        return None
    if isinstance(raw, list):
        options: list[dict[str, Any]] = []
        for i, opt in enumerate(raw):
            if isinstance(opt, dict):
                value = opt.get("value") or opt.get("label")
                if value is None:
                    continue
                options.append(
                    {
                        "value": str(value),
                        "label": str(opt.get("label") or value),
                        "order": opt.get("order") if isinstance(opt.get("order"), int) else i + 1,
                    }
                )
            elif opt is not None and str(opt).strip() != "":
                text = str(opt).strip()
                options.append({"value": text, "label": text, "order": i + 1})
        return options or None
    if isinstance(raw, str):
        parts = [p.strip() for p in raw.split(",") if p.strip()]
        return [{"value": p, "label": p, "order": i + 1} for i, p in enumerate(parts)] or None
    return None


def _normalize_structure_field(f: Any, field_index: int) -> dict[str, Any]:
    """Normalize a single field dict against the CMF TemplateField shape."""
    if not isinstance(f, dict):
        raise ValueError(f"Invalid Project Structure JSON: field #{field_index + 1} must be an object.")
    name = f.get("name") or f.get("internalName") or f.get("label") or f"field_{field_index + 1}"
    internal = _slugify(name)
    default_value = f.get("default")
    if default_value is None:
        default_value = f.get("defaultValue")

    # Preserve explicit role/permission metadata so the role distinction survives
    # the import (the Manuel Project workflow relies on it).
    permissions: dict[str, Any] | None = None
    raw_permissions = f.get("permissions")
    if isinstance(raw_permissions, dict):
        edit = raw_permissions.get("rolesAllowedToEdit")
        view = raw_permissions.get("rolesAllowedToView")
        permissions = {
            "rolesAllowedToEdit": edit if isinstance(edit, list) else None,
            "rolesAllowedToView": view if isinstance(view, list) else None,
        }
    raw_role = f.get("role") or f.get("fieldRole") or f.get("owner")
    canonical_role = _canonical_role(raw_role) if raw_role is not None else None
    if canonical_role is not None:
        permissions = permissions or {}
        edit = permissions.get("rolesAllowedToEdit")
        if not edit:
            permissions["rolesAllowedToEdit"] = [canonical_role, "admin"]
        if not permissions.get("rolesAllowedToView"):
            permissions["rolesAllowedToView"] = list(ROLE_VIEW_ROLES)

    normalized: dict[str, Any] = {
        "id": str(f.get("id") or f"fld_{internal}"),
        "internalName": internal,
        "label": str(f.get("label") or f.get("name") or f.get("internalName") or f"Field {field_index + 1}"),
        "type": _map_json_type(f.get("type")),
        "required": bool(f.get("required", False)),
        "placeholder": f.get("placeholder"),
        "helpText": f.get("helpText") or f.get("description"),
        "order": f.get("order") if isinstance(f.get("order"), int) else field_index + 1,
        "visible": f.get("visible", True) is not False,
        "editable": f.get("editable", True) is not False,
        "options": _normalize_field_options(f.get("options")),
        "defaultValue": default_value,
    }
    if permissions:
        normalized["permissions"] = permissions
    return normalized


def _normalize_project_structure_json(raw: dict[str, Any]) -> dict[str, Any]:
    """
    Normalizes a JSON project-structure definition onto the CMF template shape
    (sections -> groups -> fields) while preserving the hierarchical source
    layout: structure metadata, modules -> tables -> fields (or direct module fields), relationships.

    Recognized layouts:
      1. Hierarchical:  { structure: {...}, modules: [{ code, name, fields: [...] or tables: [{ name, fields }] }], relationships: [...] }
      2. Flat CMF:      { sections: [ ... ] }  (stored as-is)

    Anything else raises ValueError with a clear, structured reason — top-level
    JSON keys are NEVER turned into fields.
    """
    if not isinstance(raw, dict):
        raise ValueError("Invalid Project Structure JSON: expected a JSON object.")

    # ── 1. Hierarchical layout ────────────────────────────────────────────────
    modules = raw.get("modules")
    if isinstance(modules, list) and modules:
        sections: list[dict[str, Any]] = []
        table_count = 0
        field_count = 0

        for mod_index, mod in enumerate(modules):
            if not isinstance(mod, dict):
                raise ValueError(f"Invalid Project Structure JSON: module #{mod_index + 1} must be an object.")
            
            groups: list[dict[str, Any]] = []

            # 1. Direct fields under module (e.g. mod.fields)
            direct_fields = mod.get("fields")
            if isinstance(direct_fields, list) and direct_fields:
                mod_name = str(mod.get("name") or mod.get("code") or f"Module {mod_index + 1}")
                fields: list[dict[str, Any]] = []
                for f_index, f in enumerate(direct_fields):
                    field_count += 1
                    fields.append(_normalize_structure_field(f, f_index))
                table_count += 1
                groups.append(
                    {
                        "id": f"grp_{_slugify(mod_name)}",
                        "name": mod_name,
                        "order": 1,
                        "fields": fields,
                    }
                )

            # 2. Tables under module (e.g. mod.tables)
            tables = mod.get("tables")
            if isinstance(tables, list):
                for tbl_index, tbl in enumerate(tables):
                    if not isinstance(tbl, dict):
                        raise ValueError(f"Invalid Project Structure JSON: table #{tbl_index + 1} must be an object.")
                    raw_fields = tbl.get("fields")
                    if not isinstance(raw_fields, list):
                        raise ValueError(
                            f"Invalid Project Structure JSON: table '{tbl.get('name') or tbl_index + 1}' must contain a 'fields' array."
                        )

                    fields: list[dict[str, Any]] = []
                    for f_index, f in enumerate(raw_fields):
                        field_count += 1
                        fields.append(_normalize_structure_field(f, f_index))
                    table_count += 1
                    groups.append(
                        {
                            "id": str(
                                tbl.get("id")
                                or f"grp_{_slugify(tbl.get('name') or tbl.get('title') or f'table_{tbl_index + 1}')}"
                            ),
                            "name": tbl.get("name") or tbl.get("title") or f"Table {tbl_index + 1}",
                            "order": tbl.get("order") if isinstance(tbl.get("order"), int) else len(groups) + 1,
                            "fields": fields,
                        }
                    )

            if not groups and not isinstance(tables, list) and not isinstance(direct_fields, list):
                mod_ref = mod.get("code") or mod.get("name") or mod_index + 1
                raise ValueError(
                    f"Invalid Project Structure JSON: module '{mod_ref}' must contain a 'fields' or 'tables' array."
                )

            sections.append(
                {
                    "id": str(
                        mod.get("id")
                        or f"sec_{_slugify(mod.get('code') or mod.get('name') or f'module_{mod_index + 1}')}"
                    ),
                    "name": mod.get("name") or mod.get("code") or f"Module {mod_index + 1}",
                    "order": mod.get("order") if isinstance(mod.get("order"), int) else mod_index + 1,
                    "description": mod.get("description") or "",
                    "groups": groups,
                }
            )

        meta = raw.get("structure") if isinstance(raw.get("structure"), dict) else raw
        relationships = raw.get("relationships")
        raw_orient = meta.get("orientation") or raw.get("orientation")
        orientation = raw_orient if raw_orient in ("VERTICAL", "HORIZONTAL") else "HORIZONTAL"

        # Reorganize module/table sections into the role sections the Manuel
        # Project workflow expects (Buyer / Capacity Manager / SQD). This is what
        # makes automatically-distributed data usable per business role.
        role_sections = _bucket_sections_into_roles(sections)

        normalized: dict[str, Any] = {
            "code": str(meta.get("code") or raw.get("code") or "JSON_STRUCT").upper().strip(),
            "name": str(meta.get("name") or raw.get("name") or "JSON Structure"),
            "version": str(meta.get("version") or raw.get("version") or "1.0"),
            "status": str(meta.get("status") or raw.get("status") or "DRAFT"),
            "description": meta.get("description")
            or raw.get("description")
            or f"Project structure imported from JSON with {field_count} fields.",
            "orientation": orientation,
            "modules": len(sections),
            "tables": table_count,
            "fieldCount": field_count,
            "sections": role_sections,
        }
        if isinstance(relationships, list):
            normalized["relationships"] = [
                r for r in relationships if isinstance(r, dict) and (r.get("from") or r.get("to"))
            ]
        return normalized

    # ── 2. Already-normalized CMF template ────────────────────────────────────
    if isinstance(raw.get("sections"), list):
        return raw

    # ── 3. Unrecognized shape ── structured error, never flat fields ─────────
    raise ValueError(
        "Invalid Project Structure JSON: expected a 'modules' array (modules → tables → fields) "
        f"or a 'sections' array. Got: {', '.join(str(k) for k in raw.keys())}"
    )


def validate_structure_selectable_fields(schema_json: dict[str, Any]) -> list[str]:
    """
    Validates a Project Structure schema for project-creation readiness.

    Required selectable fields (status, dropdown, radio, multiselect, cat_status)
    must have at least one option OR a default value; otherwise a project form
    cannot be created from the structure. Returns a list of human-readable problems.
    """
    problems: list[str] = []
    sections = schema_json.get("sections", [])
    if not isinstance(sections, list):
        return problems
    for sec in sections:
        groups = sec.get("groups", []) if isinstance(sec, dict) else []
        for grp in groups:
            fields = grp.get("fields", []) if isinstance(grp, dict) else []
            for fld in fields:
                if not isinstance(fld, dict):
                    continue
                field_type = str(fld.get("type", "")).strip().lower()
                if field_type not in SELECTABLE_FIELD_TYPES:
                    continue
                if not fld.get("required"):
                    continue
                options = fld.get("options") or []
                has_default = fld.get("defaultValue") is not None
                if not options and not has_default:
                    label = fld.get("label") or fld.get("internalName") or "Unnamed field"
                    problems.append(
                        f"Required {field_type} field '{label}' has no options and no default value."
                    )
    return problems


PROTECTED_TEMPLATE_CODES = {"K0", "K9"}


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
        code_upper = code.upper()
        existing = await self._uow.templates.get_by_code(code_upper)
        if existing is not None:
            if existing.version != file_version or existing.schema_json != schema_json:
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

        # For protected core templates (K0, K9), if soft-deleted, revive immediately
        soft_deleted = await self._uow.templates.get_by_code_including_deleted(code_upper)
        if soft_deleted is not None:
            if code_upper in PROTECTED_TEMPLATE_CODES:
                payload = {
                    "name": schema_json.get("name", f"CMF {code} Project Template"),
                    "version": file_version,
                    "description": schema_json.get("description"),
                    "schema_json": schema_json,
                    "status": "PUBLISHED",
                }
                revived = await self._uow.templates.revive(soft_deleted.id, payload)
                await self._uow.templates.create_version(
                    revived.id, file_version, schema_json, f"Revived protected core template v{file_version}"
                )
                await self._uow.commit()
                return revived
            return None

        template_data = {
            "code": code_upper,
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

        if data.status.upper() == "PUBLISHED" and data.schema_json:
            problems = validate_structure_selectable_fields(data.schema_json)
            if problems:
                raise BadRequestException(
                    "Cannot publish Project Structure: " + "; ".join(problems)
                )

        payload = {
            "code": code,
            "name": data.name,
            "description": data.description,
            "version": data.version,
            "status": data.status,
            "schema_json": data.schema_json,
        }

        # Recreating a code that was previously deleted: the unique `code` is
        # still held by a soft-deleted row. Revive it with the new payload
        # instead of INSERTing a duplicate (which would violate the UNIQUE index).
        soft_deleted = await self._uow.templates.get_by_code_including_deleted(code)
        if soft_deleted is not None:
            revived = await self._uow.templates.revive(soft_deleted.id, payload)
            await self._uow.templates.create_version(
                revived.id, data.version, data.schema_json, "Recreated template"
            )
            await self._uow.commit()
            return self._build_response(revived)

        tmpl = await self._uow.templates.create(payload)
        await self._uow.templates.create_version(tmpl.id, data.version, data.schema_json, "Created template")
        await self._uow.commit()
        return self._build_response(tmpl)

    async def update_template(self, id: uuid.UUID | str, data: UpdateTemplateRequest) -> TemplateResponse:
        tmpl = await self._uow.templates.get(id)
        if tmpl is None:
            raise NotFoundException("Template not found")

        resulting_status = data.status if data.status is not None else tmpl.status
        if resulting_status.upper() == "PUBLISHED" and data.schema_json is not None:
            problems = validate_structure_selectable_fields(data.schema_json)
            if problems:
                raise BadRequestException(
                    "Cannot publish Project Structure: " + "; ".join(problems)
                )

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

        problems = validate_structure_selectable_fields(tmpl.schema_json or {})
        if problems:
            raise BadRequestException(
                "Cannot publish Project Structure: " + "; ".join(problems)
            )

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
        tmpl = await self._uow.templates.get(id)
        if tmpl is None:
            await self._uow.commit()
            return False

        if tmpl.code.upper() in PROTECTED_TEMPLATE_CODES:
            raise ForbiddenException(
                f"Template '{tmpl.code}' is a protected core CMF structure and cannot be deleted."
            )

        # Soft-delete dependent projects so the structure's data disappears with
        # it and re-importing the structure later never collides with orphaned
        # records (the import engine would otherwise revive stale project rows).
        await self._uow.projects.soft_delete_by_template(tmpl.id)
        res = await self._uow.templates.delete(id)
        await self._uow.commit()
        return res

    async def import_template_json(self, raw_json: dict[str, Any]) -> TemplateResponse:
        try:
            schema_json = _normalize_project_structure_json(raw_json)
        except ValueError as exc:
            raise BadRequestException(str(exc))

        code = schema_json.get("code") or f"TMPL_{uuid.uuid4().hex[:6].upper()}"
        code = str(code).upper().strip()

        name = schema_json.get("name") or f"Imported Template {code}"
        version = str(schema_json.get("version", "1.0"))

        existing = await self._uow.templates.get_by_code(code)
        if existing is not None:
            # update existing template
            return await self.update_template(
                existing.id,
                UpdateTemplateRequest(
                    name=name,
                    schema_json=schema_json,
                    change_log="Imported updated JSON definition",
                ),
            )

        return await self.create_template(
            CreateTemplateRequest(
                code=code,
                name=name,
                version=version,
                status="DRAFT",
                description=schema_json.get("description"),
                schema_json=schema_json,
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
