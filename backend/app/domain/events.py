from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any
from uuid import UUID, uuid4


@dataclass(kw_only=True)
class BaseDomainEvent:
    event_id: UUID = field(default_factory=uuid4)
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    aggregate_id: str | None = None

    @property
    def event_type(self) -> str:
        return self.__class__.__name__


@dataclass(kw_only=True)
class ProjectCreatedEvent(BaseDomainEvent):
    project_id: str
    project_name: str
    project_code: str
    created_by: str
    metadata: dict[str, Any] | None = None


@dataclass(kw_only=True)
class ProjectUpdatedEvent(BaseDomainEvent):
    project_id: str
    updated_by: str
    changes: dict[str, tuple[Any, Any]]
    metadata: dict[str, Any] | None = None


@dataclass(kw_only=True)
class ProjectDeletedEvent(BaseDomainEvent):
    project_id: str
    project_name: str
    deleted_by: str
    reason: str | None = None
    metadata: dict[str, Any] | None = None


@dataclass(kw_only=True)
class CapacityAssessmentCreatedEvent(BaseDomainEvent):
    assessment_id: str
    project_id: str
    part_id: str
    assessed_by: str
    capacity_value: float
    metadata: dict[str, Any] | None = None


@dataclass(kw_only=True)
class CapacityAssessmentUpdatedEvent(BaseDomainEvent):
    assessment_id: str
    project_id: str
    part_id: str
    updated_by: str
    previous_value: float
    new_value: float
    metadata: dict[str, Any] | None = None


@dataclass(kw_only=True)
class RiskDetectedEvent(BaseDomainEvent):
    risk_id: str
    project_id: str
    part_id: str | None = None
    severity: str
    probability: str
    description: str
    detected_by: str
    metadata: dict[str, Any] | None = None


@dataclass(kw_only=True)
class RiskMitigatedEvent(BaseDomainEvent):
    risk_id: str
    project_id: str
    mitigated_by: str
    mitigation_action: str
    residual_severity: str
    residual_probability: str
    metadata: dict[str, Any] | None = None


@dataclass(kw_only=True)
class DocumentUploadedEvent(BaseDomainEvent):
    document_id: str
    project_id: str
    document_type: str
    file_name: str
    file_size: int
    uploaded_by: str
    metadata: dict[str, Any] | None = None


@dataclass(kw_only=True)
class UserLoggedInEvent(BaseDomainEvent):
    user_id: str
    email: str
    ip_address: str | None = None
    user_agent: str | None = None
    metadata: dict[str, Any] | None = None
