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

    async def _seed_default_notifications_for_user(self, user_id: uuid.UUID) -> None:
        """Seed initial CMF capacity and project alerts for a user with no notifications."""
        default_notifs = [
            {
                "user_id": user_id,
                "title": "Capacity Overload Alert",
                "message": "Supplier 'LEAR CORPORATION VALENCA' has exceeded weekly contracted capacity (108% utilization) on K9 SCV lines.",
                "type": "error",
                "link": "/capacity",
                "is_read": False,
            },
            {
                "user_id": user_id,
                "title": "Gate Review Action Required",
                "message": "APQP Gate 3 assessment is scheduled for CW38 on project 9878685680 (VERTIS).",
                "type": "warning",
                "link": "/projects",
                "is_read": False,
            },
            {
                "user_id": user_id,
                "title": "CMF Project Import Completed",
                "message": "113 K9 projects and part configurations have been synchronized successfully.",
                "type": "success",
                "link": "/projects",
                "is_read": False,
            },
            {
                "user_id": user_id,
                "title": "Template Studio Schema Published",
                "message": "CMF K9 Project Template V2.0 is active and available for structured imports.",
                "type": "info",
                "link": "/templates",
                "is_read": True,
            },
        ]
        for notif_data in default_notifs:
            await self._uow.notifications.create(notif_data)
        await self._uow.commit()

    async def get_notifications(
        self,
        user_id: uuid.UUID,
        skip: int = 0,
        limit: int = 20,
        unread_only: bool = False,
    ) -> NotificationListResponse:
        import math

        filters: dict[str, Any] = {"user_id": user_id}
        if unread_only:
            filters["is_read"] = False

        total = await self._uow.notifications.count(filters=filters)
        if total == 0 and not unread_only and skip == 0:
            await self._seed_default_notifications_for_user(user_id)
            total = await self._uow.notifications.count(filters=filters)

        items = await self._uow.notifications.get_multi(
            skip=skip,
            limit=limit,
            sort_by="created_at",
            sort_desc=True,
            filters=filters,
        )
        unread = await self._uow.notifications.get_unread_count(user_id)
        page = (skip // limit) + 1 if limit > 0 else 1
        total_pages = max(1, math.ceil(total / limit)) if limit > 0 else 1

        return NotificationListResponse(
            items=[self._to_response(n) for n in items],
            total=total,
            unread_count=unread,
            skip=skip,
            limit=limit,
            page=page,
            page_size=limit,
            total_pages=total_pages,
        )

    async def get_unread_count(self, user_id: uuid.UUID) -> UnreadCountResponse:
        count = await self._uow.notifications.get_unread_count(user_id)
        if count == 0:
            total = await self._uow.notifications.count(filters={"user_id": user_id})
            if total == 0:
                await self._seed_default_notifications_for_user(user_id)
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
