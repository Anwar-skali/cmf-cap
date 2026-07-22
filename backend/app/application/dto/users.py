from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator


class CreateUserRequest(BaseModel):
    email: EmailStr
    username: str = Field(..., min_length=3, max_length=100)
    password: str = Field(..., min_length=8)
    confirm_password: str = Field(..., min_length=1)
    first_name: str | None = Field(None, max_length=100)
    last_name: str | None = Field(None, max_length=100)
    role: str = "viewer"
    is_active: bool = True
    phone: str | None = Field(None, max_length=50)

    @model_validator(mode="after")
    def passwords_match(self) -> CreateUserRequest:
        if self.password != self.confirm_password:
            raise ValueError("password and confirm_password do not match")
        return self

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if not any(c.isupper() for c in v):
            raise ValueError("password must contain at least one uppercase letter")
        if not any(c.islower() for c in v):
            raise ValueError("password must contain at least one lowercase letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("password must contain at least one digit")
        return v


class UpdateUserRequest(BaseModel):
    email: EmailStr | None = None
    first_name: str | None = Field(None, max_length=100)
    last_name: str | None = Field(None, max_length=100)
    role: str | None = None
    is_active: bool | None = None
    phone: str | None = Field(None, max_length=50)


class UserFilter(BaseModel):
    search: str | None = None
    role: str | None = None
    is_active: bool | None = None
    skip: int = Field(default=0, ge=0)
    limit: int = Field(default=20, ge=1, le=100)
    sort_by: str | None = "created_at"
    sort_desc: bool = True


class UserListResponse(BaseModel):
    items: list[Any]
    total: int
    skip: int = 0
    limit: int = 20


class UserProfileResponse(BaseModel):
    id: Any
    email: str
    username: str
    first_name: str | None = None
    last_name: str | None = None
    role: str
    is_active: bool
    phone: str | None = None
    avatar_url: str | None = None
    last_login: datetime | None = None
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class UserResponse(BaseModel):
    id: Any
    email: str
    first_name: str | None = None
    last_name: str | None = None
    role: str = "viewer"
    is_active: bool = True
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class UpdateProfileRequest(BaseModel):
    first_name: str | None = Field(None, max_length=100)
    last_name: str | None = Field(None, max_length=100)
    phone: str | None = Field(None, max_length=50)
    avatar_url: str | None = Field(None, max_length=500)
