from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, field_validator


class CreateRiskRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    risk_type: str | None = Field(None, max_length=50)
    severity: str = "medium"
    probability: str = "possible"
    impact: str | None = None
    mitigation: str | None = None
    contingency: str | None = None
    status: str = "open"
    due_date: datetime | None = None
    project_part_id: uuid.UUID
    assigned_to: uuid.UUID | None = None
    identified_by: uuid.UUID | None = None

    @field_validator("project_part_id", mode="before")
    @classmethod
    def coerce_project_part_id(cls, v: Any) -> Any:
        if isinstance(v, str):
            return uuid.UUID(v)
        return v

    @field_validator("assigned_to", "identified_by", mode="before")
    @classmethod
    def coerce_optional_uuid(cls, v: Any) -> Any:
        if isinstance(v, str) and v:
            return uuid.UUID(v)
        return v


class UpdateRiskRequest(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None
    risk_type: str | None = Field(None, max_length=50)
    severity: str | None = None
    probability: str | None = None
    impact: str | None = None
    mitigation: str | None = None
    contingency: str | None = None
    status: str | None = None
    due_date: datetime | None = None
    assigned_to: Any | None = None
    gate: str | None = None
    cate: str | None = None


class RiskResponse(BaseModel):
    id: Any
    title: str
    description: str | None = None
    risk_type: str | None = None
    severity: str = "medium"
    probability: str = "possible"
    risk_score: int = 0
    impact: str | None = None
    mitigation: str | None = None
    contingency: str | None = None
    status: str = "open"
    due_date: datetime | None = None
    resolved_at: datetime | None = None
    project_part_id: Any
    assigned_to: Any | None = None
    identified_by: Any | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None

    # Capacity-linked contextual metadata
    part_number: str | None = None
    part_name: str | None = None
    project_name: str | None = None
    supplier_name: str | None = None
    capacity_assessment_id: Any | None = None
    utilization_rate: float | None = None
    bottleneck: str | None = None
    gate: str | None = None

    model_config = {"from_attributes": True}


class RiskListResponse(BaseModel):
    items: list[RiskResponse]
    total: int
    skip: int = 0
    limit: int = 20


class RiskFilter(BaseModel):
    severity: str | None = None
    status: str | None = None
    risk_type: str | None = None
    assigned_to: Any | None = None
    project_part_id: Any | None = None
    search: str | None = None
    skip: int = Field(default=0, ge=0)
    limit: int = Field(default=20, ge=1, le=100)
    sort_by: str | None = "created_at"
    sort_desc: bool = True


class RiskDistributionResponse(BaseModel):
    by_severity: dict[str, int] = {}
    by_type: dict[str, int] = {}
    by_status: dict[str, int] = {}
