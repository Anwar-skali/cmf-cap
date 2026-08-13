from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, Field, field_validator


class CreateProjectRequest(BaseModel):
    code: str | None = Field(None, max_length=50)
    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    start_date: datetime | None = None
    end_date: datetime | None = None
    buyer_id: Any | None = None
    sqd_id: Any | None = None
    capacity_manager_id: Any | None = None
    client_name: str | None = Field(None, max_length=255)
    budget: Decimal | None = None
    currency: str = Field(default="EUR", max_length=3)
    priority: int = Field(default=0, ge=0, le=100)
    notes: str | None = None
    template_id: Any | None = None
    template_version: str | None = None
    data: dict[str, Any] = Field(default_factory=dict)

    @field_validator("code")
    @classmethod
    def validate_code(cls, v: str | None) -> str | None:
        if v is not None:
            v = v.strip().upper()
            if not v:
                return None
        return v

    @field_validator("currency")
    @classmethod
    def validate_currency(cls, v: str) -> str:
        return v.upper()


class UpdateProjectRequest(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None
    start_date: datetime | None = None
    end_date: datetime | None = None
    buyer_id: Any | None = None
    sqd_id: Any | None = None
    capacity_manager_id: Any | None = None
    client_name: str | None = Field(None, max_length=255)
    budget: Decimal | None = None
    currency: str | None = Field(None, max_length=3)
    priority: int | None = Field(None, ge=0, le=100)
    notes: str | None = None
    template_id: Any | None = None
    template_version: str | None = None
    data: dict[str, Any] | None = None

    @field_validator("currency")
    @classmethod
    def validate_currency(cls, v: str | None) -> str | None:
        if v is not None:
            return v.upper()
        return v


class ProjectResponse(BaseModel):
    id: Any
    code: str
    name: str
    description: str | None = None
    status: str = "draft"
    priority: int = 0
    start_date: datetime | None = None
    end_date: datetime | None = None
    client_name: str | None = None
    budget: Decimal | None = None
    currency: str = "EUR"
    notes: str | None = None
    buyer_id: Any | None = None
    sqd_id: Any | None = None
    capacity_manager_id: Any | None = None
    template_id: Any | None = None
    template_version: str | None = None
    data: dict[str, Any] = Field(default_factory=dict)
    parts_count: int = 0
    suppliers_count: int = 0
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}


class ProjectListResponse(BaseModel):
    items: list[ProjectResponse]
    total: int
    skip: int = 0
    limit: int = 20
    page: int = 1
    page_size: int = 20
    total_pages: int = 1


class ProjectStatusUpdateRequest(BaseModel):
    status: str = Field(..., min_length=1)


class ProjectFilter(BaseModel):
    search: str | None = None
    status: str | None = None
    date_from: datetime | None = None
    date_to: datetime | None = None
    buyer_id: Any | None = None
    sqd_id: Any | None = None
    capacity_manager_id: Any | None = None
    template_id: Any | None = None
    skip: int = Field(default=0, ge=0)
    limit: int = Field(default=20, ge=1, le=100)
    page: int | None = Field(default=None, ge=1)
    page_size: int | None = Field(default=None, ge=1, le=100)
    sort_by: str | None = "created_at"
    sort_desc: bool = True


class BulkDeleteProjectsRequest(BaseModel):
    project_ids: list[Any] = Field(..., min_length=1)


class BulkDeleteProjectsResponse(BaseModel):
    deleted_count: int
    deleted_ids: list[Any]


