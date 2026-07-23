from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Depends, Query

from app.application.dto.project_parts import (
    CreateProjectPartRequest,
    ProjectPartListResponse,
    ProjectPartResponse,
    UpdateProjectPartRequest,
)
from app.application.services.project_part_service import ProjectPartService
from app.api.deps import get_current_active_user, get_project_part_service
from app.infrastructure.persistence.models.user import User

router = APIRouter(prefix="/api/v1/parts", tags=["Parts"])


@router.get("", response_model=ProjectPartListResponse, summary="List all parts")
async def list_parts(
    search: str | None = Query(default=None),
    status: str | None = Query(default=None),
    project_id: uuid.UUID | None = Query(default=None),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
    sort_by: str | None = Query(default=None),
    sort_desc: bool = Query(default=False),
    current_user: User = Depends(get_current_active_user),
    part_service: ProjectPartService = Depends(get_project_part_service),
) -> Any:
    return await part_service.get_all_parts(
        skip=skip,
        limit=limit,
        sort_by=sort_by,
        sort_desc=sort_desc,
        search=search,
        status=status,
        project_id=project_id,
    )


@router.post("", response_model=ProjectPartResponse, summary="Create a part")
async def create_part(
    data: CreateProjectPartRequest,
    current_user: User = Depends(get_current_active_user),
    part_service: ProjectPartService = Depends(get_project_part_service),
) -> Any:
    return await part_service.create_part(
        data.project_id, data, user_id=current_user.id
    )


@router.get("/{id}", response_model=ProjectPartResponse, summary="Get a part by ID")
async def get_part(
    id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    part_service: ProjectPartService = Depends(get_project_part_service),
) -> Any:
    part = await part_service.get_part(id)
    if part is None:
        from app.core.exceptions import NotFoundException
        raise NotFoundException("Part not found")
    return part


@router.put("/{id}", response_model=ProjectPartResponse, summary="Update a part")
async def update_part(
    id: uuid.UUID,
    data: UpdateProjectPartRequest,
    current_user: User = Depends(get_current_active_user),
    part_service: ProjectPartService = Depends(get_project_part_service),
) -> Any:
    return await part_service.update_part(id, data, user_id=current_user.id)


@router.delete("/{id}", summary="Delete a part")
async def delete_part(
    id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    part_service: ProjectPartService = Depends(get_project_part_service),
) -> dict[str, bool]:
    result = await part_service.delete_part(id, user_id=current_user.id)
    return {"success": result}
