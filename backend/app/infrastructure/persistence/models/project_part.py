from __future__ import annotations

import uuid
from decimal import Decimal

from sqlalchemy import (
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import Uuid

from app.domain.enums import PartStatus
from app.infrastructure.persistence.models.base import (
    Base,
    SoftDeleteMixin,
    TimestampMixin,
)


class ProjectPart(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "project_parts"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    part_number: Mapped[str] = mapped_column(
        String(100), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[PartStatus] = mapped_column(
        String(50), default=PartStatus.ACTIVE, nullable=False
    )
    quantity: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    unit: Mapped[str] = mapped_column(String(50), default="pcs", nullable=False)
    weight: Mapped[Decimal | None] = mapped_column(
        Numeric(10, 3), nullable=True
    )
    material: Mapped[str | None] = mapped_column(String(255), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    project_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )

    project = relationship("Project", back_populates="parts", lazy="selectin")
    assessments = relationship(
        "CapacityAssessment", back_populates="project_part", lazy="selectin"
    )
    risks = relationship(
        "Risk", back_populates="project_part", lazy="selectin"
    )
    documents = relationship(
        "Document", back_populates="project_part", lazy="selectin"
    )

    __table_args__ = (
        UniqueConstraint(
            "project_id", "part_number", name="uq_project_part_number"
        ),
        Index("ix_project_parts_number", "part_number"),
        Index("ix_project_parts_name", "name"),
        Index("ix_project_parts_status", "status"),
    )

    def __repr__(self) -> str:
        return f"<ProjectPart {self.part_number}: {self.name}>"
