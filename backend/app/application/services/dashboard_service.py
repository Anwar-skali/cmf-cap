from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.application.dto.activity import ActivityLogResponse
from app.application.dto.capacity import MonthlyCapacityResponse
from app.application.dto.dashboard import DashboardStatsResponse
from app.application.dto.projects import ProjectResponse
from app.application.dto.risks import RiskDistributionResponse
from app.application.interfaces.services import ICacheService, IUnitOfWork
from app.domain.enums import ProjectStatus, RiskSeverity


class DashboardService:
    def __init__(self, uow: IUnitOfWork, cache_service: ICacheService | None = None) -> None:
        self._uow = uow
        self._cache = cache_service

    async def get_dashboard_stats(self) -> DashboardStatsResponse:
        if self._cache is not None:
            cached = await self._cache.get("dashboard:stats")
            if cached is not None:
                return DashboardStatsResponse(**cached)

        stats = await self._compute_stats()
        response = DashboardStatsResponse(**stats)

        if self._cache is not None:
            await self._cache.set("dashboard:stats", response.model_dump(), ttl=300)

        return response

    async def _compute_stats(self) -> dict[str, Any]:
        projects = await self._uow.projects.get_multi(filters={}, limit=10000)
        suppliers = await self._uow.suppliers.get_multi(filters={}, limit=10000)
        risks = await self._uow.risks.get_multi(filters={}, limit=10000)
        activities = await self._uow.activity_logs.get_recent(limit=10)

        total_projects = len(projects)
        active_projects = sum(1 for p in projects if p.status == ProjectStatus.ACTIVE)
        completed_projects = sum(1 for p in projects if p.status == ProjectStatus.COMPLETED)
        delayed_projects = len([
            p for p in projects
            if p.status in (ProjectStatus.ACTIVE, ProjectStatus.DRAFT, ProjectStatus.ON_HOLD)
            and p.end_date is not None
            and p.end_date < datetime.utcnow()
        ])

        total_suppliers = len(suppliers)
        active_suppliers = sum(1 for s in suppliers if getattr(s, 'status', None) == 'active')

        total_risks = len(risks)
        open_risks = sum(1 for r in risks if r.status == 'open')
        critical_risks = sum(1 for r in risks if r.severity == RiskSeverity.CRITICAL)
        mitigated_risks = sum(1 for r in risks if r.status == 'mitigated')

        capacity_stats = await self._uow.capacity_assessments.get_coverage_stats()
        total_cap = capacity_stats.get("total", 0)
        assessed_cap = capacity_stats.get("assessed", 0) + capacity_stats.get("confirmed", 0)
        coverage_pct = round((assessed_cap / total_cap * 100), 2) if total_cap > 0 else 0.0

        by_severity: dict[str, int] = {}
        by_type: dict[str, int] = {}
        by_status: dict[str, int] = {}
        for r in risks:
            sev = r.severity.value if hasattr(r.severity, 'value') else str(r.severity)
            by_severity[sev] = by_severity.get(sev, 0) + 1
            rtype = r.risk_type or "unknown"
            by_type[rtype] = by_type.get(rtype, 0) + 1
            by_status[r.status] = by_status.get(r.status, 0) + 1

        project_status_dist: dict[str, int] = {}
        for p in projects:
            status_val = p.status.value if hasattr(p.status, 'value') else str(p.status)
            project_status_dist[status_val] = project_status_dist.get(status_val, 0) + 1

        utc_now = datetime.utcnow()
        upcoming = [
            p for p in projects
            if p.status == ProjectStatus.ACTIVE
            and p.end_date is not None
            and p.end_date > utc_now
        ]
        upcoming.sort(key=lambda p: p.end_date if p.end_date else utc_now)
        upcoming = upcoming[:5]

        monthly_capacity = await self._get_monthly_capacity()

        return {
            "total_projects": total_projects,
            "active_projects": active_projects,
            "completed_projects": completed_projects,
            "delayed_projects": delayed_projects,
            "total_suppliers": total_suppliers,
            "active_suppliers": active_suppliers,
            "total_risks": total_risks,
            "open_risks": open_risks,
            "critical_risks": critical_risks,
            "mitigated_risks": mitigated_risks,
            "capacity_coverage_percentage": coverage_pct,
            "recent_activities": [self._activity_to_response(a) for a in activities],
            "monthly_capacity": monthly_capacity,
            "risk_distribution": RiskDistributionResponse(
                by_severity=by_severity,
                by_type=by_type,
                by_status=by_status,
            ),
            "project_status_distribution": project_status_dist,
            "upcoming_deadlines": [self._project_to_response(p) for p in upcoming],
        }

    async def _get_monthly_capacity(self) -> list[MonthlyCapacityResponse]:
        now = datetime.now(timezone.utc)
        results = []
        for i in range(6):
            m = now.month - i
            y = now.year
            while m < 1:
                m += 12
                y -= 1
            assessments = await self._uow.capacity_assessments.get_by_month(y, m)
            if assessments:
                total_cap = sum(float(a.maximum_capacity) for a in assessments if a.maximum_capacity)
                utilized = sum(float(a.current_capacity) for a in assessments if a.current_capacity)
                rate = round((utilized / total_cap * 100), 2) if total_cap > 0 else 0.0
                results.append(MonthlyCapacityResponse(
                    month=m,
                    year=y,
                    total_capacity=round(total_cap, 2),
                    utilized=round(utilized, 2),
                    rate=rate,
                ))
            else:
                results.append(MonthlyCapacityResponse(month=m, year=y))
        return results

    def _activity_to_response(self, activity: Any) -> ActivityLogResponse:
        return ActivityLogResponse(
            id=activity.id,
            action=activity.action,
            resource_type=activity.resource_type,
            resource_id=activity.resource_id,
            details=activity.details,
            ip_address=activity.ip_address,
            user_agent=activity.user_agent,
            user_id=activity.user_id,
            created_at=activity.created_at,
        )

    def _project_to_response(self, project: Any) -> ProjectResponse:
        return ProjectResponse(
            id=project.id,
            code=project.code,
            name=project.name,
            description=project.description,
            status=project.status.value if hasattr(project.status, 'value') else str(project.status),
            priority=project.priority,
            start_date=project.start_date,
            end_date=project.end_date,
            client_name=project.client_name,
            budget=project.budget,
            currency=project.currency,
            notes=project.notes,
            buyer_id=project.buyer_id,
            sqd_id=project.sqd_id,
            capacity_manager_id=project.capacity_manager_id,
            parts_count=0,
            suppliers_count=0,
            created_at=project.created_at,
            updated_at=project.updated_at,
        )
