from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Depends

from app.application.dto.project_parts import (
    CreateProjectPartRequest,
    ProjectPartListResponse,
    ProjectPartResponse,
    UpdateProjectPartRequest,
)
from app.application.services.project_part_service import ProjectPartService
from app.api.deps import get_current_active_user, get_project_part_service
from app.core.exceptions import NotFoundException
from app.infrastructure.persistence.models.user import User

router = APIRouter(prefix="/api/v1/projects/{project_id}/parts", tags=["Project Parts"])


@router.get(
    "",
    response_model=list[ProjectPartResponse],
    summary="List parts for a project",
)
async def list_parts(
    project_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    part_service: ProjectPartService = Depends(get_project_part_service),
) -> Any:
    return await part_service.get_parts_by_project(project_id)


@router.post(
    "",
    response_model=ProjectPartResponse,
    summary="Create a part for a project",
)
async def create_part(
    project_id: uuid.UUID,
    data: CreateProjectPartRequest,
    current_user: User = Depends(get_current_active_user),
    part_service: ProjectPartService = Depends(get_project_part_service),
) -> Any:
    return await part_service.create_part(project_id, data, user_id=current_user.id)


@router.get(
    "/{id}",
    response_model=ProjectPartResponse,
    summary="Get a part by ID",
)
async def get_part(
    project_id: uuid.UUID,
    id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    part_service: ProjectPartService = Depends(get_project_part_service),
) -> Any:
    part = await part_service.get_part(id)
    if part is None or part.project_id != project_id:
        raise NotFoundException("Part not found")
    return part


@router.put(
    "/{id}",
    response_model=ProjectPartResponse,
    summary="Update a part",
)
async def update_part(
    project_id: uuid.UUID,
    id: uuid.UUID,
    data: UpdateProjectPartRequest,
    current_user: User = Depends(get_current_active_user),
    part_service: ProjectPartService = Depends(get_project_part_service),
) -> Any:
    return await part_service.update_part(id, data, user_id=current_user.id)


@router.delete(
    "/{id}",
    summary="Delete a part",
)
async def delete_part(
    project_id: uuid.UUID,
    id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    part_service: ProjectPartService = Depends(get_project_part_service),
) -> dict[str, bool]:
    result = await part_service.delete_part(id, user_id=current_user.id)
    return {"success": result}
