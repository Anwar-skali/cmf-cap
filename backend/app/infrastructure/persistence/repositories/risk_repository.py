from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import func, select

from app.domain.enums import RiskSeverity
from app.infrastructure.persistence.models.risk import Risk
from app.infrastructure.persistence.repositories.base import BaseRepository


class RiskRepository(BaseRepository[Risk]):
    def __init__(self, session: Any) -> None:
        super().__init__(session=session, model=Risk)

    async def get_by_part(
        self, project_part_id: uuid.UUID
    ) -> list[Risk]:
        stmt = select(Risk).where(
            Risk.project_part_id == project_part_id,
            Risk.deleted_at.is_(None),
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def get_open_risks(self) -> list[Risk]:
        stmt = select(Risk).where(
            Risk.status == "open",
            Risk.deleted_at.is_(None),
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def get_by_severity(
        self, severity: RiskSeverity
    ) -> list[Risk]:
        stmt = select(Risk).where(
            Risk.severity == severity,
            Risk.deleted_at.is_(None),
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def get_risk_distribution(self) -> dict[str, Any]:
        base = Risk.deleted_at.is_(None)
        total = await self.count(filters={})
        open_count = await self.count(filters={"status": "open"})
        mitigated = await self.count(filters={"status": "mitigated"})
        closed = await self.count(filters={"status": "closed"})
        accepted = await self.count(filters={"status": "accepted"})
        severity_counts = {}
        for sev in RiskSeverity:
            cnt = await self.count(filters={"severity": sev})
            severity_counts[sev.value] = cnt
        return {
            "total": total,
            "open": open_count,
            "mitigated": mitigated,
            "closed": closed,
            "accepted": accepted,
            "by_severity": severity_counts,
        }
