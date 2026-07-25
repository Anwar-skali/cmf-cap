from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshTokenRequest(BaseModel):
    refresh_token: str = Field(..., min_length=1)


class ChangePasswordRequest(BaseModel):
    old_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=8)
    confirm_password: str = Field(..., min_length=1)

    @model_validator(mode="after")
    def passwords_match(self) -> ChangePasswordRequest:
        if self.new_password != self.confirm_password:
            raise ValueError("new_password and confirm_password do not match")
        return self

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if not any(c.isupper() for c in v):
            raise ValueError("password must contain at least one uppercase letter")
        if not any(c.islower() for c in v):
            raise ValueError("password must contain at least one lowercase letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("password must contain at least one digit")
        return v


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=8)
    confirm_password: str = Field(..., min_length=1)

    @model_validator(mode="after")
    def passwords_match(self) -> ResetPasswordRequest:
        if self.new_password != self.confirm_password:
            raise ValueError("new_password and confirm_password do not match")
        return self

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if not any(c.isupper() for c in v):
            raise ValueError("password must contain at least one uppercase letter")
        if not any(c.islower() for c in v):
            raise ValueError("password must contain at least one lowercase letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("password must contain at least one digit")
        return v


ALLOWED_REGISTER_ROLES = {"buyer", "capacity_manager", "sqd"}


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)
    confirm_password: str = Field(..., min_length=1)
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    role: str = Field(default="buyer")

    @model_validator(mode="after")
    def passwords_match(self) -> RegisterRequest:
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

    @field_validator("role")
    @classmethod
    def role_must_be_allowed(cls, v: str) -> str:
        if v not in ALLOWED_REGISTER_ROLES:
            raise ValueError(
                f"role must be one of: {', '.join(sorted(ALLOWED_REGISTER_ROLES))}"
            )
        return v

    @field_validator("first_name", "last_name")
    @classmethod
    def name_validation(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("name cannot be only whitespace")
        return v.strip()


class UserResponse(BaseModel):
    id: Any
    email: str
    first_name: str | None = None
    last_name: str | None = None
    role: str = "viewer"
    is_active: bool = True
    created_at: datetime | None = None

    model_config = {"from_attributes": True}
