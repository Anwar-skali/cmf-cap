from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, Query

from app.application.dto.projects import (
    CreateProjectRequest,
    ProjectFilter,
    ProjectListResponse,
    ProjectResponse,
    ProjectStatusUpdateRequest,
    UpdateProjectRequest,
)
from app.application.services.project_service import ProjectService
from app.api.deps import get_current_active_user, get_project_service
from app.infrastructure.persistence.models.user import User

router = APIRouter(prefix="/api/v1/projects", tags=["Projects"])


def _parse_datetime(value: str | None) -> datetime | None:
    if value is None:
        return None
    try:
        return datetime.fromisoformat(value)
    except (ValueError, TypeError):
        return None


@router.get(
    "",
    response_model=ProjectListResponse,
    summary="List projects with search, filtering, and pagination",
)
async def list_projects(
    search: str | None = Query(None, max_length=200),
    status: str | None = Query(None),
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
    buyer_id: uuid.UUID | None = Query(None),
    sqd_id: uuid.UUID | None = Query(None),
    capacity_manager_id: uuid.UUID | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    sort_by: str | None = Query("created_at"),
    sort_desc: bool = Query(True),
    current_user: User = Depends(get_current_active_user),
    project_service: ProjectService = Depends(get_project_service),
) -> Any:
    filter_data = ProjectFilter(
        search=search,
        status=status,
        date_from=_parse_datetime(date_from),
        date_to=_parse_datetime(date_to),
        buyer_id=buyer_id,
        sqd_id=sqd_id,
        capacity_manager_id=capacity_manager_id,
        skip=skip,
        limit=limit,
        sort_by=sort_by,
        sort_desc=sort_desc,
    )
    return await project_service.get_projects(filter_data)


@router.post(
    "",
    response_model=ProjectResponse,
    summary="Create a new project",
)
async def create_project(
    data: CreateProjectRequest,
    current_user: User = Depends(get_current_active_user),
    project_service: ProjectService = Depends(get_project_service),
) -> Any:
    return await project_service.create_project(data, user_id=current_user.id, user_role=current_user.role)


@router.get(
    "/{id}",
    response_model=ProjectResponse,
    summary="Get project by ID",
)
async def get_project(
    id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    project_service: ProjectService = Depends(get_project_service),
) -> Any:
    return await project_service.get_project(id)


@router.put(
    "/{id}",
    response_model=ProjectResponse,
    summary="Update a project",
)
async def update_project(
    id: uuid.UUID,
    data: UpdateProjectRequest,
    current_user: User = Depends(get_current_active_user),
    project_service: ProjectService = Depends(get_project_service),
) -> Any:
    return await project_service.update_project(id, data, user_id=current_user.id, user_role=current_user.role)


@router.delete(
    "/{id}",
    summary="Delete a project (soft delete)",
)
async def delete_project(
    id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    project_service: ProjectService = Depends(get_project_service),
) -> dict[str, bool]:
    return {"success": await project_service.delete_project(id, user_id=current_user.id)}


@router.patch(
    "/{id}/status",
    response_model=ProjectResponse,
    summary="Update project status",
)
async def update_project_status(
    id: uuid.UUID,
    data: ProjectStatusUpdateRequest,
    current_user: User = Depends(get_current_active_user),
    project_service: ProjectService = Depends(get_project_service),
) -> Any:
    return await project_service.update_status(id, data, user_id=current_user.id)


@router.get(
    "/{id}/stats",
    summary="Get project statistics",
)
async def get_project_stats(
    id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    project_service: ProjectService = Depends(get_project_service),
) -> dict[str, Any]:
    project = await project_service.get_project(id)
    return {
        "project": project.model_dump() if hasattr(project, 'model_dump') else project,
        "id": str(id),
    }
