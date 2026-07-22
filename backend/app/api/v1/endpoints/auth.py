from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends, Request

from app.application.dto.auth import (
    ChangePasswordRequest,
    ForgotPasswordRequest,
    LoginRequest,
    RefreshTokenRequest,
    RegisterRequest,
    ResetPasswordRequest,
    TokenResponse,
    UserResponse,
)
from app.application.dto.users import UpdateProfileRequest, UserProfileResponse
from app.application.services.auth_service import AuthService
from app.application.services.user_service import UserService
from app.api.deps import (
    get_auth_service,
    get_current_active_user,
    get_user_service,
)
from app.infrastructure.persistence.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/auth", tags=["Authentication"])


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Authenticate user and return tokens",
)
async def login(
    request: Request,
    data: LoginRequest,
    auth_service: AuthService = Depends(get_auth_service),
) -> Any:
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    return await auth_service.login(
        email=data.email,
        password=data.password,
        ip_address=ip_address,
        user_agent=user_agent,
    )


@router.post(
    "/register",
    response_model=UserResponse,
    summary="Register a new user account",
)
async def register(
    data: RegisterRequest,
    auth_service: AuthService = Depends(get_auth_service),
) -> Any:
    return await auth_service.register(data)


@router.post(
    "/refresh",
    response_model=TokenResponse,
    summary="Refresh access token using refresh token",
)
async def refresh(
    data: RefreshTokenRequest,
    auth_service: AuthService = Depends(get_auth_service),
) -> Any:
    return await auth_service.refresh(data.refresh_token)


@router.post(
    "/logout",
    summary="Logout and revoke refresh token",
)
async def logout(
    data: RefreshTokenRequest,
    current_user: User = Depends(get_current_active_user),
    auth_service: AuthService = Depends(get_auth_service),
) -> dict[str, bool]:
    result = await auth_service.logout(data.refresh_token)
    return {"success": result}


@router.post(
    "/change-password",
    summary="Change current user password",
)
async def change_password(
    data: ChangePasswordRequest,
    current_user: User = Depends(get_current_active_user),
    auth_service: AuthService = Depends(get_auth_service),
) -> dict[str, bool]:
    return {
        "success": await auth_service.change_password(
            user_id=current_user.id,
            old_password=data.old_password,
            new_password=data.new_password,
        )
    }


@router.post(
    "/forgot-password",
    summary="Request password reset email",
)
async def forgot_password(
    data: ForgotPasswordRequest,
    auth_service: AuthService = Depends(get_auth_service),
) -> dict[str, bool]:
    await auth_service.request_password_reset(email=data.email)
    return {"success": True}


@router.post(
    "/reset-password",
    summary="Reset password using reset token",
)
async def reset_password(
    data: ResetPasswordRequest,
    auth_service: AuthService = Depends(get_auth_service),
) -> dict[str, bool]:
    return {
        "success": await auth_service.reset_password(
            token=data.token,
            new_password=data.new_password,
        )
    }


@router.get(
    "/me",
    response_model=UserProfileResponse,
    summary="Get current user profile",
)
async def get_me(
    current_user: User = Depends(get_current_active_user),
    user_service: UserService = Depends(get_user_service),
) -> Any:
    return await user_service.get_profile(current_user.id)


@router.put(
    "/me",
    response_model=UserProfileResponse,
    summary="Update current user profile",
)
async def update_me(
    data: UpdateProfileRequest,
    current_user: User = Depends(get_current_active_user),
    user_service: UserService = Depends(get_user_service),
) -> Any:
    return await user_service.update_profile(current_user.id, data)
