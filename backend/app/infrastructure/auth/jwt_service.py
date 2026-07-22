from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    verify_refresh_token,
)
from app.infrastructure.persistence.models.session import Session


class JWTService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create_tokens(
        self, user_id: uuid.UUID, role: str
    ) -> dict[str, Any]:
        token_data = {"sub": str(user_id), "role": role}
        access_token = create_access_token(data=token_data)
        refresh_token = create_refresh_token(data=token_data)

        expires_at = datetime.now(timezone.utc) + timedelta(
            days=settings.REFRESH_TOKEN_EXPIRE_DAYS
        )
        session_record = Session(
            user_id=user_id,
            refresh_token=refresh_token,
            expires_at=expires_at,
        )
        self._session.add(session_record)
        await self._session.flush()

        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
        }

    async def refresh_access_token(
        self, refresh_token: str
    ) -> dict[str, Any] | None:
        payload = verify_refresh_token(refresh_token)
        if payload is None:
            return None

        user_id = payload.get("sub")
        if user_id is None:
            return None

        from sqlalchemy import select

        stmt = select(Session).where(
            Session.refresh_token == refresh_token,
            Session.is_revoked.is_(False),
            Session.expires_at > datetime.now(timezone.utc),
        )
        result = await self._session.execute(stmt)
        session_record = result.scalars().first()
        if session_record is None:
            return None

        new_token_data = {
            "sub": user_id,
            "role": payload.get("role", "viewer"),
        }
        new_access_token = create_access_token(data=new_token_data)

        return {
            "access_token": new_access_token,
            "token_type": "bearer",
        }

    async def verify_access_token(
        self, token: str
    ) -> dict[str, Any] | None:
        from app.core.security import verify_access_token as verify

        return verify(token)

    async def revoke_refresh_token(self, token: str) -> bool:
        from sqlalchemy import select, update

        stmt = select(Session).where(Session.refresh_token == token)
        result = await self._session.execute(stmt)
        session_record = result.scalars().first()
        if session_record is None:
            return False

        session_record.is_revoked = True
        session_record.revoked_at = datetime.now(timezone.utc)
        self._session.add(session_record)
        await self._session.flush()
        return True

    async def revoke_all_user_tokens(self, user_id: uuid.UUID) -> int:
        from sqlalchemy import update

        stmt = (
            update(Session)
            .where(
                Session.user_id == user_id,
                Session.is_revoked.is_(False),
            )
            .values(
                is_revoked=True,
                revoked_at=datetime.now(timezone.utc),
            )
        )
        result = await self._session.execute(stmt)
        await self._session.flush()
        return result.rowcount
