from __future__ import annotations

from typing import Any


class BaseAppException(Exception):
    def __init__(
        self,
        message: str = "An application error occurred",
        status_code: int = 500,
        code: str = "INTERNAL_ERROR",
        details: dict[str, Any] | None = None,
    ) -> None:
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details or {}
        super().__init__(self.message)

    def __str__(self) -> str:
        return f"[{self.code}] {self.message}"

    def to_dict(self) -> dict[str, Any]:
        return {
            "code": self.code,
            "message": self.message,
            "status_code": self.status_code,
            "details": self.details,
        }


class NotFoundException(BaseAppException):
    def __init__(
        self,
        message: str = "Resource not found",
        code: str = "NOT_FOUND",
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message=message, status_code=404, code=code, details=details)


class UnauthorizedException(BaseAppException):
    def __init__(
        self,
        message: str = "Authentication required",
        code: str = "UNAUTHORIZED",
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message=message, status_code=401, code=code, details=details)


class ForbiddenException(BaseAppException):
    def __init__(
        self,
        message: str = "You do not have permission to perform this action",
        code: str = "FORBIDDEN",
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message=message, status_code=403, code=code, details=details)


class BadRequestException(BaseAppException):
    def __init__(
        self,
        message: str = "Bad request",
        code: str = "BAD_REQUEST",
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message=message, status_code=400, code=code, details=details)


class ConflictException(BaseAppException):
    def __init__(
        self,
        message: str = "Resource already exists",
        code: str = "CONFLICT",
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message=message, status_code=409, code=code, details=details)


class ValidationException(BaseAppException):
    def __init__(
        self,
        message: str = "Validation failed",
        code: str = "VALIDATION_ERROR",
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message=message, status_code=422, code=code, details=details)


class RateLimitException(BaseAppException):
    def __init__(
        self,
        message: str = "Rate limit exceeded. Please try again later.",
        code: str = "RATE_LIMIT_EXCEEDED",
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message=message, status_code=429, code=code, details=details)


class AppException(BaseAppException):
    def __init__(
        self,
        message: str = "An application error occurred",
        status_code: int = 500,
        error_code: str = "APP_ERROR",
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message=message, status_code=status_code, code=error_code, details=details)
