from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import select

from app.infrastructure.persistence.models.document import Document
from app.infrastructure.persistence.repositories.base import BaseRepository


class DocumentRepository(BaseRepository[Document]):
    def __init__(self, session: Any) -> None:
        super().__init__(session=session, model=Document)

    async def get_by_project(
        self, project_id: uuid.UUID
    ) -> list[Document]:
        stmt = select(Document).where(
            Document.project_id == project_id,
            Document.deleted_at.is_(None),
        ).order_by(Document.created_at.desc())
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def get_by_part(
        self, project_part_id: uuid.UUID
    ) -> list[Document]:
        stmt = select(Document).where(
            Document.project_part_id == project_part_id,
            Document.deleted_at.is_(None),
        ).order_by(Document.created_at.desc())
        result = await self._session.execute(stmt)
        return list(result.scalars().all())
