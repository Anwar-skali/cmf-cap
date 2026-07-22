from __future__ import annotations

from typing import Any

from pydantic import BaseModel

from app.application.dto.activity import ActivityLogResponse
from app.application.dto.capacity import MonthlyCapacityResponse
from app.application.dto.projects import ProjectResponse
from app.application.dto.risks import RiskDistributionResponse


class DashboardStatsResponse(BaseModel):
    total_projects: int = 0
    active_projects: int = 0
    completed_projects: int = 0
    delayed_projects: int = 0
    total_suppliers: int = 0
    active_suppliers: int = 0
    total_risks: int = 0
    open_risks: int = 0
    critical_risks: int = 0
    mitigated_risks: int = 0
    capacity_coverage_percentage: float = 0.0
    recent_activities: list[ActivityLogResponse] = []
    monthly_capacity: list[MonthlyCapacityResponse] = []
    risk_distribution: RiskDistributionResponse = RiskDistributionResponse()
    project_status_distribution: dict[str, int] = {}
    upcoming_deadlines: list[ProjectResponse] = []
