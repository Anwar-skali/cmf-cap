from __future__ import annotations

import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.persistence.models.template import Template
from app.infrastructure.persistence.models.template_version import TemplateVersion
from app.infrastructure.persistence.repositories.base import BaseRepository


class TemplateRepository(BaseRepository[Template]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, Template)

    async def get_by_code(self, code: str) -> Template | None:
        stmt = (
            select(Template)
            .where(Template.code == code)
            .where(Template.deleted_at.is_(None))
        )
        result = await self._session.execute(stmt)
        return result.scalars().first()

    async def get_by_code_including_deleted(self, code: str) -> Template | None:
        stmt = select(Template).where(Template.code == code)
        result = await self._session.execute(stmt)
        return result.scalars().first()

    async def undelete(self, id: uuid.UUID) -> Template | None:
        obj = await self._session.get(Template, id)
        if obj is None:
            return None
        obj.deleted_at = None
        await self._session.flush()
        await self._session.refresh(obj)
        return obj

    async def revive(self, id: uuid.UUID, data: dict[str, Any]) -> Template | None:
        """Update a soft-deleted template's fields and restore it (deleted_at = NULL)."""
        obj = await self._session.get(Template, id)
        if obj is None:
            return None
        for key, value in data.items():
            if hasattr(obj, key):
                setattr(obj, key, value)
        obj.deleted_at = None
        await self._session.flush()
        await self._session.refresh(obj)
        return obj

    async def get_published(self, code: str) -> Template | None:
        stmt = (
            select(Template)
            .where(Template.code == code)
            .where(Template.status == "PUBLISHED")
            .where(Template.deleted_at.is_(None))
        )
        result = await self._session.execute(stmt)
        return result.scalars().first()

    async def create_version(self, template_id: uuid.UUID, version: str, schema_json: dict, change_log: str | None = None) -> TemplateVersion:
        tv = TemplateVersion(
            template_id=template_id,
            version=version,
            schema_json=schema_json,
            change_log=change_log
        )
        self._session.add(tv)
        await self._session.flush()
        await self._session.refresh(tv)
        return tv

    async def get_versions(self, template_id: uuid.UUID) -> list[TemplateVersion]:
        stmt = (
            select(TemplateVersion)
            .where(TemplateVersion.template_id == template_id)
            .order_by(TemplateVersion.created_at.desc())
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())
