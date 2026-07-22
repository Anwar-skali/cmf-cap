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

        risk = await self._uow.risks.update(id, update_data)
        if risk is None:
            raise NotFoundException("Risk not found")

        await self._uow.activity_logs.create({
            "user_id": user_id,
            "action": ActivityAction.UPDATE.value,
            "resource_type": "risk",
            "resource_id": str(id),
            "details": {"updated_fields": list(update_data.keys())},
        })

        await self._uow.commit()
        return self._to_response(risk)

    async def delete_risk(self, id: uuid.UUID, user_id: uuid.UUID | None = None) -> bool:
        risk = await self._uow.risks.get(id)
        if risk is None:
            raise NotFoundException("Risk not found")

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

    def _compute_risk_score(self, severity: str, probability: str) -> int:
        sev_val = _SEVERITY_MAP.get(severity.lower(), 1)
        prob_val = _PROBABILITY_MAP.get(probability.lower(), 1)
        return sev_val * prob_val

    def _to_response(self, risk: Any) -> RiskResponse:
        sev = risk.severity.value if hasattr(risk.severity, 'value') else str(risk.severity)
        prob = risk.probability.value if hasattr(risk.probability, 'value') else str(risk.probability)
        score = self._compute_risk_score(sev, prob)
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
        )
