from __future__ import annotations

import uuid
from typing import Any

from app.application.dto.risks import (
    CreateRiskRequest,
    RiskDistributionResponse,
    RiskFilter,
    RiskListResponse,
    RiskResponse,
    UpdateRiskRequest,
)
from app.application.interfaces.services import IUnitOfWork
from app.core.exceptions import NotFoundException
from app.domain.enums import ActivityAction, RiskProbability, RiskSeverity

_SEVERITY_MAP = {
    "low": 1,
    "medium": 2,
    "high": 3,
    "critical": 4,
}

_PROBABILITY_MAP = {
    "rare": 1,
    "unlikely": 2,
    "possible": 3,
    "likely": 4,
    "almost_certain": 5,
}


class RiskService:
    def __init__(self, uow: IUnitOfWork) -> None:
        self._uow = uow

    async def create_risk(self, data: CreateRiskRequest, user_id: uuid.UUID | None = None) -> RiskResponse:
        part = await self._uow.project_parts.get(data.project_part_id)
        if part is None:
            raise NotFoundException("Project part not found")

        risk_data = data.model_dump(exclude_unset=True)
        if user_id is not None:
            risk_data["identified_by"] = user_id

        risk = await self._uow.risks.create(risk_data)

        await self._uow.activity_logs.create({
            "user_id": user_id,
            "action": ActivityAction.CREATE.value,
            "resource_type": "risk",
            "resource_id": str(risk.id),
            "details": {
                "title": data.title,
                "severity": data.severity,
                "project_part_id": str(data.project_part_id),
            },
        })

        await self._uow.commit()
        return self._to_response(risk)

    async def update_risk(self, id: uuid.UUID, data: UpdateRiskRequest, user_id: uuid.UUID | None = None) -> RiskResponse:
        risk = await self._uow.risks.get(id)
        if risk is None:
            raise NotFoundException("Risk not found")

        update_data = data.model_dump(exclude_unset=True, exclude_none=True)
        if not update_data:
            return self._to_response(risk)

        new_gate = update_data.pop("gate", None) or update_data.pop("cate", None)
        new_status = update_data.get("status")

        risk = await self._uow.risks.update(id, update_data)
        if risk is None:
            raise NotFoundException("Risk not found")

        # Bidirectional sync to linked Capacity Assessments:
        if risk.project_part_id:
            assessments = await self._uow.capacity_assessments.get_multi(
                filters={"project_part_id": risk.project_part_id}, limit=10
            )
            for a in assessments:
                cap_updates: dict[str, Any] = {}
                if new_gate:
                    cap_updates["cate"] = new_gate
                    cap_updates["gate"] = new_gate
                if new_status:
                    if new_status in ("mitigated", "closed"):
                        cap_updates["status"] = "confirmed"
                    elif new_status in ("open", "mitigating") and str(a.status).lower() == "confirmed":
                        cap_updates["status"] = "assessed"
                if cap_updates:
                    await self._uow.capacity_assessments.update(a.id, cap_updates)

        await self._uow.activity_logs.create({
            "user_id": user_id,
            "action": ActivityAction.UPDATE.value,
            "resource_type": "risk",
            "resource_id": str(id),
            "details": {"updated_fields": list(update_data.keys()), "gate": new_gate},
        })

        await self._uow.commit()
        refreshed = await self._uow.risks.get(id)
        return self._to_response(refreshed or risk)

    async def delete_risk(self, id: uuid.UUID, user_id: uuid.UUID | None = None) -> bool:
        risk = await self._uow.risks.get(id)
        if risk is None:
            raise NotFoundException("Risk not found")

        part_id = risk.project_part_id

        # Bidirectional delete: delete linked capacity assessments
        if part_id:
            assessments = await self._uow.capacity_assessments.get_multi(
                filters={"project_part_id": part_id}, limit=10
            )
            for a in assessments:
                await self._uow.capacity_assessments.delete(a.id)

        result = await self._uow.risks.delete(id)

        await self._uow.activity_logs.create({
            "user_id": user_id,
            "action": ActivityAction.DELETE.value,
            "resource_type": "risk",
            "resource_id": str(id),
            "details": {"title": risk.title},
        })

        await self._uow.commit()
        return result

    async def get_by_part(self, project_part_id: uuid.UUID) -> list[RiskResponse]:
        risks = await self._uow.risks.get_by_part(project_part_id)
        return [self._to_response(r) for r in risks]

    async def get_open_risks(self) -> list[RiskResponse]:
        risks = await self._uow.risks.get_open_risks()
        return [self._to_response(r) for r in risks]

    async def get_distribution(self) -> RiskDistributionResponse:
        risks = await self._uow.risks.get_multi(filters={}, limit=10000)
        by_severity: dict[str, int] = {}
        by_type: dict[str, int] = {}
        by_status: dict[str, int] = {}

        for r in risks:
            sev = r.severity.value if hasattr(r.severity, 'value') else str(r.severity)
            by_severity[sev] = by_severity.get(sev, 0) + 1

            rtype = r.risk_type or "unknown"
            by_type[rtype] = by_type.get(rtype, 0) + 1

            by_status[r.status] = by_status.get(r.status, 0) + 1

        return RiskDistributionResponse(
            by_severity=by_severity,
            by_type=by_type,
            by_status=by_status,
        )

    async def mitigate_risk(self, id: uuid.UUID, mitigation_details: str, user_id: uuid.UUID | None = None) -> RiskResponse:
        risk = await self._uow.risks.get(id)
        if risk is None:
            raise NotFoundException("Risk not found")

        from datetime import datetime, timezone

        risk = await self._uow.risks.update(id, {
            "mitigation": mitigation_details,
            "status": "mitigated",
        })
        if risk is None:
            raise NotFoundException("Risk not found")

        await self._uow.activity_logs.create({
            "user_id": user_id,
            "action": ActivityAction.UPDATE.value,
            "resource_type": "risk",
            "resource_id": str(id),
            "details": {"action": "mitigated", "mitigation": mitigation_details},
        })

        await self._uow.commit()
        return self._to_response(risk)

    async def close_risk(self, id: uuid.UUID, user_id: uuid.UUID | None = None) -> RiskResponse:
        risk = await self._uow.risks.get(id)
        if risk is None:
            raise NotFoundException("Risk not found")

        from datetime import datetime, timezone

        risk = await self._uow.risks.update(id, {
            "status": "closed",
            "resolved_at": datetime.now(timezone.utc),
        })
        if risk is None:
            raise NotFoundException("Risk not found")

        await self._uow.activity_logs.create({
            "user_id": user_id,
            "action": ActivityAction.UPDATE.value,
            "resource_type": "risk",
            "resource_id": str(id),
            "details": {"action": "closed"},
        })

        await self._uow.commit()
        return self._to_response(risk)

    async def sync_single_capacity_risk(self, a: Any) -> None:
        """
        Synchronizes a single capacity assessment into the Risk table.
        Creates a new risk if none exists, or updates an existing risk.
        Preserves user manual mitigation/status unless assessment status changed.
        """
        from datetime import datetime, timezone

        if not a.project_part_id:
            return

        part = await self._uow.project_parts.get(a.project_part_id)
        part_num = (getattr(part, 'part_number', '') or getattr(part, 'code', '') or 'Component') if part else 'Component'
        
        supplier = await self._uow.suppliers.get(a.supplier_id) if a.supplier_id else None
        sup_name = (getattr(supplier, 'name', '') or 'Supplier') if supplier else 'Supplier'

        cur = float(a.current_capacity or 0)
        max_cap = float(a.maximum_capacity or 0)
        util_rate = round((cur / max_cap * 100), 1) if max_cap > 0 else 0
        deficit = max(0.0, cur - max_cap)
        headroom = max(0.0, max_cap - cur)
        bottleneck_str = (a.bottleneck or "").strip() or "Production Line Bottleneck"
        raw_g = str(a.cate or a.gate or "CAT 1").strip()
        gate_str = raw_g.replace("CATE", "CAT").replace("CAT Gate", "CAT 1").replace("Gate", "CAT").strip()

        has_week_delay = False
        delay_weeks = 0
        if a.target_week and a.forecast_week:
            try:
                tw = int(str(a.target_week).replace("CW", "").replace("W", ""))
                fw = int(str(a.forecast_week).replace("CW", "").replace("W", ""))
                if fw > tw:
                    has_week_delay = True
                    delay_weeks = fw - tw
            except Exception:
                pass

        is_overload = util_rate >= 100 or deficit > 0
        is_high_load = 85 <= util_rate < 100
        is_rejected = str(a.status).lower() == "rejected"
        is_confirmed = str(a.status).lower() == "confirmed"

        if is_overload or is_rejected:
            sev = RiskSeverity.CRITICAL.value
            prob = RiskProbability.ALMOST_CERTAIN.value
            risk_type = "Capacity Overload" if is_overload else "Quality Non-Conformity"
            title = f"Capacity Deficit ({util_rate}% Load) - Part {part_num} at {sup_name}" if is_overload else f"Capacity Audit Rejected - Part {part_num} ({gate_str})"
            desc = (
                f"Required monthly demand ({int(cur):,} pcs/mo) exceeds installed line capacity "
                f"({int(max_cap):,} pcs/mo) by {int(deficit):,} pcs/mo. Bottleneck: {bottleneck_str}. "
                f"Milestone: {gate_str}."
            )
            impact = (
                f"Immediate risk of assembly starvation and vehicle line stoppage at OEM plant. "
                f"Supplier cannot meet ramp-up curve for {gate_str}."
            )
            mitigation = (
                f"Issue emergency SQD action plan to {sup_name}: duplicate tooling/molds, "
                f"authorize 3rd operating shift, or activate qualified dual-source supplier."
            )
            status = "open" if not is_confirmed else "closed"
        elif is_high_load or has_week_delay:
            sev = RiskSeverity.HIGH.value
            prob = RiskProbability.LIKELY.value
            risk_type = "Milestone Delay" if has_week_delay else "Capacity Constraint"
            if has_week_delay:
                title = f"CAT Milestone Delay (+{delay_weeks}w) - Part {part_num} ({gate_str})"
                desc = f"Forecast completion (CW{a.forecast_week}) is delayed against target week (CW{a.target_week}) by {delay_weeks} week(s). Bottleneck: {bottleneck_str}."
                impact = f"Delay in {gate_str} milestone sign-off threatens overall vehicle SOP schedule."
                mitigation = f"Accelerate SQD industrial trials and expedite supplier sample validation."
            else:
                title = f"High Production Load ({util_rate}%) - Part {part_num} ({sup_name})"
                desc = f"Supplier line operates near capacity limit ({int(cur):,}/{int(max_cap):,} pcs/mo) with only {int(headroom):,} pcs/mo safety buffer."
                impact = f"Scrap spikes, maintenance downtime, or demand increases will result in supply delay."
                mitigation = f"Establish minimum safety buffer stock of {int(headroom*2):,} pcs and monitor weekly OEE."
            status = "open" if not is_confirmed else "mitigated"
        else:
            sev = RiskSeverity.LOW.value
            prob = RiskProbability.RARE.value
            risk_type = "Capacity Compliant"
            title = f"Capacity Validated ({util_rate}%) - Part {part_num} ({gate_str})"
            desc = f"Installed capacity ({int(max_cap):,} pcs/mo) comfortably covers required volume ({int(cur):,} pcs/mo). Status: {a.status}."
            impact = f"No operational disruption expected; {gate_str} criteria satisfied."
            mitigation = f"Routine monthly production load monitoring."
            status = "closed" if is_confirmed else "open"

        existing_risks = await self._uow.risks.get_multi(
            filters={"project_part_id": a.project_part_id}, limit=10
        )
        now = datetime.now(timezone.utc)
        if existing_risks:
            r = existing_risks[0]
            new_status = r.status
            if is_rejected:
                new_status = "open"
            elif is_confirmed and r.status == "open":
                new_status = "closed"

            await self._uow.risks.update(r.id, {
                "title": title,
                "description": desc,
                "risk_type": risk_type,
                "severity": sev,
                "probability": prob,
                "impact": impact,
                "mitigation": mitigation,
                "status": new_status,
                "resolved_at": now if new_status == "closed" else None,
            })
        else:
            await self._uow.risks.create({
                "title": title,
                "description": desc,
                "risk_type": risk_type,
                "severity": sev,
                "probability": prob,
                "impact": impact,
                "mitigation": mitigation,
                "status": status,
                "project_part_id": a.project_part_id,
            })

    async def sync_capacity_risks(self) -> int:
        """
        Deterministic Capacity-Driven Risk Engine.
        Scans all capacity assessments and ensures the Risk Registry is accurately synchronized.
        """
        assessments = await self._uow.capacity_assessments.get_multi(filters={}, limit=10000)
        if not assessments:
            return 0

        sync_count = 0
        for a in assessments:
            await self.sync_single_capacity_risk(a)
            sync_count += 1

        await self._uow.commit()
        return sync_count

    def _compute_risk_score(self, severity: str, probability: str) -> int:
        sev_val = _SEVERITY_MAP.get(severity.lower(), 1)
        prob_val = _PROBABILITY_MAP.get(probability.lower(), 1)
        return sev_val * prob_val

    def _to_response(self, risk: Any) -> RiskResponse:
        sev = risk.severity.value if hasattr(risk.severity, 'value') else str(risk.severity)
        prob = risk.probability.value if hasattr(risk.probability, 'value') else str(risk.probability)
        score = self._compute_risk_score(sev, prob)

        part_num = None
        part_name = None
        proj_name = None
        sup_name = None
        cap_id = None
        util_rate = None
        bottleneck = None
        gate = None

        if hasattr(risk, 'project_part') and risk.project_part:
            pt = risk.project_part
            part_num = getattr(pt, 'part_number', None) or getattr(pt, 'code', None)
            part_name = getattr(pt, 'name', None)
            if hasattr(pt, 'project') and pt.project:
                proj_name = getattr(pt.project, 'name', None)
            if hasattr(pt, 'supplier') and pt.supplier:
                sup_name = getattr(pt.supplier, 'name', None)
            if hasattr(pt, 'assessments') and pt.assessments:
                latest_ass = pt.assessments[0]
                cap_id = getattr(latest_ass, 'id', None)
                cur_c = float(getattr(latest_ass, 'current_capacity', 0) or 0)
                max_c = float(getattr(latest_ass, 'maximum_capacity', 0) or 0)
                util_rate = round((cur_c / max_c * 100), 1) if max_c > 0 else None
                bottleneck = getattr(latest_ass, 'bottleneck', None)
                gate = getattr(latest_ass, 'cate', None) or getattr(latest_ass, 'gate', None)

        return RiskResponse(
            id=risk.id,
            title=risk.title,
            description=risk.description,
            risk_type=risk.risk_type,
            severity=sev,
            probability=prob,
            risk_score=score,
            impact=risk.impact,
            mitigation=risk.mitigation,
            contingency=risk.contingency,
            status=risk.status,
            due_date=risk.due_date,
            resolved_at=risk.resolved_at,
            project_part_id=risk.project_part_id,
            assigned_to=risk.assigned_to,
            identified_by=risk.identified_by,
            created_at=risk.created_at,
            updated_at=risk.updated_at,
            part_number=part_num,
            part_name=part_name,
            project_name=proj_name,
            supplier_name=sup_name,
            capacity_assessment_id=cap_id,
            utilization_rate=util_rate,
            bottleneck=bottleneck,
            gate=gate,
        )
