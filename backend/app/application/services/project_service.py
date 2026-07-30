from __future__ import annotations

import uuid
from typing import Any

from app.application.dto.projects import (
    CreateProjectRequest,
    ProjectFilter,
    ProjectListResponse,
    ProjectResponse,
    ProjectStatusUpdateRequest,
    UpdateProjectRequest,
)
from app.application.interfaces.services import ICacheService, IUnitOfWork
from app.core.exceptions import ConflictException, ForbiddenException, NotFoundException
from app.domain.enums import ActivityAction, ProjectStatus

# K9 field sets
K9_BUYER_FIELDS = {
    "unique_id", "apqp", "part_name", "use_case", "part_info", "part_number",
    "supplier_info", "supplier_name", "manufacturing_cofor", "production_location",
    "stakeholder", "buyer", "project_name", "project_code"
}
K9_CAPACITY_FIELDS = {
    "capacity", "scr_link_docinfo", "gst_no", "contracted_capacity",
    "fete", "tko_fete_link_sharepoint", "capacity_standard", "fete_tko_letter_doc"
}
K9_SQD_FIELDS = {
    "technical_manager", "k9_sck", "cat1_forecast_date_cw", "cat2_forecast_date",
    "cat3_forecast_date", "cat1_2_3_type", "weekly_capacity_measured",
    "estimated_target", "cat_evaluation", "shared_folder_link", "comments",
    "sqe", "sqm", "team", "family_multiplier"
}

# K0 field sets
K0_BUYER_FIELDS = {
    "line_item", "components_package_rfq", "tazebao_id_dev_system_no",
    "gst_source_package_number", "part_number", "part_name", "comments",
    "make_or_buy", "other_platform_impacted", "development_type",
    "status_resourcing", "original_vehicle_co_parts", "supplier_name_co_parts",
    "new_supplier_yn", "nominated_supplier", "manufacturing_cofor",
    "supplier_location", "ppm", "commodity_buyer", "program_buyer",
    "gm_commodity", "pur_manager", "ga", "pur_area", "lead_engineer_hordain",
    "e_port", "tofas", "eko", "lfp_66_kwh", "nmc_82_kwh",
    "project_name", "project_code"
}
K0_CAPACITY_FIELDS = {
    "quantity_parts_per_vehicle",
    "weekly_capacity_requested_gst", "capacity_step_requested_gst", "calculation_date_gst",
    "weekly_capacity_requested_tko", "capacity_step_requested_tko", "scr_date_tko", "scr_tko_link",
    "weekly_capacity_latest_ltos", "capacity_step_latest_ltos", "date_latest_ltos", "calculation_link",
    "contracted_capacity", "contracted_capacity_step", "capacity_sizing_ok",
    "new_scr_calculation_done", "contracted_capacity_ok",
    "capacity_comments", "capacity_workshop_date", "capacity_workshop_comment"
}
K0_SQD_FIELDS = {
    "sqvl", "sqme_manufacturing",
    "apqp_grid", "run_assessment",
    "cat_forecast_date", "cat_forecast_calendar_week",
    "cat_real_date", "cat_real_calendar_week",
    "last_cat", "requested_supplier_weekly_capacity",
    "cat_run_observation", "number_production_days", "number_production_shifts",
    "cat_rating", "cat_link", "cat_comment"
}

# Aliases for legacy callers
BUYER_FIELDS = K9_BUYER_FIELDS
CAPACITY_FIELDS = K9_CAPACITY_FIELDS
SQD_FIELDS = K9_SQD_FIELDS

_TEMPLATE_ROLE_FIELDS: dict[str, dict[str, set]] = {
    "K9": {"buyer": K9_BUYER_FIELDS, "capacity_manager": K9_CAPACITY_FIELDS, "sqd": K9_SQD_FIELDS},
    "K0": {"buyer": K0_BUYER_FIELDS, "capacity_manager": K0_CAPACITY_FIELDS, "sqd": K0_SQD_FIELDS},
}


