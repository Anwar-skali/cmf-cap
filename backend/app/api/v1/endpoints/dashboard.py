from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends

from app.application.dto.dashboard import DashboardStatsResponse
from app.application.services.dashboard_service import DashboardService
from app.api.deps import get_current_active_user, get_dashboard_service
from app.infrastructure.persistence.models.user import User

router = APIRouter(prefix="/api/v1/dashboard", tags=["Dashboard"])


@router.get(
    "/stats",
    response_model=DashboardStatsResponse,
    summary="Get full dashboard statistics",
)
async def dashboard_stats(
    current_user: User = Depends(get_current_active_user),
    dashboard_service: DashboardService = Depends(get_dashboard_service),
) -> Any:
    return await dashboard_service.get_dashboard_stats()


@router.get(
    "/projects",
    summary="Get project-specific dashboard data",
)
async def dashboard_projects(
    current_user: User = Depends(get_current_active_user),
    dashboard_service: DashboardService = Depends(get_dashboard_service),
) -> Any:
    stats = await dashboard_service.get_dashboard_stats()
    return {
        "total_projects": stats.total_projects,
        "active_projects": stats.active_projects,
        "completed_projects": stats.completed_projects,
        "delayed_projects": stats.delayed_projects,
        "project_status_distribution": stats.project_status_distribution,
        "upcoming_deadlines": stats.upcoming_deadlines,
    }


@router.get(
    "/capacity",
    summary="Get capacity dashboard data",
)
async def dashboard_capacity(
    current_user: User = Depends(get_current_active_user),
    dashboard_service: DashboardService = Depends(get_dashboard_service),
) -> Any:
    stats = await dashboard_service.get_dashboard_stats()
    return {
        "capacity_coverage_percentage": stats.capacity_coverage_percentage,
        "monthly_capacity": stats.monthly_capacity,
    }


@router.get(
    "/risks",
    summary="Get risk dashboard data",
)
async def dashboard_risks(
    current_user: User = Depends(get_current_active_user),
    dashboard_service: DashboardService = Depends(get_dashboard_service),
) -> Any:
    stats = await dashboard_service.get_dashboard_stats()
    return {
        "total_risks": stats.total_risks,
        "open_risks": stats.open_risks,
        "critical_risks": stats.critical_risks,
        "mitigated_risks": stats.mitigated_risks,
        "risk_distribution": stats.risk_distribution,
    }
