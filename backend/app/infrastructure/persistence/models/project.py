from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    Date,
    JSON,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import Uuid

from app.domain.enums import ProjectStatus
from app.infrastructure.persistence.models.base import (
    Base,
    SoftDeleteMixin,
    TimestampMixin,
)


class Project(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "projects"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    code: Mapped[str] = mapped_column(
        String(50), unique=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[ProjectStatus] = mapped_column(
        String(50), default=ProjectStatus.DRAFT, nullable=False
    )
    priority: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    start_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    end_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    client_name: Mapped[str | None] = mapped_column(
        String(255), nullable=True
    )
    budget: Mapped[Decimal | None] = mapped_column(
        Numeric(12, 2), nullable=True
    )
    currency: Mapped[str] = mapped_column(
        String(3), default="EUR", nullable=False
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    buyer_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id"), nullable=True
    )
    sqd_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id"), nullable=True
    )
    capacity_manager_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id"), nullable=True
    )
    template_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("templates.id"), nullable=True
    )
    template_version: Mapped[str | None] = mapped_column(
        String(20), nullable=True
    )
    data: Mapped[dict | None] = mapped_column(
        JSON, nullable=True, default=dict
    )

    parts = relationship(
        "ProjectPart", back_populates="project", lazy="selectin"
    )
    documents = relationship(
        "Document", back_populates="project", lazy="selectin"
    )
    suppliers = relationship(
        "Supplier",
        secondary="project_suppliers",
        back_populates="projects",
        lazy="selectin",
    )

    __table_args__ = (
        Index("ix_projects_code_status", "code", "status"),
        Index("ix_projects_name", "name"),
    )

    def __repr__(self) -> str:
        return f"<Project {self.code}: {self.name}>"
