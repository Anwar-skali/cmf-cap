from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
    select,
)
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import Uuid

from app.domain.enums import CapacityStatus
from app.infrastructure.persistence.models.base import (
    Base,
    SoftDeleteMixin,
    TimestampMixin,
)


class CapacityAssessment(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "capacity_assessments"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    assessment_date: Mapped[date] = mapped_column(
        Date, server_default=func.current_date(), nullable=False
    )
    month: Mapped[int] = mapped_column(
        Integer, nullable=False
    )
    year: Mapped[int] = mapped_column(
        Integer, nullable=False
    )
    current_capacity: Mapped[Decimal] = mapped_column(
        Numeric(14, 4), nullable=False
    )
    maximum_capacity: Mapped[Decimal] = mapped_column(
        Numeric(14, 4), nullable=False
    )
    lead_time_days: Mapped[int | None] = mapped_column(
        Integer, nullable=True
    )
    cate: Mapped[str | None] = mapped_column(String(50), nullable=True)
    gate: Mapped[str | None] = mapped_column(String(50), nullable=True)
    target_week: Mapped[str | None] = mapped_column(String(50), nullable=True)
    forecast_week: Mapped[str | None] = mapped_column(String(50), nullable=True)
    completed_week: Mapped[str | None] = mapped_column(String(50), nullable=True)
    risk_level: Mapped[str | None] = mapped_column(String(50), nullable=True, default="low")
    bottleneck: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[CapacityStatus] = mapped_column(
        String(50), default=CapacityStatus.PENDING, nullable=False
    )

    project_part_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("project_parts.id", ondelete="CASCADE"),
        nullable=False,
    )
    supplier_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("suppliers.id", ondelete="CASCADE"),
        nullable=False,
    )
    assessed_by: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id"), nullable=True
    )

    project_part = relationship(
        "ProjectPart", back_populates="assessments", lazy="selectin"
    )
    supplier = relationship(
        "Supplier", back_populates="assessments", lazy="selectin"
    )

    @hybrid_property
    def utilization_rate(self) -> Decimal | None:
        if self.maximum_capacity and self.maximum_capacity > 0:
            return (self.current_capacity / self.maximum_capacity) * 100
        return None

    @utilization_rate.inplace.expression
    @classmethod
    def _utilization_rate_expression(cls) -> None:
        return select(
            (cls.current_capacity / cls.maximum_capacity) * 100
        ).label("utilization_rate")

    __table_args__ = (
        UniqueConstraint(
            "project_part_id",
            "supplier_id",
            "assessment_date",
            name="uq_assessment_part_supplier_date",
        ),
    )

    def __repr__(self) -> str:
        return (
            f"<CapacityAssessment {self.id} - "
            f"Part:{self.project_part_id} Supplier:{self.supplier_id}>"
        )



