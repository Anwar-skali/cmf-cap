from __future__ import annotations

from datetime import datetime
import uuid
from typing import Any

from fastapi import APIRouter, Depends, Query

from app.application.dto.activity import (
    ActivityFilter,
    ActivityLogListResponse,
    ActivityLogResponse,
)
from app.application.services.activity_service import ActivityService
from app.api.deps import get_activity_service, get_current_active_user
from app.infrastructure.persistence.models.user import User

router = APIRouter(prefix="/api/v1/activity", tags=["Activity"])


def _parse_datetime(value: str | None) -> datetime | None:
    if value is None:
        return None
    try:
        return datetime.fromisoformat(value)
    except (ValueError, TypeError):
        return None


@router.get(
    "",
    response_model=ActivityLogListResponse,
    summary="List activity logs with filtering",
)
async def list_activity(
    user_id: uuid.UUID | None = Query(None),
    resource_type: str | None = Query(None),
    resource_id: str | None = Query(None),
    action: str | None = Query(None),
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_active_user),
    activity_service: ActivityService = Depends(get_activity_service),
) -> Any:
    filter_data = ActivityFilter(
        user_id=user_id,
        resource_type=resource_type,
        resource_id=resource_id,
        action=action,
        date_from=_parse_datetime(date_from),
        date_to=_parse_datetime(date_to),
        skip=skip,
        limit=limit,
    )
    return await activity_service.search(filter_data)


@router.get(
    "/recent",
    response_model=list[ActivityLogResponse],
    summary="Get recent activities",
)
async def recent_activities(
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_active_user),
    activity_service: ActivityService = Depends(get_activity_service),
) -> Any:
    return await activity_service.get_recent_activities(limit=limit)
