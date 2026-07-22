from __future__ import annotations

import uuid
from typing import Any

from app.application.dto.activity import (
    ActivityFilter,
    ActivityLogListResponse,
    ActivityLogResponse,
)
from app.application.interfaces.services import IUnitOfWork


class ActivityService:
    def __init__(self, uow: IUnitOfWork) -> None:
        self._uow = uow

    async def log_activity(
        self,
        user_id: uuid.UUID | None,
        action: str,
        resource_type: str,
        resource_id: str,
        details: dict[str, Any] | None = None,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> ActivityLogResponse:
        log_data = {
            "user_id": user_id,
            "action": action,
            "resource_type": resource_type,
            "resource_id": str(resource_id),
            "details": details,
            "ip_address": ip_address,
            "user_agent": user_agent,
        }
        activity = await self._uow.activity_logs.create(log_data)
        await self._uow.commit()
        return self._to_response(activity)

    async def get_recent_activities(self, limit: int = 20) -> list[ActivityLogResponse]:
        activities = await self._uow.activity_logs.get_recent(limit=limit)
        return [self._to_response(a) for a in activities]

    async def get_by_user(self, user_id: uuid.UUID) -> list[ActivityLogResponse]:
        activities = await self._uow.activity_logs.get_by_user(user_id)
        return [self._to_response(a) for a in activities]

    async def get_by_resource(self, resource_type: str, resource_id: uuid.UUID) -> list[ActivityLogResponse]:
        activities = await self._uow.activity_logs.get_by_resource(resource_type, resource_id)
        return [self._to_response(a) for a in activities]

    async def search(self, filter: ActivityFilter) -> ActivityLogListResponse:
        filters: dict[str, Any] = {}
        if filter.user_id is not None:
            filters["user_id"] = filter.user_id
        if filter.resource_type is not None:
            filters["resource_type"] = filter.resource_type
        if filter.resource_id is not None:
            filters["resource_id"] = filter.resource_id
        if filter.action is not None:
            filters["action"] = filter.action
        if filter.date_from is not None:
            filters.setdefault("created_at", {})["gte"] = filter.date_from
        if filter.date_to is not None:
            filters.setdefault("created_at", {})["lte"] = filter.date_to

        total = await self._uow.activity_logs.count(filters=filters)
        items = await self._uow.activity_logs.get_multi(
            skip=filter.skip,
            limit=filter.limit,
            sort_by=filter.sort_by,
            sort_desc=filter.sort_desc,
            filters=filters,
        )

        return ActivityLogListResponse(
            items=[self._to_response(a) for a in items],
            total=total,
            skip=filter.skip,
            limit=filter.limit,
        )

    def _to_response(self, activity: Any) -> ActivityLogResponse:
        return ActivityLogResponse(
            id=activity.id,
            action=activity.action,
            resource_type=activity.resource_type,
            resource_id=activity.resource_id,
            details=activity.details,
            ip_address=activity.ip_address,
            user_agent=activity.user_agent,
            user_id=activity.user_id,
            created_at=activity.created_at,
        )
