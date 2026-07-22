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
from app.core.exceptions import ConflictException, NotFoundException
from app.domain.enums import ActivityAction, ProjectStatus


class ProjectService:
    def __init__(self, uow: IUnitOfWork, cache_service: ICacheService | None = None) -> None:
        self._uow = uow
        self._cache = cache_service

    async def create_project(self, data: CreateProjectRequest, user_id: uuid.UUID | None = None) -> ProjectResponse:
        if data.code:
            existing = await self._uow.projects.get_by_code(data.code)
            if existing is not None:
                raise ConflictException(f"A project with code '{data.code}' already exists")
            code = data.code
        else:
            code = await self._generate_project_code()

        project_data = data.model_dump(exclude_unset=True, exclude={"code"})
        project_data["code"] = code

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

    async def update_project(self, id: uuid.UUID, data: UpdateProjectRequest, user_id: uuid.UUID | None = None) -> ProjectResponse:
        project = await self._uow.projects.get(id)
        if project is None:
            raise NotFoundException("Project not found")

        update_data = data.model_dump(exclude_unset=True, exclude_none=True)
        if not update_data:
            return await self._build_response(project)

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
