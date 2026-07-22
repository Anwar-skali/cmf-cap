from __future__ import annotations

import uuid
from typing import Any

from app.domain.enums import PermissionAction, UserRole

PERMISSION_DEFINITIONS: dict[str, dict[str, list[UserRole]]] = {
    "users": {
        PermissionAction.CREATE: [UserRole.ADMIN],
        PermissionAction.READ: [
            UserRole.ADMIN,
            UserRole.CAPACITY_MANAGER,
            UserRole.BUYER,
            UserRole.SQD,
            UserRole.VIEWER,
        ],
        PermissionAction.UPDATE: [UserRole.ADMIN, UserRole.CAPACITY_MANAGER],
        PermissionAction.DELETE: [UserRole.ADMIN],
    },
    "projects": {
        PermissionAction.CREATE: [
            UserRole.ADMIN,
            UserRole.CAPACITY_MANAGER,
            UserRole.BUYER,
        ],
        PermissionAction.READ: [
            UserRole.ADMIN,
            UserRole.CAPACITY_MANAGER,
            UserRole.BUYER,
            UserRole.SQD,
            UserRole.VIEWER,
        ],
        PermissionAction.UPDATE: [
            UserRole.ADMIN,
            UserRole.CAPACITY_MANAGER,
            UserRole.BUYER,
        ],
        PermissionAction.DELETE: [UserRole.ADMIN],
        PermissionAction.APPROVE: [UserRole.ADMIN, UserRole.CAPACITY_MANAGER],
    },
    "project_parts": {
        PermissionAction.CREATE: [
            UserRole.ADMIN,
            UserRole.CAPACITY_MANAGER,
            UserRole.BUYER,
        ],
        PermissionAction.READ: [
            UserRole.ADMIN,
            UserRole.CAPACITY_MANAGER,
            UserRole.BUYER,
            UserRole.SQD,
            UserRole.VIEWER,
        ],
        PermissionAction.UPDATE: [
            UserRole.ADMIN,
            UserRole.CAPACITY_MANAGER,
            UserRole.BUYER,
        ],
        PermissionAction.DELETE: [UserRole.ADMIN],
    },
    "suppliers": {
        PermissionAction.CREATE: [
            UserRole.ADMIN,
            UserRole.CAPACITY_MANAGER,
            UserRole.BUYER,
        ],
        PermissionAction.READ: [
            UserRole.ADMIN,
            UserRole.CAPACITY_MANAGER,
            UserRole.BUYER,
            UserRole.SQD,
            UserRole.VIEWER,
        ],
        PermissionAction.UPDATE: [
            UserRole.ADMIN,
            UserRole.CAPACITY_MANAGER,
            UserRole.BUYER,
        ],
        PermissionAction.DELETE: [UserRole.ADMIN],
    },
    "capacity_assessments": {
        PermissionAction.CREATE: [
            UserRole.ADMIN,
            UserRole.CAPACITY_MANAGER,
        ],
        PermissionAction.READ: [
            UserRole.ADMIN,
            UserRole.CAPACITY_MANAGER,
            UserRole.BUYER,
            UserRole.SQD,
            UserRole.VIEWER,
        ],
        PermissionAction.UPDATE: [
            UserRole.ADMIN,
            UserRole.CAPACITY_MANAGER,
        ],
        PermissionAction.DELETE: [UserRole.ADMIN],
        PermissionAction.APPROVE: [UserRole.ADMIN, UserRole.CAPACITY_MANAGER],
    },
    "risks": {
        PermissionAction.CREATE: [
            UserRole.ADMIN,
            UserRole.CAPACITY_MANAGER,
            UserRole.BUYER,
            UserRole.SQD,
        ],
        PermissionAction.READ: [
            UserRole.ADMIN,
            UserRole.CAPACITY_MANAGER,
            UserRole.BUYER,
            UserRole.SQD,
            UserRole.VIEWER,
        ],
        PermissionAction.UPDATE: [
            UserRole.ADMIN,
            UserRole.CAPACITY_MANAGER,
            UserRole.BUYER,
            UserRole.SQD,
        ],
        PermissionAction.DELETE: [UserRole.ADMIN],
    },
    "documents": {
        PermissionAction.CREATE: [
            UserRole.ADMIN,
            UserRole.CAPACITY_MANAGER,
            UserRole.BUYER,
            UserRole.SQD,
        ],
        PermissionAction.READ: [
            UserRole.ADMIN,
            UserRole.CAPACITY_MANAGER,
            UserRole.BUYER,
            UserRole.SQD,
            UserRole.VIEWER,
        ],
        PermissionAction.UPDATE: [
            UserRole.ADMIN,
            UserRole.CAPACITY_MANAGER,
            UserRole.BUYER,
            UserRole.SQD,
        ],
        PermissionAction.DELETE: [UserRole.ADMIN],
    },
    "reports": {
        PermissionAction.CREATE: [
            UserRole.ADMIN,
            UserRole.CAPACITY_MANAGER,
            UserRole.BUYER,
            UserRole.SQD,
        ],
        PermissionAction.READ: [
            UserRole.ADMIN,
            UserRole.CAPACITY_MANAGER,
            UserRole.BUYER,
            UserRole.SQD,
            UserRole.VIEWER,
        ],
        PermissionAction.EXPORT: [
            UserRole.ADMIN,
            UserRole.CAPACITY_MANAGER,
            UserRole.BUYER,
            UserRole.SQD,
        ],
    },
    "settings": {
        PermissionAction.READ: [
            UserRole.ADMIN,
            UserRole.CAPACITY_MANAGER,
        ],
        PermissionAction.UPDATE: [UserRole.ADMIN],
    },
}


