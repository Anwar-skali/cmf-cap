from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Depends, Query

from app.application.dto.users import (
    CreateUserRequest,
    UpdateUserRequest,
    UserFilter,
    UserListResponse,
    UserProfileResponse,
    UserResponse,
)
from app.application.services.user_service import UserService
from app.api.deps import (
    get_current_active_user,
    get_current_admin,
    get_user_service,
)
from app.core.exceptions import ForbiddenException
from app.infrastructure.persistence.models.user import User

router = APIRouter(prefix="/api/v1/users", tags=["Users"])


@router.get(
    "",
    response_model=UserListResponse,
    summary="List users with pagination and filtering",
)
async def list_users(
    search: str | None = Query(None, max_length=200),
    role: str | None = Query(None),
    is_active: bool | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=500),
    page_size: int | None = Query(None, ge=1, le=500),
    sort_by: str | None = Query("created_at"),
    sort_desc: bool = Query(True),
    current_user: User = Depends(get_current_active_user),
    user_service: UserService = Depends(get_user_service),
) -> Any:
    effective_limit = page_size if page_size is not None else limit
    filter_data = UserFilter(
        search=search,
        role=role,
        is_active=is_active,
        skip=skip,
        limit=effective_limit,
        sort_by=sort_by,
        sort_desc=sort_desc,
    )
    return await user_service.get_users(filter_data)


@router.post(
    "",
    response_model=UserResponse,
    summary="Create a new user",
)
async def create_user(
    data: CreateUserRequest,
    current_user: User = Depends(get_current_admin),
    user_service: UserService = Depends(get_user_service),
) -> Any:
    return await user_service.create_user(data)


@router.get(
    "/{id}",
    response_model=UserProfileResponse,
    summary="Get user by ID",
)
async def get_user(
    id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    user_service: UserService = Depends(get_user_service),
) -> Any:
    if current_user.id != id and current_user.role not in ("admin",) and not current_user.is_superuser:
        raise ForbiddenException("Access denied")
    return await user_service.get_profile(id)


@router.put(
    "/{id}",
    response_model=UserResponse,
    summary="Update user",
)
async def update_user(
    id: uuid.UUID,
    data: UpdateUserRequest,
    current_user: User = Depends(get_current_active_user),
    user_service: UserService = Depends(get_user_service),
) -> Any:
    is_admin = current_user.role in ("admin",) or current_user.is_superuser
    if current_user.id != id and not is_admin:
        raise ForbiddenException("Access denied")
    if not is_admin:
        data.role = None
        data.is_active = None
    return await user_service.update_user(id, data)


@router.delete(
    "/{id}",
    summary="Delete user (soft delete)",
)
async def delete_user(
    id: uuid.UUID,
    current_user: User = Depends(get_current_admin),
    user_service: UserService = Depends(get_user_service),
) -> dict[str, bool]:
    result = await user_service.delete_user(id)
    return {"success": result}
