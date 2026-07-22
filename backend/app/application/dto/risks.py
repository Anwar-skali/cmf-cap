from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


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
    project_part_id: Any
    assigned_to: Any | None = None
    identified_by: Any | None = None


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
