from __future__ import annotations

import uuid

from sqlalchemy import (
    ForeignKey,
    Index,
    String,
    Text,
)
from sqlalchemy import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import Uuid

from app.infrastructure.persistence.models.base import Base, TimestampMixin


class ActivityLog(Base, TimestampMixin):
    __tablename__ = "activity_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    resource_type: Mapped[str] = mapped_column(String(100), nullable=False)
    resource_id: Mapped[str] = mapped_column(String(100), nullable=False)
    details: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    ip_address: Mapped[str | None] = mapped_column(
        String(50), nullable=True
    )
    user_agent: Mapped[str | None] = mapped_column(Text, nullable=True)

    user_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    user = relationship("User", back_populates="activity_logs", lazy="selectin")

    __table_args__ = (
        Index(
            "ix_activity_logs_user_resource",
            "user_id",
            "resource_type",
            "resource_id",
            "created_at",
        ),
    )
