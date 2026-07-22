from __future__ import annotations

import uuid
from typing import Any

from app.application.dto.users import (
    CreateUserRequest,
    UpdateUserRequest,
    UpdateProfileRequest,
    UserFilter,
    UserListResponse,
    UserProfileResponse,
    UserResponse,
)
from app.application.interfaces.services import IUnitOfWork
from app.core.exceptions import (
    ConflictException,
    ForbiddenException,
    NotFoundException,
)
from app.core.security import get_password_hash
from app.domain.enums import ActivityAction


class UserService:
    def __init__(self, uow: IUnitOfWork) -> None:
        self._uow = uow

    async def get_users(self, filter: UserFilter) -> UserListResponse:
        filters: dict[str, Any] = {}
        if filter.role is not None:
            filters["role"] = filter.role
        if filter.is_active is not None:
            filters["is_active"] = filter.is_active

        if filter.search:
            items = await self._uow.users.search(filter.search)
            total = len(items)
            skip = filter.skip or 0
            limit = filter.limit or 20
            items = items[skip : skip + limit]
        else:
            total = await self._uow.users.count(filters=filters)
            items = await self._uow.users.get_multi(
                skip=filter.skip,
                limit=filter.limit,
                sort_by=filter.sort_by,
                sort_desc=filter.sort_desc,
                filters=filters,
            )

        return UserListResponse(
            items=[self._to_response(u) for u in items],
            total=total,
            skip=filter.skip,
            limit=filter.limit,
        )

    async def get_user(self, id: uuid.UUID) -> UserResponse:
        user = await self._uow.users.get(id)
        if user is None:
            raise NotFoundException("User not found")
        return self._to_response(user)

    async def create_user(self, data: CreateUserRequest) -> UserResponse:
        existing = await self._uow.users.get_by_email(data.email)
        if existing is not None:
            raise ConflictException("A user with this email already exists")

        existing_username = await self._uow.users.get_by_username(data.username)
        if existing_username is not None:
            raise ConflictException("A user with this username already exists")

        user_data = {
            "email": data.email,
            "username": data.username,
            "password_hash": get_password_hash(data.password),
            "first_name": data.first_name,
            "last_name": data.last_name,
            "role": data.role,
            "is_active": data.is_active,
            "phone": data.phone,
        }
        user = await self._uow.users.create(user_data)

        await self._uow.activity_logs.create({
            "user_id": user.id,
            "action": ActivityAction.CREATE.value,
            "resource_type": "user",
            "resource_id": str(user.id),
            "details": {"email": data.email, "role": data.role},
        })

        await self._uow.commit()
        return self._to_response(user)

    async def update_user(self, id: uuid.UUID, data: UpdateUserRequest) -> UserResponse:
        user = await self._uow.users.get(id)
        if user is None:
            raise NotFoundException("User not found")

        update_data = data.model_dump(exclude_unset=True, exclude_none=True)
        if not update_data:
            return self._to_response(user)

        if "email" in update_data and update_data["email"] != user.email:
            existing = await self._uow.users.get_by_email(update_data["email"])
            if existing is not None:
                raise ConflictException("A user with this email already exists")

        user = await self._uow.users.update(id, update_data)
        if user is None:
            raise NotFoundException("User not found")

        await self._uow.activity_logs.create({
            "user_id": id,
            "action": ActivityAction.UPDATE.value,
            "resource_type": "user",
            "resource_id": str(id),
            "details": {"updated_fields": list(update_data.keys())},
        })

        await self._uow.commit()
        return self._to_response(user)

    async def delete_user(self, id: uuid.UUID) -> bool:
        user = await self._uow.users.get(id)
        if user is None:
            raise NotFoundException("User not found")

        result = await self._uow.users.delete(id)

        await self._uow.activity_logs.create({
            "user_id": id,
            "action": ActivityAction.DELETE.value,
            "resource_type": "user",
            "resource_id": str(id),
        })

        await self._uow.commit()
        return result

    async def get_profile(self, id: uuid.UUID) -> UserProfileResponse:
        user = await self._uow.users.get(id)
        if user is None:
            raise NotFoundException("User not found")
        return UserProfileResponse(
            id=user.id,
            email=user.email,
            username=user.username,
            first_name=user.first_name,
            last_name=user.last_name,
            role=user.role,
            is_active=user.is_active,
            phone=user.phone,
            avatar_url=user.avatar_url,
            last_login=user.last_login,
            created_at=user.created_at,
        )

    async def update_profile(self, id: uuid.UUID, data: UpdateProfileRequest) -> UserProfileResponse:
        user = await self._uow.users.get(id)
        if user is None:
            raise NotFoundException("User not found")

        update_data = data.model_dump(exclude_unset=True, exclude_none=True)
        if update_data:
            user = await self._uow.users.update(id, update_data)
            if user is None:
                raise NotFoundException("User not found")
            await self._uow.commit()

        return UserProfileResponse(
            id=user.id,
            email=user.email,
            username=user.username,
            first_name=user.first_name,
            last_name=user.last_name,
            role=user.role,
            is_active=user.is_active,
            phone=user.phone,
            avatar_url=user.avatar_url,
            last_login=user.last_login,
            created_at=user.created_at,
        )

    def _to_response(self, user: Any) -> UserResponse:
        return UserResponse(
            id=user.id,
            email=user.email,
            first_name=user.first_name,
            last_name=user.last_name,
            role=user.role,
            is_active=user.is_active,
            created_at=user.created_at,
        )
