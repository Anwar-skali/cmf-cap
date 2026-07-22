from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from app.application.dto.auth import (
    LoginRequest,
    RefreshTokenRequest,
    RegisterRequest,
    ResetPasswordRequest,
    TokenResponse,
    UserResponse,
)
from app.application.interfaces.services import ICacheService, IEmailService, IUnitOfWork
from app.core.config import settings
from app.core.exceptions import (
    BadRequestException,
    ConflictException,
    NotFoundException,
    UnauthorizedException,
)
from app.core.security import (
    create_access_token,
    create_refresh_token,
    get_password_hash,
    verify_access_token,
    verify_password,
    verify_refresh_token,
)
from app.domain.enums import ActivityAction, UserRole


class AuthService:
    def __init__(
        self,
        uow: IUnitOfWork,
        cache_service: ICacheService | None = None,
        email_service: IEmailService | None = None,
    ) -> None:
        self._uow = uow
        self._cache = cache_service
        self._email = email_service

    async def login(
        self,
        email: str,
        password: str,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> TokenResponse:
        user = await self._uow.users.get_by_email(email)
        if user is None or not user.is_active:
            raise UnauthorizedException("Invalid email or password")

        if not verify_password(password, user.password_hash):
            raise UnauthorizedException("Invalid email or password")

        token_data = {"sub": str(user.id), "role": user.role}
        access_token = create_access_token(data=token_data)
        refresh_token = create_refresh_token(data=token_data)

        from app.infrastructure.persistence.models.session import Session

        session = Session(
            user_id=user.id,
            refresh_token=refresh_token,
            expires_at=datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
            ip_address=ip_address,
            user_agent=user_agent,
        )
        self._uow.session.add(session)

        user.last_login = datetime.now(timezone.utc)
        await self._uow.users.update(user.id, {"last_login": user.last_login})

        await self._uow.activity_logs.create({
            "user_id": user.id,
            "action": ActivityAction.LOGIN.value,
            "resource_type": "auth",
            "resource_id": str(user.id),
            "details": {"email": email},
            "ip_address": ip_address,
            "user_agent": user_agent,
        })

        await self._uow.commit()

        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
        )

    async def logout(self, refresh_token: str) -> bool:
        payload = verify_refresh_token(refresh_token)
        if payload is None:
            return False

        from sqlalchemy import select
        from app.infrastructure.persistence.models.session import Session

        stmt = select(Session).where(Session.refresh_token == refresh_token)
        result = await self._uow.session.execute(stmt)
        session_record = result.scalars().first()
        if session_record is None:
            return False

        session_record.is_revoked = True
        session_record.revoked_at = datetime.now(timezone.utc)
        await self._uow.commit()
        return True

    async def refresh(self, refresh_token: str) -> TokenResponse:
        from sqlalchemy.exc import IntegrityError

        for attempt in range(2):
            try:
                return await self._perform_refresh(refresh_token)
            except IntegrityError:
                await self._uow.rollback()
                if attempt == 0:
                    continue
                raise UnauthorizedException(
                    "Session refresh failed due to a concurrent request"
                ) from None

        raise UnauthorizedException("Session refresh failed")

    async def _perform_refresh(self, refresh_token: str) -> TokenResponse:
        payload = verify_refresh_token(refresh_token)
        if payload is None:
            raise UnauthorizedException("Invalid or expired refresh token")

        user_id = payload.get("sub")
        if user_id is None:
            raise UnauthorizedException("Invalid refresh token")

        from sqlalchemy import select
        from app.infrastructure.persistence.models.session import Session

        stmt = select(Session).where(
            Session.refresh_token == refresh_token,
            Session.is_revoked.is_(False),
            Session.expires_at > datetime.now(timezone.utc),
        )
        result = await self._uow.session.execute(stmt)
        session_record = result.scalars().first()
        if session_record is None:
            raise UnauthorizedException("Session expired or revoked")

        user = await self._uow.users.get(uuid.UUID(user_id))
        if user is None or not user.is_active:
            raise UnauthorizedException("User not found or inactive")

        session_record.is_revoked = True
        session_record.revoked_at = datetime.now(timezone.utc)

        await self._uow.session.flush()

        token_data = {"sub": str(user.id), "role": user.role}
        new_access = create_access_token(data=token_data)
        new_refresh = create_refresh_token(data=token_data)

        new_session = Session(
            user_id=user.id,
            refresh_token=new_refresh,
            expires_at=datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        )
        self._uow.session.add(new_session)
        try:
            await self._uow.commit()
        except IntegrityError:
            await self._uow.rollback()
            raise

        return TokenResponse(
            access_token=new_access,
            refresh_token=new_refresh,
            token_type="bearer",
        )

    async def change_password(
        self, user_id: uuid.UUID, old_password: str, new_password: str
    ) -> bool:
        user = await self._uow.users.get(user_id)
        if user is None:
            raise NotFoundException("User not found")

        if not verify_password(old_password, user.password_hash):
            raise BadRequestException("Current password is incorrect")

        user.password_hash = get_password_hash(new_password)
        await self._uow.users.update(user.id, {"password_hash": user.password_hash})
        await self._uow.commit()
        return True

    async def request_password_reset(self, email: str) -> bool:
        user = await self._uow.users.get_by_email(email)
        if user is None:
            return True

        from app.core.security import create_access_token
        token = create_access_token(
            data={"sub": str(user.id), "purpose": "password_reset"},
            expires_delta=timedelta(hours=1),
        )

        from app.infrastructure.persistence.models.password_reset import PasswordResetToken
        reset_token = PasswordResetToken(
            user_id=user.id,
            token=token,
            expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
        )
        self._uow.session.add(reset_token)
        await self._uow.commit()

        if self._email is not None:
            await self._email.send_password_reset(email=email, token=token)

        return True

    async def reset_password(self, token: str, new_password: str) -> bool:
        payload = verify_access_token(token)
        if payload is None or payload.get("purpose") != "password_reset":
            raise BadRequestException("Invalid or expired reset token")

        user_id = payload.get("sub")
        if user_id is None:
            raise BadRequestException("Invalid reset token")

        from sqlalchemy import select
        from app.infrastructure.persistence.models.password_reset import PasswordResetToken

        stmt = select(PasswordResetToken).where(
            PasswordResetToken.token == token,
            PasswordResetToken.is_used.is_(False),
            PasswordResetToken.expires_at > datetime.now(timezone.utc),
        )
        result = await self._uow.session.execute(stmt)
        reset_record = result.scalars().first()
        if reset_record is None:
            raise BadRequestException("Reset token not found or already used")

        user = await self._uow.users.get(uuid.UUID(user_id))
        if user is None:
            raise NotFoundException("User not found")

        user.password_hash = get_password_hash(new_password)
        reset_record.is_used = True
        reset_record.used_at = datetime.now(timezone.utc)

        await self._uow.commit()
        return True

    async def register(self, data: RegisterRequest) -> UserResponse:
        existing = await self._uow.users.get_by_email(data.email)
        if existing is not None:
            raise ConflictException("A user with this email already exists")

        existing_username = await self._uow.users.get_by_username(data.email.split("@")[0])
        username = data.email.split("@")[0]
        if existing_username is not None:
            username = f"{username}_{uuid.uuid4().hex[:6]}"

        admin_count = await self._uow.users.count(
            filters={"role": UserRole.ADMIN.value}
        )
        role = (
            UserRole.ADMIN.value
            if admin_count == 0
            else UserRole.VIEWER.value
        )

        user_data = {
            "email": data.email,
            "username": username,
            "password_hash": get_password_hash(data.password),
            "first_name": data.first_name,
            "last_name": data.last_name,
            "role": role,
            "is_active": True,
        }
        user = await self._uow.users.create(user_data)

        await self._uow.activity_logs.create({
            "user_id": user.id,
            "action": ActivityAction.CREATE.value,
            "resource_type": "user",
            "resource_id": str(user.id),
            "details": {"email": data.email},
        })

        await self._uow.commit()

        return UserResponse(
            id=user.id,
            email=user.email,
            first_name=user.first_name,
            last_name=user.last_name,
            role=user.role,
            is_active=user.is_active,
            created_at=user.created_at,
        )
