from __future__ import annotations

from typing import Any

from sqlalchemy import func, or_, select

from app.infrastructure.persistence.models.supplier import Supplier
from app.infrastructure.persistence.repositories.base import BaseRepository


class SupplierRepository(BaseRepository[Supplier]):
    def __init__(self, session: Any) -> None:
        super().__init__(session=session, model=Supplier)

    async def get_by_code(self, code: str) -> Supplier | None:
        stmt = select(Supplier).where(
            Supplier.code == code, Supplier.deleted_at.is_(None)
        )
        result = await self._session.execute(stmt)
        return result.scalars().first()

    async def search(
        self,
        query: str,
        filters: dict[str, Any] | None = None,
    ) -> tuple[list[Supplier], int]:
        base_condition = Supplier.deleted_at.is_(None)
        search_condition = or_(
            Supplier.code.ilike(f"%{query}%"),
            Supplier.name.ilike(f"%{query}%"),
            Supplier.contact_person.ilike(f"%{query}%"),
            Supplier.email.ilike(f"%{query}%"),
            Supplier.city.ilike(f"%{query}%"),
            Supplier.country.ilike(f"%{query}%"),
            Supplier.category.ilike(f"%{query}%"),
        )
        stmt = select(Supplier).where(base_condition, search_condition)
        count_stmt = select(func.count(Supplier.id)).where(
            base_condition, search_condition
        )
        if filters:
            stmt = self._apply_filters(stmt, filters)
            count_stmt = self._apply_filters(count_stmt, filters)
        result = await self._session.execute(stmt)
        suppliers = list(result.scalars().all())
        count_result = await self._session.execute(count_stmt)
        total = count_result.scalar() or 0
        return suppliers, total

    async def get_top_suppliers(self, limit: int = 5) -> list[Supplier]:
        stmt = (
            select(Supplier)
            .where(Supplier.deleted_at.is_(None))
            .order_by(Supplier.rating.desc().nullslast())
            .limit(limit)
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())
