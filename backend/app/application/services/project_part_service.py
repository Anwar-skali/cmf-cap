from __future__ import annotations

import uuid
from typing import Any

from app.application.dto.project_parts import (
    CreateProjectPartRequest,
    ProjectPartFilter,
    ProjectPartListResponse,
    ProjectPartResponse,
    UpdateProjectPartRequest,
)
from app.application.interfaces.services import IUnitOfWork
from app.core.exceptions import ConflictException, NotFoundException
from app.domain.enums import ActivityAction


class ProjectPartService:
    def __init__(self, uow: IUnitOfWork) -> None:
        self._uow = uow

    async def create_part(
        self, project_id: uuid.UUID, data: CreateProjectPartRequest, user_id: uuid.UUID | None = None
    ) -> ProjectPartResponse:
        project = await self._uow.projects.get(project_id)
        if project is None:
            raise NotFoundException("Project not found")

        existing = await self._uow.project_parts.get_by_part_number(data.part_number)
        if any(e.project_id == project_id for e in [existing] if existing):
            raise ConflictException(f"Part number '{data.part_number}' already exists in this project")

        # Extract and format CMF metadata into notes if present
        extra_info = []
        if data.manufacturing_cofor:
            extra_info.append(f"COFOR: {data.manufacturing_cofor}")
        if data.apqp:
            extra_info.append(f"APQP: {data.apqp}")
        if data.use_case:
            extra_info.append(f"Use Case: {data.use_case}")
        if data.comments:
            extra_info.append(f"Comments: {data.comments}")

        notes = data.notes or ""
        if extra_info:
            prefix = " | ".join(extra_info)
            notes = f"{prefix}\n{notes}".strip() if notes else prefix

        part_data = {
            "project_id": project_id,
            "part_number": data.part_number,
            "name": data.name,
            "description": data.description or data.use_case or None,
            "status": data.status or "active",
            "quantity": data.quantity or 1,
            "unit": data.use_case or data.unit or "pcs",
            "material": data.material,
            "weight": data.weight,
            "notes": notes or None,
        }

        part = await self._uow.project_parts.create(part_data)

        await self._uow.activity_logs.create({
            "user_id": user_id,
            "action": ActivityAction.CREATE.value,
            "resource_type": "project_part",
            "resource_id": str(part.id),
            "details": {"project_id": str(project_id), "part_number": data.part_number},
        })

        await self._uow.commit()
        return self._to_response(part)

    async def get_parts_by_project(self, project_id: uuid.UUID) -> list[ProjectPartResponse]:
        project = await self._uow.projects.get(project_id)
        if project is None:
            raise NotFoundException("Project not found")

        parts = await self._uow.project_parts.get_by_project(project_id)
        return [self._to_response(p) for p in parts]

    async def get_part(self, id: uuid.UUID) -> ProjectPartResponse | None:
        part = await self._uow.project_parts.get(id)
        if part is None:
            return None
        return self._to_response(part)

    async def update_part(
        self, id: uuid.UUID, data: UpdateProjectPartRequest, user_id: uuid.UUID | None = None
    ) -> ProjectPartResponse:
        part = await self._uow.project_parts.get(id)
        if part is None:
            raise NotFoundException("Project part not found")

        update_data = data.model_dump(exclude_unset=True, exclude_none=True)
        if not update_data:
            return self._to_response(part)

        part = await self._uow.project_parts.update(id, update_data)
        if part is None:
            raise NotFoundException("Project part not found")

        await self._uow.activity_logs.create({
            "user_id": user_id,
            "action": ActivityAction.UPDATE.value,
            "resource_type": "project_part",
            "resource_id": str(id),
            "details": {"updated_fields": list(update_data.keys())},
        })

        await self._uow.commit()
        return self._to_response(part)

    async def delete_part(self, id: uuid.UUID, user_id: uuid.UUID | None = None) -> bool:
        part = await self._uow.project_parts.get(id)
        if part is None:
            raise NotFoundException("Project part not found")

        result = await self._uow.project_parts.delete(id)

        await self._uow.activity_logs.create({
            "user_id": user_id,
            "action": ActivityAction.DELETE.value,
            "resource_type": "project_part",
            "resource_id": str(id),
            "details": {"part_number": part.part_number},
        })

        await self._uow.commit()
        return result

    async def get_all_parts(
        self,
        skip: int = 0,
        limit: int = 100,
        sort_by: str | None = None,
        sort_desc: bool = False,
        search: str | None = None,
        status: str | None = None,
        project_id: uuid.UUID | None = None,
    ) -> ProjectPartListResponse:
        filters: dict[str, Any] = {}
        if status:
            filters["status"] = status
        if project_id:
            filters["project_id"] = project_id

        if search:
            parts = await self._uow.project_parts.search(search, project_id=project_id)
            total = len(parts)
            parts = parts[skip : skip + limit]
        else:
            parts = await self._uow.project_parts.get_multi(
                skip=skip, limit=limit, sort_by=sort_by, sort_desc=sort_desc, filters=filters
            )
            total = await self._uow.project_parts.count(filters=filters)

        return ProjectPartListResponse(
            items=[self._to_response(p) for p in parts],
            total=total,
            skip=skip,
            limit=limit,
        )

    async def search(self, query: str, project_id: uuid.UUID | None = None) -> list[ProjectPartResponse]:
        parts = await self._uow.project_parts.search(query, project_id=project_id)
        return [self._to_response(p) for p in parts]

    def _to_response(self, part: Any) -> ProjectPartResponse:
        return ProjectPartResponse(
            id=part.id,
            part_number=part.part_number,
            name=part.name,
            description=part.description,
            status=part.status,
            quantity=part.quantity,
            unit=part.unit,
            weight=part.weight,
            material=part.material,
            notes=part.notes,
            project_id=part.project_id,
            created_at=part.created_at,
            updated_at=part.updated_at,
        )
