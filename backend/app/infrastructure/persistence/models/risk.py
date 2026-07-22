from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import Uuid

from app.domain.enums import RiskProbability, RiskSeverity
from app.infrastructure.persistence.models.base import (
    Base,
    SoftDeleteMixin,
    TimestampMixin,
)

_SEVERITY_MAP: dict[RiskSeverity, int] = {
    RiskSeverity.LOW: 1,
    RiskSeverity.MEDIUM: 2,
    RiskSeverity.HIGH: 3,
    RiskSeverity.CRITICAL: 4,
}

_PROBABILITY_MAP: dict[RiskProbability, int] = {
    RiskProbability.RARE: 1,
    RiskProbability.UNLIKELY: 2,
    RiskProbability.POSSIBLE: 3,
    RiskProbability.LIKELY: 4,
    RiskProbability.ALMOST_CERTAIN: 5,
}


class Risk(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "risks"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    risk_type: Mapped[str | None] = mapped_column(
        String(50), nullable=True
    )
    severity: Mapped[RiskSeverity] = mapped_column(
        String(50), default=RiskSeverity.MEDIUM, nullable=False
    )
    probability: Mapped[RiskProbability] = mapped_column(
        String(50), default=RiskProbability.POSSIBLE, nullable=False
    )
    impact: Mapped[str | None] = mapped_column(Text, nullable=True)
    mitigation: Mapped[str | None] = mapped_column(Text, nullable=True)
    contingency: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(
        String(50), default="open", nullable=False
    )
    due_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    resolved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    project_part_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("project_parts.id", ondelete="CASCADE"),
        nullable=False,
    )
    assigned_to: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id"), nullable=True
    )
    identified_by: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id"), nullable=True
    )

    project_part = relationship(
        "ProjectPart", back_populates="risks", lazy="selectin"
    )
    assignee = relationship(
        "User",
        foreign_keys=[assigned_to],
        lazy="selectin",
    )
    identifier = relationship(
        "User",
        foreign_keys=[identified_by],
        lazy="selectin",
    )

    @hybrid_property
    def risk_score(self) -> int:
        severity_val = _SEVERITY_MAP.get(self.severity, 1)
        probability_val = _PROBABILITY_MAP.get(self.probability, 1)
        return severity_val * probability_val

    @risk_score.inplace.expression
    @classmethod
    def _risk_score_expression(cls) -> None:
        from sqlalchemy import case

        sev = case(
            _SEVERITY_MAP,
            value=cls.severity,
            else_=1,
        )
        prob = case(
            _PROBABILITY_MAP,
            value=cls.probability,
            else_=1,
        )
        return (sev * prob).label("risk_score")

    def __repr__(self) -> str:
        return f"<Risk {self.title} [{self.severity}/{self.probability}]>"
