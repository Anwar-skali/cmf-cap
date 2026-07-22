from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, Field, field_validator


class CreateCapacityAssessmentRequest(BaseModel):
    assessment_date: date | None = None
    month: int = Field(..., ge=1, le=12)
    year: int = Field(..., ge=2000, le=2100)
    current_capacity: Decimal = Field(..., ge=0)
    maximum_capacity: Decimal = Field(..., ge=0)
    lead_time_days: int | None = Field(None, ge=0)
    bottleneck: str | None = None
    notes: str | None = None
    status: str = "pending"
    project_part_id: Any
    supplier_id: Any
    assessed_by: Any | None = None

    @field_validator("maximum_capacity")
    @classmethod
    def validate_maximum(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("maximum_capacity must be greater than zero")
        return v


class UpdateCapacityAssessmentRequest(BaseModel):
    assessment_date: date | None = None
    month: int | None = Field(None, ge=1, le=12)
    year: int | None = Field(None, ge=2000, le=2100)
    current_capacity: Decimal | None = Field(None, ge=0)
    maximum_capacity: Decimal | None = Field(None, ge=0)
    lead_time_days: int | None = Field(None, ge=0)
    bottleneck: str | None = None
    notes: str | None = None
    status: str | None = None

    @field_validator("maximum_capacity")
    @classmethod
    def validate_maximum(cls, v: Decimal | None) -> Decimal | None:
        if v is not None and v <= 0:
            raise ValueError("maximum_capacity must be greater than zero")
        return v


class CapacityAssessmentResponse(BaseModel):
    id: Any
    assessment_date: date | None = None
    month: int
    year: int
    current_capacity: Decimal
    maximum_capacity: Decimal
    utilization_rate: float | None = None
    lead_time_days: int | None = None
    bottleneck: str | None = None
    notes: str | None = None
    status: str = "pending"
    project_part_id: Any
    supplier_id: Any
    assessed_by: Any | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}


class CapacityAssessmentListResponse(BaseModel):
    items: list[CapacityAssessmentResponse]
    total: int
    skip: int = 0
    limit: int = 20


class CapacityFilter(BaseModel):
    month: int | None = Field(None, ge=1, le=12)
    year: int | None = Field(None, ge=2000, le=2100)
    status: str | None = None
    supplier_id: Any | None = None
    project_part_id: Any | None = None
    skip: int = Field(default=0, ge=0)
    limit: int = Field(default=20, ge=1, le=100)
    sort_by: str | None = "created_at"
    sort_desc: bool = True


class CapacityCoverageResponse(BaseModel):
    coverage_percentage: float = 0.0
    total: int = 0
    assessed: int = 0
    pending: int = 0


class MonthlyCapacityResponse(BaseModel):
    month: int
    year: int
    total_capacity: float = 0.0
    utilized: float = 0.0
    rate: float = 0.0
