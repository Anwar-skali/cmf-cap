from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import or_, select

from app.infrastructure.persistence.models.project_part import ProjectPart
from app.infrastructure.persistence.repositories.base import BaseRepository


class ProjectPartRepository(BaseRepository[ProjectPart]):
    def __init__(self, session: Any) -> None:
        super().__init__(session=session, model=ProjectPart)

    async def get_by_project(
        self, project_id: uuid.UUID
    ) -> list[ProjectPart]:
        stmt = select(ProjectPart).where(
            ProjectPart.project_id == project_id,
            ProjectPart.deleted_at.is_(None),
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def get_by_part_number(
        self, part_number: str
    ) -> ProjectPart | None:
        stmt = select(ProjectPart).where(
            ProjectPart.part_number == part_number,
            ProjectPart.deleted_at.is_(None),
        )
        result = await self._session.execute(stmt)
        return result.scalars().first()

    async def search(
        self,
        query: str,
        project_id: uuid.UUID | None = None,
    ) -> list[ProjectPart]:
        conditions = [ProjectPart.deleted_at.is_(None)]
        if project_id:
            conditions.append(ProjectPart.project_id == project_id)
        conditions.append(
            or_(
                ProjectPart.part_number.ilike(f"%{query}%"),
                ProjectPart.name.ilike(f"%{query}%"),
                ProjectPart.description.ilike(f"%{query}%"),
            )
        )
        stmt = select(ProjectPart).where(*conditions)
        result = await self._session.execute(stmt)
        return list(result.scalars().all())