def _get_role_fields(template_code: str | None, role: str) -> set:
    """Return the editable field set for the given role and template code."""
    code = (template_code or "K9").upper()
    return _TEMPLATE_ROLE_FIELDS.get(code, _TEMPLATE_ROLE_FIELDS["K9"]).get(role, set())


def _has_any_field(data_dict: dict[str, Any], fields: set[str]) -> bool:
    for f in fields:
        val = data_dict.get(f)
        if val is not None and str(val).strip() != "" and val != []:
            return True
    return False


def calculate_workflow_step(data_dict: dict[str, Any], template_code: str | None = None) -> int:
    """Calculate the current workflow step for any CMF template."""
    code = (template_code or "K9").upper()
    if code == "K0":
        has_capacity = _has_any_field(data_dict, K0_CAPACITY_FIELDS)
        has_sqd = _has_any_field(data_dict, K0_SQD_FIELDS)
        cat_rating = str(data_dict.get("cat_rating", "")).upper()
        if has_sqd and cat_rating == "GREEN":
            return 4
        if has_sqd:
            return 3
        if has_capacity:
            return 2
        return 1
    # Default K9 logic
    has_capacity = _has_any_field(data_dict, K9_CAPACITY_FIELDS)
    has_sqd = _has_any_field(data_dict, K9_SQD_FIELDS)
    cat_eval = str(data_dict.get("cat_evaluation", "")).upper()
    if has_sqd and cat_eval == "GREEN":
        return 4
    if has_sqd:
        return 3
    if has_capacity:
        return 2
    return 1


# Keep legacy name working
calculate_k9_workflow_step = calculate_workflow_step


