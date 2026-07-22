from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class ActivityLogResponse(BaseModel):
    id: Any
    action: str
    resource_type: str
    resource_id: str
    details: dict[str, Any] | None = None
    ip_address: str | None = None
    user_agent: str | None = None
    user_id: Any | None = None
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class ActivityLogListResponse(BaseModel):
    items: list[ActivityLogResponse]
    total: int
    skip: int = 0
    limit: int = 20


class ActivityFilter(BaseModel):
    user_id: Any | None = None
    resource_type: str | None = None
    resource_id: str | None = None
    action: str | None = None
    date_from: datetime | None = None
    date_to: datetime | None = None
    skip: int = Field(default=0, ge=0)
    limit: int = Field(default=50, ge=1, le=200)
    sort_by: str | None = "created_at"
    sort_desc: bool = True
