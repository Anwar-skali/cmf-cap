from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import func, select, update

from app.infrastructure.persistence.models.notification import Notification
from app.infrastructure.persistence.repositories.base import BaseRepository


class NotificationRepository(BaseRepository[Notification]):
    def __init__(self, session: Any) -> None:
        super().__init__(session=session, model=Notification)

    async def get_by_user(self, user_id: uuid.UUID) -> list[Notification]:
        stmt = (
            select(Notification)
            .where(Notification.user_id == user_id)
            .order_by(Notification.created_at.desc())
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def get_unread_count(self, user_id: uuid.UUID) -> int:
        stmt = select(func.count(Notification.id)).where(
            Notification.user_id == user_id,
            Notification.is_read.is_(False),
        )
        result = await self._session.execute(stmt)
        return result.scalar() or 0

    async def mark_as_read(self, notification_id: uuid.UUID) -> bool:
        stmt = (
            update(Notification)
            .where(
                Notification.id == notification_id,
                Notification.is_read.is_(False),
            )
            .values(
                is_read=True,
                read_at=datetime.now(timezone.utc),
            )
        )
        result = await self._session.execute(stmt)
        await self._session.flush()
        return result.rowcount > 0

    async def mark_all_as_read(self, user_id: uuid.UUID) -> int:
        stmt = (
            update(Notification)
            .where(
                Notification.user_id == user_id,
                Notification.is_read.is_(False),
            )
            .values(
                is_read=True,
                read_at=datetime.now(timezone.utc),
            )
        )
        result = await self._session.execute(stmt)
        await self._session.flush()
        return result.rowcount
