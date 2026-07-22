from __future__ import annotations

import uuid
from typing import Any

from app.application.dto.notifications import (
    NotificationListResponse,
    NotificationResponse,
    UnreadCountResponse,
)
from app.application.interfaces.services import IUnitOfWork
from app.core.exceptions import NotFoundException


class NotificationService:
    def __init__(self, uow: IUnitOfWork) -> None:
        self._uow = uow

    async def create_notification(
        self,
        user_id: uuid.UUID,
        title: str,
        message: str | None = None,
        notification_type: str = "info",
        link: str | None = None,
    ) -> NotificationResponse:
        notif_data = {
            "user_id": user_id,
            "title": title,
            "message": message,
            "type": notification_type,
            "link": link,
            "is_read": False,
        }
        notification = await self._uow.notifications.create(notif_data)
        await self._uow.commit()
        return self._to_response(notification)

    async def get_notifications(
        self,
        user_id: uuid.UUID,
        skip: int = 0,
        limit: int = 20,
        unread_only: bool = False,
    ) -> NotificationListResponse:
        filters: dict[str, Any] = {"user_id": user_id}
        if unread_only:
            filters["is_read"] = False

        total = await self._uow.notifications.count(filters=filters)
        items = await self._uow.notifications.get_multi(
            skip=skip,
            limit=limit,
            sort_by="created_at",
            sort_desc=True,
            filters=filters,
        )
        unread = await self._uow.notifications.get_unread_count(user_id)

        return NotificationListResponse(
            items=[self._to_response(n) for n in items],
            total=total,
            unread_count=unread,
            skip=skip,
            limit=limit,
        )

    async def get_unread_count(self, user_id: uuid.UUID) -> UnreadCountResponse:
        count = await self._uow.notifications.get_unread_count(user_id)
        return UnreadCountResponse(count=count)

    async def mark_as_read(self, notification_id: uuid.UUID, user_id: uuid.UUID) -> bool:
        notification = await self._uow.notifications.get(notification_id)
        if notification is None or notification.user_id != user_id:
            raise NotFoundException("Notification not found")

        result = await self._uow.notifications.mark_as_read(notification_id)
        await self._uow.commit()
        return result

    async def mark_all_as_read(self, user_id: uuid.UUID) -> int:
        count = await self._uow.notifications.mark_all_as_read(user_id)
        await self._uow.commit()
        return count

    async def delete_notification(self, notification_id: uuid.UUID, user_id: uuid.UUID) -> bool:
        notification = await self._uow.notifications.get(notification_id)
        if notification is None or notification.user_id != user_id:
            raise NotFoundException("Notification not found")

        result = await self._uow.notifications.delete(notification_id)
        await self._uow.commit()
        return result

    def _to_response(self, notification: Any) -> NotificationResponse:
        return NotificationResponse(
            id=notification.id,
            title=notification.title,
            message=notification.message,
            type=notification.type if not hasattr(notification.type, 'value') else notification.type.value,
            is_read=notification.is_read,
            read_at=notification.read_at,
            link=notification.link,
            user_id=notification.user_id,
            created_at=notification.created_at,
            updated_at=notification.updated_at,
        )
