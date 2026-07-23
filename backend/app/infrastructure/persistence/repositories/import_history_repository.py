from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import select

from app.infrastructure.persistence.models.import_history import ImportHistory
from app.infrastructure.persistence.repositories.base import BaseRepository


class ImportHistoryRepository(BaseRepository[ImportHistory]):
    def __init__(self, session: Any) -> None:
        super().__init__(session=session, model=ImportHistory)

    async def get_by_entity(self, entity_type: str) -> list[ImportHistory]:
        stmt = (
            select(ImportHistory)
            .where(ImportHistory.entity_type == entity_type)
            .order_by(ImportHistory.created_at.desc())
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def get_recent_history(self, limit: int = 50) -> list[ImportHistory]:
        stmt = (
            select(ImportHistory)
            .order_by(ImportHistory.created_at.desc())
            .limit(limit)
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())
