from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class NotificationResponse(BaseModel):
    id: Any
    title: str
    message: str | None = None
    type: str = "info"
    is_read: bool = False
    read_at: datetime | None = None
    link: str | None = None
    user_id: Any
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}


class NotificationListResponse(BaseModel):
    items: list[NotificationResponse]
    total: int
    unread_count: int = 0
    skip: int = 0
    limit: int = 20
    page: int = 1
    page_size: int = 20
    total_pages: int = 1


class MarkAsReadRequest(BaseModel):
    notification_id: str = Field(..., min_length=1)


class UnreadCountResponse(BaseModel):
    count: int = 0
