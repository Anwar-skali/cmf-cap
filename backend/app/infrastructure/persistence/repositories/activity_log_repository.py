from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import select

from app.infrastructure.persistence.models.activity_log import ActivityLog
from app.infrastructure.persistence.repositories.base import BaseRepository


class ActivityLogRepository(BaseRepository[ActivityLog]):
    def __init__(self, session: Any) -> None:
        super().__init__(session=session, model=ActivityLog)

    async def get_by_user(self, user_id: uuid.UUID) -> list[ActivityLog]:
        stmt = (
            select(ActivityLog)
            .where(ActivityLog.user_id == user_id)
            .order_by(ActivityLog.created_at.desc())
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def get_by_resource(
        self, resource_type: str, resource_id: uuid.UUID
    ) -> list[ActivityLog]:
        stmt = (
            select(ActivityLog)
            .where(
                ActivityLog.resource_type == resource_type,
                ActivityLog.resource_id == str(resource_id),
            )
            .order_by(ActivityLog.created_at.desc())
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def get_recent(self, limit: int = 20) -> list[ActivityLog]:
        stmt = (
            select(ActivityLog)
            .order_by(ActivityLog.created_at.desc())
            .limit(limit)
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())
