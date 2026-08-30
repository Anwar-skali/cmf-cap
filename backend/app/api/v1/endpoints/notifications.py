from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Depends, Query

from app.application.dto.notifications import (
    NotificationListResponse,
    NotificationResponse,
    UnreadCountResponse,
)
from app.application.services.notification_service import NotificationService
from app.api.deps import get_current_active_user, get_notification_service
from app.infrastructure.persistence.models.user import User

router = APIRouter(prefix="/api/v1/notifications", tags=["Notifications"])


@router.get(
    "",
    response_model=NotificationListResponse,
    summary="List current user's notifications",
)
async def list_notifications(
    unread_only: bool = Query(False),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    page: int | None = Query(None, ge=1),
    page_size: int | None = Query(None, ge=1, le=100),
    pageSize: int | None = Query(None, ge=1, le=100),
    current_user: User = Depends(get_current_active_user),
    notification_service: NotificationService = Depends(get_notification_service),
) -> Any:
    effective_limit = pageSize or page_size or limit
    effective_skip = ((page - 1) * effective_limit) if page is not None else skip

    return await notification_service.get_notifications(
        user_id=current_user.id,
        skip=effective_skip,
        limit=effective_limit,
        unread_only=unread_only,
    )


@router.get(
    "/unread-count",
    response_model=UnreadCountResponse,
    summary="Get unread notification count",
)
async def unread_count(
    current_user: User = Depends(get_current_active_user),
    notification_service: NotificationService = Depends(get_notification_service),
) -> Any:
    return await notification_service.get_unread_count(current_user.id)


@router.patch(
    "/{id}/read",
    response_model=dict[str, bool],
    summary="Mark a notification as read",
)
@router.post(
    "/{id}/read",
    response_model=dict[str, bool],
    summary="Mark a notification as read (POST alternative)",
)
async def mark_as_read(
    id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    notification_service: NotificationService = Depends(get_notification_service),
) -> dict[str, bool]:
    result = await notification_service.mark_as_read(id, current_user.id)
    return {"success": result}


@router.patch(
    "/read-all",
    response_model=dict[str, int],
    summary="Mark all notifications as read",
)
@router.post(
    "/read-all",
    response_model=dict[str, int],
    summary="Mark all notifications as read (POST alternative)",
)
async def mark_all_as_read(
    current_user: User = Depends(get_current_active_user),
    notification_service: NotificationService = Depends(get_notification_service),
) -> dict[str, int]:
    count = await notification_service.mark_all_as_read(current_user.id)
    return {"marked_read": count}


@router.delete(
    "/{id}",
    response_model=dict[str, bool],
    summary="Delete a notification",
)
async def delete_notification(
    id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    notification_service: NotificationService = Depends(get_notification_service),
) -> dict[str, bool]:
    result = await notification_service.delete_notification(id, current_user.id)
    return {"success": result}
