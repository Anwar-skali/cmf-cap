from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import Uuid

from app.infrastructure.persistence.models.base import (
    Base,
    SoftDeleteMixin,
    TimestampMixin,
)


class ProjectSupplier(Base):
    __tablename__ = "project_suppliers"

    project_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("projects.id", ondelete="CASCADE"),
        primary_key=True,
    )
    supplier_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("suppliers.id", ondelete="CASCADE"),
        primary_key=True,
    )
    role: Mapped[str | None] = mapped_column(String(50), nullable=True)
    contract_start: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    contract_end: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


class Supplier(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "suppliers"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    code: Mapped[str] = mapped_column(
        String(50), unique=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    contact_person: Mapped[str | None] = mapped_column(
        String(255), nullable=True
    )
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    country: Mapped[str | None] = mapped_column(String(100), nullable=True)
    postal_code: Mapped[str | None] = mapped_column(
        String(20), nullable=True
    )
    website: Mapped[str | None] = mapped_column(String(500), nullable=True)
    status: Mapped[str | None] = mapped_column(
        String(50), default="active", nullable=True
    )
    category: Mapped[str | None] = mapped_column(String(100), nullable=True)
    rating: Mapped[int | None] = mapped_column(
        Integer, nullable=True
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    projects = relationship(
        "Project",
        secondary="project_suppliers",
        back_populates="suppliers",
        lazy="selectin",
    )
    assessments = relationship(
        "CapacityAssessment", back_populates="supplier", lazy="selectin"
    )

    __table_args__ = (
        Index("ix_suppliers_code", "code"),
        Index("ix_suppliers_name", "name"),
        Index("ix_suppliers_status", "status"),
    )

    def __repr__(self) -> str:
        return f"<Supplier {self.code}: {self.name}>"