class ProjectService:
    def __init__(self, uow: IUnitOfWork, cache_service: ICacheService | None = None) -> None:
        self._uow = uow
        self._cache = cache_service

    async def create_project(
        self,
        data: CreateProjectRequest,
        user_id: uuid.UUID | None = None,
        user_role: str | None = None,
    ) -> ProjectResponse:
        if user_role and str(user_role).lower() not in ("buyer", "admin"):
            raise ForbiddenException("Only Buyers or Administrators can create CMF projects.")

        if data.code:
            existing = await self._uow.projects.get_by_code(data.code)
            if existing is not None:
                raise ConflictException(f"A project with code '{data.code}' already exists")
            code = data.code
        else:
            code = await self._generate_project_code()

        project_data = data.model_dump(exclude_unset=True, exclude={"code"})
        project_data["code"] = code

        # Convert string UUIDs to uuid.UUID objects for SQLAlchemy
        for uuid_field in ("template_id", "buyer_id", "sqd_id", "capacity_manager_id"):
            val = project_data.get(uuid_field)
            if isinstance(val, str):
                project_data[uuid_field] = uuid.UUID(val)

        if not project_data.get("template_id"):
            k9 = await self._uow.templates.get_by_code("K9")
            if k9:
                project_data["template_id"] = k9.id
                project_data["template_version"] = k9.version

        # Ensure initial workflow step is set
        inner_data = project_data.get("data") or {}
        # Resolve template code for workflow calculation
        _tmpl_obj = None
        if project_data.get("template_id"):
            _tmpl_obj = await self._uow.templates.get(project_data["template_id"])
        _tmpl_code = _tmpl_obj.code if _tmpl_obj else None
        inner_data["workflow_step"] = calculate_workflow_step(inner_data, _tmpl_code)
        project_data["data"] = inner_data

        project = await self._uow.projects.create(project_data)

        await self._uow.activity_logs.create({
            "user_id": user_id,
            "action": ActivityAction.CREATE.value,
            "resource_type": "project",
            "resource_id": str(project.id),
            "details": {"code": code, "name": data.name},
        })

        await self._uow.commit()

        if self._cache is not None:
            await self._cache.delete("dashboard:stats")

        return await self._build_response(project)

    async def get_project(self, id: uuid.UUID) -> ProjectResponse:
        project = await self._uow.projects.get(id)
        if project is None:
            raise NotFoundException("Project not found")
        return await self._build_response(project)

    async def update_project(
        self,
        id: uuid.UUID,
        data: UpdateProjectRequest,
        user_id: uuid.UUID | None = None,
        user_role: str | None = None,
    ) -> ProjectResponse:
        project = await self._uow.projects.get(id)
        if project is None:
            raise NotFoundException("Project not found")

        update_data = data.model_dump(exclude_unset=True, exclude_none=True)
        if not update_data:
            return await self._build_response(project)

        # Enforce role-level edit boundaries if role is specified and not admin
        if user_role and str(user_role).lower() != "admin":
            role_str = str(user_role).lower()
            incoming_data = update_data.get("data") or {}

            # Determine template code from the project's template
            _tmpl_code: str | None = None
            if project.template_id:
                _tmpl_obj = await self._uow.templates.get(project.template_id)
                if _tmpl_obj:
                    _tmpl_code = _tmpl_obj.code
            elif project.data and isinstance(project.data, dict):
                _tmpl_code = project.data.get("template_code")

            buyer_fields = _get_role_fields(_tmpl_code, "buyer")
            capacity_fields = _get_role_fields(_tmpl_code, "capacity_manager")
            sqd_fields = _get_role_fields(_tmpl_code, "sqd")

            # Check only keys in incoming_data that are NEW or MODIFIED compared to existing project.data
            existing_data = project.data or {}
            actually_modified_keys = {
                k for k, v in incoming_data.items()
                if k not in existing_data or existing_data.get(k) != v
            }

            if role_str == "buyer":
                prohibited = actually_modified_keys & (capacity_fields | sqd_fields)
                if prohibited:
                    raise ForbiddenException(f"Buyer role cannot edit Capacity or SQD fields: {', '.join(prohibited)}")
            elif role_str == "capacity_manager":
                prohibited = actually_modified_keys & (buyer_fields | sqd_fields)
                if prohibited:
                    raise ForbiddenException(f"Capacity Manager role cannot edit Buyer or SQD fields: {', '.join(prohibited)}")
            elif role_str == "sqd":
                prohibited = actually_modified_keys & (buyer_fields | capacity_fields)
                if prohibited:
                    raise ForbiddenException(f"SQD role cannot edit Buyer or Capacity fields: {', '.join(prohibited)}")

        # Convert string UUIDs to uuid.UUID objects for SQLAlchemy
        for uuid_field in ("template_id", "buyer_id", "sqd_id", "capacity_manager_id"):
            val = update_data.get(uuid_field)
            if isinstance(val, str):
                update_data[uuid_field] = uuid.UUID(val)

        # Merge data and recalculate workflow step
        if "data" in update_data and isinstance(update_data["data"], dict):
            current_inner = dict(project.data or {})
            for k, v in update_data["data"].items():
                if v is not None or k not in current_inner:
                    current_inner[k] = v
            _tmpl_code2: str | None = None
            if project.template_id:
                _tmpl_obj2 = await self._uow.templates.get(project.template_id)
                if _tmpl_obj2:
                    _tmpl_code2 = _tmpl_obj2.code
            elif current_inner.get("template_code"):
                _tmpl_code2 = current_inner.get("template_code")

            current_inner["workflow_step"] = calculate_workflow_step(current_inner, _tmpl_code2)
            if current_inner.get("workflow_step") == 4:
                update_data["status"] = ProjectStatus.COMPLETED.value
            update_data["data"] = current_inner

        project = await self._uow.projects.update(id, update_data)
        if project is None:
            raise NotFoundException("Project not found")

        await self._uow.activity_logs.create({
            "user_id": user_id,
            "action": ActivityAction.UPDATE.value,
            "resource_type": "project",
            "resource_id": str(id),
            "details": {"updated_fields": list(update_data.keys())},
        })

        await self._uow.commit()

        if self._cache is not None:
            await self._cache.delete("dashboard:stats")

        return await self._build_response(project)

    async def delete_project(self, id: uuid.UUID, user_id: uuid.UUID | None = None) -> bool:
        project = await self._uow.projects.get(id)
        if project is None:
            raise NotFoundException("Project not found")

        result = await self._uow.projects.delete(id)

        await self._uow.activity_logs.create({
            "user_id": user_id,
            "action": ActivityAction.DELETE.value,
            "resource_type": "project",
            "resource_id": str(id),
            "details": {"code": project.code, "name": project.name},
        })

        await self._uow.commit()

        if self._cache is not None:
            await self._cache.delete("dashboard:stats")

        return result

    async def get_projects(self, filter: ProjectFilter) -> ProjectListResponse:
        filters: dict[str, Any] = {}
        if filter.status is not None:
            filters["status"] = filter.status
        if filter.buyer_id is not None:
            filters["buyer_id"] = filter.buyer_id
        if filter.sqd_id is not None:
            filters["sqd_id"] = filter.sqd_id
        if filter.capacity_manager_id is not None:
            filters["capacity_manager_id"] = filter.capacity_manager_id
        if filter.date_from is not None:
            filters.setdefault("start_date", {})["gte"] = filter.date_from
        if filter.date_to is not None:
            filters.setdefault("end_date", {})["lte"] = filter.date_to

        if filter.search:
            items, total = await self._uow.projects.search(filter.search, filters=filters)
            skip = filter.skip or 0
            limit = filter.limit or 20
            items = items[skip : skip + limit]
        else:
            total = await self._uow.projects.count(filters=filters)
            items = await self._uow.projects.get_multi(
                skip=filter.skip,
                limit=filter.limit,
                sort_by=filter.sort_by,
                sort_desc=filter.sort_desc,
                filters=filters,
            )

        responses = [await self._build_response(p) for p in items]
        return ProjectListResponse(
            items=responses,
            total=total,
            skip=filter.skip,
            limit=filter.limit,
        )

    async def update_status(self, id: uuid.UUID, data: ProjectStatusUpdateRequest, user_id: uuid.UUID | None = None) -> ProjectResponse:
        project = await self._uow.projects.get(id)
        if project is None:
            raise NotFoundException("Project not found")

        old_status = project.status
        project = await self._uow.projects.update(id, {"status": data.status})
        if project is None:
            raise NotFoundException("Project not found")

        await self._uow.activity_logs.create({
            "user_id": user_id,
            "action": ActivityAction.UPDATE.value,
            "resource_type": "project",
            "resource_id": str(id),
            "details": {"old_status": old_status, "new_status": data.status},
        })

        await self._uow.commit()

        if self._cache is not None:
            await self._cache.delete("dashboard:stats")

        return await self._build_response(project)

    async def get_dashboard_stats(self) -> dict[str, Any]:
        return await self._uow.projects.get_dashboard_stats()

    async def _build_response(self, project: Any) -> ProjectResponse:
        parts = await self._uow.project_parts.get_by_project(project.id)
        inner_data = dict(project.data or {})
        _tmpl_code: str | None = None
        if project.template_id:
            _tmpl_obj = await self._uow.templates.get(project.template_id)
            if _tmpl_obj:
                _tmpl_code = _tmpl_obj.code
        elif inner_data.get("template_code"):
            _tmpl_code = inner_data.get("template_code")

        inner_data["workflow_step"] = calculate_workflow_step(inner_data, _tmpl_code)

        return ProjectResponse(
            id=project.id,
            code=project.code,
            name=project.name,
            description=project.description,
            status=project.status,
            priority=project.priority,
            start_date=project.start_date,
            end_date=project.end_date,
            client_name=project.client_name,
            budget=project.budget,
            currency=project.currency,
            notes=project.notes,
            buyer_id=project.buyer_id,
            sqd_id=project.sqd_id,
            capacity_manager_id=project.capacity_manager_id,
            template_id=project.template_id,
            template_version=project.template_version,
            data=inner_data,
            parts_count=len(parts),
            suppliers_count=len(project.suppliers) if hasattr(project, 'suppliers') else 0,
            created_at=project.created_at,
            updated_at=project.updated_at,
        )

    async def _generate_project_code(self) -> str:
        import uuid as _uuid
        code = f"PRJ-{_uuid.uuid4().hex[:8].upper()}"
        existing = await self._uow.projects.get_by_code(code)
        while existing is not None:
            code = f"PRJ-{_uuid.uuid4().hex[:8].upper()}"
            existing = await self._uow.projects.get_by_code(code)
        return code