class RBACService:
    def __init__(self) -> None:
        self._permission_cache: dict[str, set[str]] = {}

    def _get_cache_key(self, user_id: uuid.UUID) -> str:
        return str(user_id)

    def has_permission(
        self,
        user_role: UserRole | str,
        resource: str,
        action: str,
    ) -> bool:
        if isinstance(user_role, str):
            try:
                user_role = UserRole(user_role)
            except ValueError:
                return False
        if user_role == UserRole.ADMIN:
            return True
        resource_perms = PERMISSION_DEFINITIONS.get(resource)
        if resource_perms is None:
            return False
        allowed_roles = resource_perms.get(action)
        if allowed_roles is None:
            return False
        return user_role in allowed_roles

    def has_role(self, user_role: UserRole | str, role: UserRole) -> bool:
        if isinstance(user_role, str):
            try:
                user_role = UserRole(user_role)
            except ValueError:
                return False
        return user_role == role

    def get_all_permissions(
        self, user_role: UserRole | str
    ) -> list[dict[str, str]]:
        if isinstance(user_role, str):
            try:
                user_role = UserRole(user_role)
            except ValueError:
                return []
        permissions: list[dict[str, str]] = []
        for resource, actions in PERMISSION_DEFINITIONS.items():
            for action, allowed_roles in actions.items():
                if user_role in allowed_roles or user_role == UserRole.ADMIN:
                    permissions.append(
                        {"resource": resource, "action": action}
                    )
        if user_role == UserRole.ADMIN:
            for resource, actions in PERMISSION_DEFINITIONS.items():
                for action in actions:
                    entry = {"resource": resource, "action": action}
                    if entry not in permissions:
                        permissions.append(entry)
        return permissions

    def filter_permissions(
        self, user_role: UserRole | str, resource: str
    ) -> list[str]:
        if isinstance(user_role, str):
            try:
                user_role = UserRole(user_role)
            except ValueError:
                return []
        resource_perms = PERMISSION_DEFINITIONS.get(resource, {})
        allowed: list[str] = []
        for action, allowed_roles in resource_perms.items():
            if user_role in allowed_roles or user_role == UserRole.ADMIN:
                allowed.append(action)
        return allowed

    def invalidate_cache(self, user_id: uuid.UUID) -> None:
        key = self._get_cache_key(user_id)
        self._permission_cache.pop(key, None)
