from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import Uuid

from app.domain.enums import UserRole
from app.infrastructure.persistence.models.base import (
    AuditMixin,
    Base,
    SoftDeleteMixin,
    TimestampMixin,
)


class User(Base, TimestampMixin, SoftDeleteMixin, AuditMixin):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    email: Mapped[str] = mapped_column(
        String(255), unique=True, index=True, nullable=False
    )
    username: Mapped[str] = mapped_column(
        String(100), unique=True, index=True, nullable=False
    )
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    first_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    last_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False
    )
    is_superuser: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )
    role: Mapped[UserRole] = mapped_column(
        String(50), default=UserRole.VIEWER, nullable=False
    )
    avatar_url: Mapped[str | None] = mapped_column(
        String(500), nullable=True
    )
    last_login: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)

    refresh_tokens = relationship(
        "Session", back_populates="user", lazy="selectin"
    )
    notifications = relationship(
        "Notification", back_populates="user", lazy="selectin"
    )
    activity_logs = relationship(
        "ActivityLog", back_populates="user", lazy="selectin"
    )
    documents = relationship(
        "Document", back_populates="uploader", lazy="selectin"
    )

    def __repr__(self) -> str:
        return f"<User {self.username} ({self.email})>"
