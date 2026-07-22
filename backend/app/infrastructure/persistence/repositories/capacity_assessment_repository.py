from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import func, select

from app.infrastructure.persistence.models.capacity_assessment import (
    CapacityAssessment,
)
from app.infrastructure.persistence.repositories.base import BaseRepository


class CapacityAssessmentRepository(BaseRepository[CapacityAssessment]):
    def __init__(self, session: Any) -> None:
        super().__init__(session=session, model=CapacityAssessment)

    async def get_by_part(
        self, project_part_id: uuid.UUID
    ) -> list[CapacityAssessment]:
        stmt = select(CapacityAssessment).where(
            CapacityAssessment.project_part_id == project_part_id,
            CapacityAssessment.deleted_at.is_(None),
        ).order_by(CapacityAssessment.year.desc(), CapacityAssessment.month.desc())
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def get_by_supplier(
        self, supplier_id: uuid.UUID
    ) -> list[CapacityAssessment]:
        stmt = select(CapacityAssessment).where(
            CapacityAssessment.supplier_id == supplier_id,
            CapacityAssessment.deleted_at.is_(None),
        ).order_by(CapacityAssessment.year.desc(), CapacityAssessment.month.desc())
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def get_by_month(
        self, year: int, month: int
    ) -> list[CapacityAssessment]:
        stmt = select(CapacityAssessment).where(
            CapacityAssessment.year == year,
            CapacityAssessment.month == month,
            CapacityAssessment.deleted_at.is_(None),
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def get_coverage_stats(self) -> dict[str, Any]:
        base = CapacityAssessment.deleted_at.is_(None)
        total = await self.count(filters={})
        pending = await self.count(filters={"status": "pending"})
        assessed = await self.count(filters={"status": "assessed"})
        confirmed = await self.count(filters={"status": "confirmed"})
        avg_util = await self._session.execute(
            select(func.avg(
                CapacityAssessment.current_capacity /
                CapacityAssessment.maximum_capacity * 100
            )).where(base)
        )
        return {
            "total": total,
            "pending": pending,
            "assessed": assessed,
            "confirmed": confirmed,
            "average_utilization": float(avg_util.scalar() or 0),
        }
