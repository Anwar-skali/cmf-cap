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
        utc_now = datetime.now(timezone.utc)

        projects = await self._uow.projects.get_multi(filters={}, limit=10000)
        templates = await self._uow.templates.get_multi(filters={}, limit=10000)
        suppliers = await self._uow.suppliers.get_multi(filters={}, limit=10000)
        risks = await self._uow.risks.get_multi(filters={}, limit=10000)
        activities = await self._uow.activity_logs.get_recent(limit=10)
        assessments = await self._uow.capacity_assessments.get_multi(filters={}, limit=10000)
        parts = await self._uow.project_parts.get_multi(filters={}, limit=10000)

        total_cmf = len(templates)
        total_parts = len(parts) if parts else len(projects)
        active_parts = (
            sum(1 for pt in parts if str(getattr(pt, 'status', 'active') or 'active').lower() in ('active', 'in_progress', 'valid'))
            if parts
            else len(projects)
        )

        def is_past(dt: datetime | None) -> bool:
            if dt is None:
                return False
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt < utc_now

        def is_status(p: Any, *targets: str) -> bool:
            s = str(getattr(p, 'status', '') or '').lower().strip()
            data_s = str((p.data or {}).get('status', '')).lower().strip() if isinstance(p.data, dict) else ''
            target_set = {t.lower().strip() for t in targets}
            return s in target_set or data_s in target_set

        total_projects = len(projects)
        active_projects = sum(1 for p in projects if is_status(p, 'active', 'in_progress', 'started'))
        completed_projects = sum(1 for p in projects if is_status(p, 'completed', 'closed', 'validated', 'done', 'complete'))
        projects_on_track = sum(
            1 for p in projects
            if is_status(p, 'active', 'in_progress') and (p.end_date is None or not is_past(p.end_date))
        )
        delayed_projects = sum(
            1 for p in projects
            if is_status(p, 'delayed')
            or (is_status(p, 'active', 'draft', 'on_hold') and is_past(p.end_date))
        )

        # Project use cases spans all project line items/cases across all CMF templates (K0, K9, and custom structures)
        project_use_cases = total_projects
        delayed_project_use_cases = delayed_projects

        # Completed project use cases: all 3 modules filled (Buyer + Capacity + SQD = step >= 3)
        # across all templates globally — K0, K9, and any future custom structures
        _completion_statuses = {'completed', 'closed', 'validated', 'done', 'complete'}
        completed_project_use_cases = sum(
            1 for p in projects
            if (
                (isinstance(p.data, dict) and int(p.data.get('workflow_step') or 0) >= 3)
                or str(getattr(p, 'status', '') or '').lower().strip() in _completion_statuses
                or str((p.data or {}).get('status', '')).lower().strip() in _completion_statuses
            )
        )

        total_suppliers = len(suppliers)
        active_suppliers = sum(1 for s in suppliers if getattr(s, 'status', None) == 'active') or total_suppliers

        total_risks = len(risks)
        open_risks = sum(1 for r in risks if r.status == 'open')
        critical_risks = sum(
            1 for r in risks
            if r.severity == RiskSeverity.CRITICAL or str(r.severity).lower() == 'critical'
        )
        mitigated_risks = sum(1 for r in risks if r.status in ('mitigated', 'closed'))

        open_quality_issues = sum(
            1 for r in risks
            if r.status == 'open'
            and (
                not r.risk_type
                or str(r.risk_type).lower() in ('quality', 'technical', 'sqd', 'sqe', 'supplier', 'process')
            )
        )
        critical_quality_issues = sum(
            1 for r in risks
            if (r.severity == RiskSeverity.CRITICAL or str(r.severity).lower() == 'critical')
            and (
                not r.risk_type
                or str(r.risk_type).lower() in ('quality', 'technical', 'sqd', 'sqe', 'supplier', 'process')
            )
        )
        open_actions = open_risks

        if critical_risks > 2 or critical_quality_issues > 1:
            supplier_quality_status = "RED"
        elif critical_risks > 0 or open_quality_issues > 3:
            supplier_quality_status = "YELLOW"
        else:
            supplier_quality_status = "GREEN"

        # Capacity metrics
        total_cap = sum(float(a.maximum_capacity) for a in assessments if a.maximum_capacity)
        allocated_cap = sum(float(a.current_capacity) for a in assessments if a.current_capacity)
        used_cap = allocated_cap
        remaining_cap = max(0.0, total_cap - used_cap)
        capacity_gap = max(0.0, total_cap - allocated_cap)
        avg_util_pct = round((allocated_cap / total_cap * 100), 2) if total_cap > 0 else 0.0

        capacity_stats = await self._uow.capacity_assessments.get_coverage_stats()
        total_assessed = capacity_stats.get("total", 0)
        assessed_cap_count = capacity_stats.get("assessed", 0) + capacity_stats.get("confirmed", 0)
        coverage_pct = round((assessed_cap_count / total_assessed * 100), 2) if total_assessed > 0 else 0.0

        # Customer breakdown
        customer_counts: dict[str, int] = {}
        for p in projects:
            cname = (
                p.client_name
                or (p.data.get("customer") if isinstance(p.data, dict) else None)
                or (p.data.get("client_name") if isinstance(p.data, dict) else None)
                or "Other"
            )
            customer_counts[cname] = customer_counts.get(cname, 0) + 1
        projects_by_customer = [
            {"customer": k, "count": v}
            for k, v in sorted(customer_counts.items(), key=lambda x: x[1], reverse=True)
        ]

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

        upcoming = [
            p for p in projects
            if p.status == ProjectStatus.ACTIVE
            and p.end_date is not None
            and not is_past(p.end_date)
        ]
        upcoming.sort(key=lambda p: p.end_date if p.end_date else utc_now)
        upcoming_deadlines = upcoming[:5]
        upcoming_milestones = len(upcoming)

        monthly_capacity = await self._get_monthly_capacity()

        return {
            "total_cmf": total_cmf,
            "total_projects": total_projects,
            "active_projects": active_projects,
            "completed_projects": completed_projects,
            "delayed_projects": delayed_projects,
            "projects_on_track": projects_on_track,
            "project_use_cases": project_use_cases,
            "delayed_project_use_cases": delayed_project_use_cases,
            "completed_project_use_cases": completed_project_use_cases,
            "total_parts": total_parts,
            "active_parts": active_parts,
            "total_suppliers": total_suppliers,
            "active_suppliers": active_suppliers,
            "total_risks": total_risks,
            "open_risks": open_risks,
            "critical_risks": critical_risks,
            "mitigated_risks": mitigated_risks,
            "open_quality_issues": open_quality_issues,
            "critical_quality_issues": critical_quality_issues,
            "open_actions": open_actions,
            "supplier_quality_status": supplier_quality_status,
            "total_capacity": total_cap,
            "allocated_capacity": allocated_cap,
            "used_capacity": used_cap,
            "remaining_capacity": remaining_cap,
            "capacity_gap": capacity_gap,
            "average_utilization_pct": avg_util_pct,
            "capacity_coverage_percentage": coverage_pct,
            "projects_by_customer": projects_by_customer,
            "upcoming_milestones": upcoming_milestones,
            "recent_activities": [self._activity_to_response(a) for a in activities],
            "monthly_capacity": monthly_capacity,
            "risk_distribution": RiskDistributionResponse(
                by_severity=by_severity,
                by_type=by_type,
                by_status=by_status,
            ),
            "project_status_distribution": project_status_dist,
            "upcoming_deadlines": [self._project_to_response(p) for p in upcoming_deadlines],
        }

    async def _get_monthly_capacity(self) -> list[MonthlyCapacityResponse]:
        now = datetime.now(timezone.utc)
        results = []
        # Return last 6 months in chronological order (from 5 months ago to current month)
        for i in range(5, -1, -1):
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
