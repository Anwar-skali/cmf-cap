from __future__ import annotations

from enum import StrEnum, auto


class ProjectStatus(StrEnum):
    DRAFT = auto()
    ACTIVE = auto()
    ON_HOLD = auto()
    COMPLETED = auto()
    CANCELLED = auto()


class PartStatus(StrEnum):
    ACTIVE = auto()
    INACTIVE = auto()
    OBSOLETE = auto()


class RiskSeverity(StrEnum):
    LOW = auto()
    MEDIUM = auto()
    HIGH = auto()
    CRITICAL = auto()


class RiskProbability(StrEnum):
    RARE = auto()
    UNLIKELY = auto()
    POSSIBLE = auto()
    LIKELY = auto()
    ALMOST_CERTAIN = auto()


class CapacityStatus(StrEnum):
    PENDING = auto()
    ASSESSED = auto()
    CONFIRMED = auto()
    REJECTED = auto()


class UserRole(StrEnum):
    ADMIN = auto()
    CAPACITY_MANAGER = auto()
    BUYER = auto()
    SQD = auto()
    VIEWER = auto()


class NotificationType(StrEnum):
    INFO = auto()
    WARNING = auto()
    ERROR = auto()
    SUCCESS = auto()


class DocumentType(StrEnum):
    SPECIFICATION = auto()
    REPORT = auto()
    CONTRACT = auto()
    DRAWING = auto()
    OTHER = auto()


class ActivityAction(StrEnum):
    CREATE = auto()
    UPDATE = auto()
    DELETE = auto()
    VIEW = auto()
    EXPORT = auto()
    IMPORT = auto()
    LOGIN = auto()
    LOGOUT = auto()


class PermissionAction(StrEnum):
    CREATE = auto()
    READ = auto()
    UPDATE = auto()
    DELETE = auto()
    EXPORT = auto()
    IMPORT = auto()
    APPROVE = auto()
    REJECT = auto()
