from __future__ import annotations

from typing import Any

from pydantic import BaseModel

from app.application.dto.activity import ActivityLogResponse
from app.application.dto.capacity import MonthlyCapacityResponse
from app.application.dto.projects import ProjectResponse
from app.application.dto.risks import RiskDistributionResponse


class DashboardStatsResponse(BaseModel):
    total_cmf: int = 0
    total_projects: int = 0
    active_projects: int = 0
    completed_projects: int = 0
    delayed_projects: int = 0
    projects_on_track: int = 0
    project_use_cases: int = 0
    delayed_project_use_cases: int = 0
    completed_project_use_cases: int = 0
    total_parts: int = 0
    active_parts: int = 0
    total_suppliers: int = 0
    active_suppliers: int = 0
    total_risks: int = 0
    open_risks: int = 0
    critical_risks: int = 0
    mitigated_risks: int = 0
    open_quality_issues: int = 0
    critical_quality_issues: int = 0
    open_actions: int = 0
    supplier_quality_status: str = "GREEN"
    total_capacity: float = 0.0
    allocated_capacity: float = 0.0
    used_capacity: float = 0.0
    remaining_capacity: float = 0.0
    capacity_gap: float = 0.0
    average_utilization_pct: float = 0.0
    capacity_coverage_percentage: float = 0.0
    projects_by_customer: list[dict[str, Any]] = []
    upcoming_milestones: int = 0
    recent_activities: list[ActivityLogResponse] = []
    monthly_capacity: list[MonthlyCapacityResponse] = []
    risk_distribution: RiskDistributionResponse = RiskDistributionResponse()
    project_status_distribution: dict[str, int] = {}
    upcoming_deadlines: list[ProjectResponse] = []
