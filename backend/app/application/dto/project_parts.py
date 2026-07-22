from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, Field


class CreateProjectPartRequest(BaseModel):
    project_id: Any | None = None
    part_number: str = Field(..., min_length=1, max_length=100)
    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    status: str = "active"
    quantity: int = Field(default=1, ge=1)
    unit: str = Field(default="pcs", max_length=50)
    weight: Decimal | None = None
    material: str | None = Field(None, max_length=255)
    notes: str | None = None


class UpdateProjectPartRequest(BaseModel):
    part_number: str | None = Field(None, min_length=1, max_length=100)
    name: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None
    status: str | None = None
    quantity: int | None = Field(None, ge=1)
    unit: str | None = Field(None, max_length=50)
    weight: Decimal | None = None
    material: str | None = Field(None, max_length=255)
    notes: str | None = None


class ProjectPartResponse(BaseModel):
    id: Any
    part_number: str
    name: str
    description: str | None = None
    status: str = "active"
    quantity: int = 1
    unit: str = "pcs"
    weight: Decimal | None = None
    material: str | None = None
    notes: str | None = None
    project_id: Any
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}


class ProjectPartListResponse(BaseModel):
    items: list[ProjectPartResponse]
    total: int
    skip: int = 0
    limit: int = 20


class ProjectPartFilter(BaseModel):
    search: str | None = None
    status: str | None = None
    project_id: Any | None = None
    material: str | None = None
    skip: int = Field(default=0, ge=0)
    limit: int = Field(default=20, ge=1, le=100)
    sort_by: str | None = "created_at"
    sort_desc: bool = True
