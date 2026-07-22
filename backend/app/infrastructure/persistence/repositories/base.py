from __future__ import annotations

import uuid
from typing import Any, Generic, TypeVar

from pydantic import BaseModel
from sqlalchemy import func, select, update, delete as sa_delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.persistence.models.base import (
    Base,
    SoftDeleteMixin,
)

ModelT = TypeVar("ModelT", bound=Base)


class BaseRepository(Generic[ModelT]):
    def __init__(self, session: AsyncSession, model: type[ModelT]) -> None:
        self._session = session
        self._model = model

    async def get(self, id: uuid.UUID) -> ModelT | None:
        stmt = select(self._model).where(self._model.id == id)
        if issubclass(self._model, SoftDeleteMixin):
            stmt = stmt.where(self._model.deleted_at.is_(None))
        result = await self._session.execute(stmt)
        return result.scalars().first()

    async def get_multi(
        self,
        skip: int = 0,
        limit: int = 100,
        sort_by: str | None = None,
        sort_desc: bool = False,
        filters: dict[str, Any] | None = None,
    ) -> list[ModelT]:
        stmt = select(self._model)
        if issubclass(self._model, SoftDeleteMixin):
            stmt = stmt.where(self._model.deleted_at.is_(None))
        if filters:
            stmt = self._apply_filters(stmt, filters)
        if sort_by and hasattr(self._model, sort_by):
            sort_col = getattr(self._model, sort_by)
            stmt = stmt.order_by(sort_col.desc() if sort_desc else sort_col.asc())
        stmt = stmt.offset(skip).limit(limit)
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def create(self, data: dict[str, Any] | BaseModel) -> ModelT:
        if isinstance(data, BaseModel):
            data = data.model_dump(exclude_unset=True)
        obj = self._model(**data)
        self._session.add(obj)
        await self._session.flush()
        await self._session.refresh(obj)
        return obj

    async def update(
        self,
        id: uuid.UUID,
        data: dict[str, Any] | BaseModel,
    ) -> ModelT | None:
        if isinstance(data, BaseModel):
            data = data.model_dump(exclude_unset=True, exclude_none=True)
        elif isinstance(data, dict):
            data = {k: v for k, v in data.items() if v is not None}
        stmt = (
            update(self._model)
            .where(self._model.id == id)
            .values(**data)
            .returning(self._model)
        )
        if issubclass(self._model, SoftDeleteMixin):
            stmt = stmt.where(self._model.deleted_at.is_(None))
        result = await self._session.execute(stmt)
        await self._session.flush()
        return result.scalars().first()

    async def delete(self, id: uuid.UUID) -> bool:
        obj = await self.get(id)
        if obj is None:
            return False
        if isinstance(obj, SoftDeleteMixin):
            from datetime import datetime, timezone

            obj.deleted_at = datetime.now(timezone.utc)
            self._session.add(obj)
            await self._session.flush()
            return True
        await self._session.delete(obj)
        await self._session.flush()
        return True

    async def hard_delete(self, id: uuid.UUID) -> bool:
        stmt = sa_delete(self._model).where(self._model.id == id)
        result = await self._session.execute(stmt)
        await self._session.flush()
        return result.rowcount > 0

    async def count(self, filters: dict[str, Any] | None = None) -> int:
        stmt = select(func.count(self._model.id))
        if issubclass(self._model, SoftDeleteMixin):
            stmt = stmt.where(self._model.deleted_at.is_(None))
        if filters:
            stmt = self._apply_filters(stmt, filters)
        result = await self._session.execute(stmt)
        return result.scalar() or 0

    async def exists(self, id: uuid.UUID) -> bool:
        count = await self.count(filters={"id": id})
        return count > 0

    def _apply_filters(
        self,
        stmt: Any,
        filters: dict[str, Any],
    ) -> Any:
        for key, value in filters.items():
            if not hasattr(self._model, key):
                continue
            column = getattr(self._model, key)
            if isinstance(value, (list, tuple)):
                stmt = stmt.where(column.in_(value))
            elif isinstance(value, dict):
                for op, val in value.items():
                    if op == "gte":
                        stmt = stmt.where(column >= val)
                    elif op == "gt":
                        stmt = stmt.where(column > val)
                    elif op == "lte":
                        stmt = stmt.where(column <= val)
                    elif op == "lt":
                        stmt = stmt.where(column < val)
                    elif op == "ne":
                        stmt = stmt.where(column != val)
                    elif op == "like":
                        stmt = stmt.where(column.ilike(f"%{val}%"))
                    elif op == "in":
                        stmt = stmt.where(column.in_(val))
                    else:
                        stmt = stmt.where(column == val)
            else:
                stmt = stmt.where(column == value)
        return stmt
