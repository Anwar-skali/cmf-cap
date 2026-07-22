from __future__ import annotations

import uuid
from collections.abc import AsyncGenerator, Callable
from typing import Any

from fastapi import Depends, Header, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.services.activity_service import ActivityService
from app.application.services.auth_service import AuthService
from app.application.services.capacity_assessment_service import (
    CapacityAssessmentService,
)
from app.application.services.dashboard_service import DashboardService
from app.application.services.document_service import DocumentService
from app.application.services.notification_service import NotificationService
from app.application.services.project_part_service import ProjectPartService
from app.application.services.project_service import ProjectService
from app.application.services.risk_service import RiskService
from app.application.services.supplier_service import SupplierService
from app.application.services.user_service import UserService
from app.core.database import get_db as _get_db
from app.core.exceptions import ForbiddenException, UnauthorizedException
from app.core.logging import get_logger
from app.core.security import verify_access_token
from app.domain.enums import UserRole
from app.infrastructure.auth.rbac_service import RBACService
from app.infrastructure.notifications.email_service import EmailService
from app.infrastructure.persistence.models.user import User
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.infrastructure.storage.file_storage import FileStorageService

logger = get_logger(__name__)

security_scheme = HTTPBearer(auto_error=False)


async def get_db() -> AsyncGenerator[AsyncSession, Any]:
    async for session in _get_db():
        yield session


async def get_current_user(
    db: AsyncSession = Depends(get_db),
    credentials: HTTPAuthorizationCredentials | None = Depends(security_scheme),
    x_api_key: str | None = Header(None, include_in_schema=False),
) -> User:
    token = None
    if credentials is not None:
        token = credentials.credentials
    elif x_api_key is not None:
        token = x_api_key

    if token is None:
        raise UnauthorizedException("Not authenticated")

    payload = verify_access_token(token)
    if payload is None:
        raise UnauthorizedException("Invalid or expired token")

    user_id = payload.get("sub")
    if user_id is None:
        raise UnauthorizedException("Invalid token payload")

    from sqlalchemy import select

    from app.infrastructure.persistence.models.user import User

    stmt = select(User).where(User.id == uuid.UUID(user_id))
    result = await db.execute(stmt)
    user = result.scalars().first()

    if user is None:
        raise UnauthorizedException("User not found")

    return user


async def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    if not current_user.is_active:
        raise ForbiddenException("Inactive user account")
    return current_user


async def get_current_admin(
    current_user: User = Depends(get_current_active_user),
) -> User:
    if current_user.role != UserRole.ADMIN.value and not current_user.is_superuser:
        raise ForbiddenException("Admin privileges required")
    return current_user


def get_current_user_with_permission(
    resource: str, action: str
) -> Callable[[User], User]:
    async def _check_permission(
        current_user: User = Depends(get_current_active_user),
    ) -> User:
        rbac = RBACService()
        if not rbac.has_permission(current_user.role, resource, action):
            raise ForbiddenException(
                f"Missing permission: {action} on {resource}"
            )
        return current_user

    return _check_permission


async def get_unit_of_work(
    db: AsyncSession = Depends(get_db),
) -> AsyncGenerator[UnitOfWork, Any]:
    uow = UnitOfWork(session=db)
    try:
        yield uow
    finally:
        pass


async def get_rbac() -> RBACService:
    return RBACService()


async def get_file_storage() -> FileStorageService:
    return FileStorageService()


async def get_email_service() -> EmailService:
    return EmailService()


async def get_auth_service(
    uow: UnitOfWork = Depends(get_unit_of_work),
) -> AuthService:
    return AuthService(uow=uow)


async def get_user_service(
    uow: UnitOfWork = Depends(get_unit_of_work),
) -> UserService:
    return UserService(uow=uow)


async def get_project_service(
    uow: UnitOfWork = Depends(get_unit_of_work),
) -> ProjectService:
    return ProjectService(uow=uow)


async def get_project_part_service(
    uow: UnitOfWork = Depends(get_unit_of_work),
) -> ProjectPartService:
    return ProjectPartService(uow=uow)


async def get_supplier_service(
    uow: UnitOfWork = Depends(get_unit_of_work),
) -> SupplierService:
    return SupplierService(uow=uow)


async def get_capacity_assessment_service(
    uow: UnitOfWork = Depends(get_unit_of_work),
) -> CapacityAssessmentService:
    return CapacityAssessmentService(uow=uow)


async def get_risk_service(
    uow: UnitOfWork = Depends(get_unit_of_work),
) -> RiskService:
    return RiskService(uow=uow)


async def get_document_service(
    uow: UnitOfWork = Depends(get_unit_of_work),
    file_storage: FileStorageService = Depends(get_file_storage),
) -> DocumentService:
    return DocumentService(uow=uow, file_storage=file_storage)


async def get_notification_service(
    uow: UnitOfWork = Depends(get_unit_of_work),
) -> NotificationService:
    return NotificationService(uow=uow)


async def get_activity_service(
    uow: UnitOfWork = Depends(get_unit_of_work),
) -> ActivityService:
    return ActivityService(uow=uow)


async def get_dashboard_service(
    uow: UnitOfWork = Depends(get_unit_of_work),
) -> DashboardService:
    return DashboardService(uow=uow)
