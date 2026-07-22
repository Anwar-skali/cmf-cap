from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import func, or_, select

from app.domain.enums import ProjectStatus
from app.infrastructure.persistence.models.project import Project
from app.infrastructure.persistence.repositories.base import BaseRepository


class ProjectRepository(BaseRepository[Project]):
    def __init__(self, session: Any) -> None:
        super().__init__(session=session, model=Project)

    async def get_by_code(self, code: str) -> Project | None:
        stmt = select(Project).where(
            Project.code == code, Project.deleted_at.is_(None)
        )
        result = await self._session.execute(stmt)
        return result.scalars().first()

    async def get_by_status(self, status: ProjectStatus) -> list[Project]:
        stmt = select(Project).where(
            Project.status == status, Project.deleted_at.is_(None)
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def get_delayed_projects(self) -> list[Project]:
        now = datetime.now(timezone.utc)
        stmt = select(Project).where(
            Project.deleted_at.is_(None),
            Project.end_date.isnot(None),
            Project.end_date < now,
            Project.status.in_(
                [
                    ProjectStatus.ACTIVE,
                    ProjectStatus.DRAFT,
                    ProjectStatus.ON_HOLD,
                ]
            ),
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def search(
        self,
        query: str,
        filters: dict[str, Any] | None = None,
    ) -> tuple[list[Project], int]:
        base_condition = Project.deleted_at.is_(None)
        search_condition = or_(
            Project.code.ilike(f"%{query}%"),
            Project.name.ilike(f"%{query}%"),
            Project.client_name.ilike(f"%{query}%"),
            Project.description.ilike(f"%{query}%"),
        )
        stmt = select(Project).where(base_condition, search_condition)
        count_stmt = select(func.count(Project.id)).where(
            base_condition, search_condition
        )
        if filters:
            stmt = self._apply_filters(stmt, filters)
            count_stmt = self._apply_filters(count_stmt, filters)
        result = await self._session.execute(stmt)
        projects = list(result.scalars().all())
        count_result = await self._session.execute(count_stmt)
        total = count_result.scalar() or 0
        return projects, total

    async def get_dashboard_stats(self) -> dict[str, Any]:
        base = Project.deleted_at.is_(None)
        total = await self.count(filters={})
        active = await self.count(
            filters={"status": ProjectStatus.ACTIVE}
        )
        delayed = len(await self.get_delayed_projects())
        on_hold = await self.count(
            filters={"status": ProjectStatus.ON_HOLD}
        )
        completed = await self.count(
            filters={"status": ProjectStatus.COMPLETED}
        )
        return {
            "total": total,
            "active": active,
            "delayed": delayed,
            "on_hold": on_hold,
            "completed": completed,
        }
