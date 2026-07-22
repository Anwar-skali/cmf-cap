from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import or_, select

from app.infrastructure.persistence.models.user import User
from app.infrastructure.persistence.repositories.base import BaseRepository


class UserRepository(BaseRepository[User]):
    def __init__(self, session: Any) -> None:
        super().__init__(session=session, model=User)

    async def get_by_email(self, email: str) -> User | None:
        stmt = select(User).where(User.email == email, User.deleted_at.is_(None))
        result = await self._session.execute(stmt)
        return result.scalars().first()

    async def get_by_username(self, username: str) -> User | None:
        stmt = select(User).where(
            User.username == username, User.deleted_at.is_(None)
        )
        result = await self._session.execute(stmt)
        return result.scalars().first()

    async def get_active_users(self) -> list[User]:
        stmt = select(User).where(
            User.is_active.is_(True), User.deleted_at.is_(None)
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def search(self, query: str) -> list[User]:
        stmt = select(User).where(
            User.deleted_at.is_(None),
            or_(
                User.email.ilike(f"%{query}%"),
                User.username.ilike(f"%{query}%"),
                User.first_name.ilike(f"%{query}%"),
                User.last_name.ilike(f"%{query}%"),
            ),
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())
