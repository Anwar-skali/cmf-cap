from __future__ import annotations

import logging
import uuid
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from typing import Any

import time

from fastapi import FastAPI, Request
from fastapi.exception_handlers import request_validation_exception_handler
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.exceptions import BaseAppException, RateLimitException
from app.core.logging import get_logger, setup_logging

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, Any]:
    setup_logging()
    logger.info("Starting CMF Platform API")
    if settings.is_development:
        _create_tables_if_sqlite()
    yield
    logger.info("Shutting down CMF Platform API")


def _create_tables_if_sqlite() -> None:
    try:
        from app.infrastructure.persistence.models.base import Base
        from app.core.database import sync_engine

        Base.metadata.create_all(bind=sync_engine)
        logger.info("Database tables created (SQLite)")
    except Exception as exc:
        logger.warning("Could not create tables: %s", exc)


def create_application() -> FastAPI:
    app = FastAPI(
        title=settings.PROJECT_NAME,
        version=settings.VERSION,
        lifespan=lifespan,
        docs_url="/api/docs" if settings.is_development else None,
        redoc_url="/api/redoc" if settings.is_development else None,
        openapi_url="/api/openapi.json" if settings.is_development else None,
        redirect_slashes=False,
    )

    _configure_strip_trailing_slash(app)
    _configure_cors(app)
    _configure_exception_handlers(app)
    _configure_middleware(app)
    _include_routers(app)

    return app


def _configure_strip_trailing_slash(app: FastAPI) -> None:
    @app.middleware("http")
    async def strip_trailing_slash_middleware(request: Request, call_next: Any) -> Any:
        path = request.scope.get("path", "")
        if len(path) > 1 and path.endswith("/"):
            request.scope["path"] = path.rstrip("/")
        return await call_next(request)


def _configure_cors(app: FastAPI) -> None:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Request-ID", "X-API-Key"],
    )


RATE_LIMIT_WINDOW = 60
RATE_LIMIT_MAX_REQUESTS = 60


def _configure_middleware(app: FastAPI) -> None:
    rate_limit_store: dict[str, list[float]] = {}

    @app.middleware("http")
    async def request_id_middleware(request: Request, call_next: Any) -> Any:
        request_id = request.headers.get(
            "X-Request-ID", str(uuid.uuid4())
        )
        from app.core.logging import JSONFormatter

        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response

    @app.middleware("http")
    async def logging_middleware(request: Request, call_next: Any) -> Any:
        request_id = request.headers.get("X-Request-ID", "")
        logger.info(
            "%s %s", request.method, request.url.path,
            extra={"request_id": request_id},
        )
        response = await call_next(request)
        logger.info(
            "%s %s -> %d", request.method, request.url.path, response.status_code,
            extra={"request_id": request_id},
        )
        return response

    @app.middleware("http")
    async def rate_limit_middleware(request: Request, call_next: Any) -> Any:
        auth_paths = ["/api/v1/auth/login", "/api/v1/auth/register", "/api/v1/auth/forgot-password", "/api/v1/auth/reset-password"]
        if request.url.path in auth_paths:
            client_ip = request.client.host if request.client else "unknown"
            now = time.time()
            timestamps = rate_limit_store.setdefault(f"auth:{client_ip}", [])
            cutoff = now - 10
            timestamps[:] = [t for t in timestamps if t > cutoff]

            max_auth_attempts = 5
            if len(timestamps) >= max_auth_attempts:
                raise RateLimitException(
                    message="Too many authentication attempts. Please try again later.",
                    details={"retry_after_seconds": 10},
                )
            timestamps.append(now)

        response = await call_next(request)
        return response


def _configure_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(BaseAppException)
    async def base_app_exception_handler(
        request: Request, exc: BaseAppException
    ) -> JSONResponse:
        logger.warning(
            "%s: %s",
            exc.__class__.__name__,
            exc.message,
            extra={"request_id": request.headers.get("X-Request-ID", "")},
        )
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": {
                    "code": exc.code,
                    "message": exc.message,
                    "details": exc.details,
                }
            },
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        logger.warning(
            "Validation error: %s",
            exc.errors(),
            extra={"request_id": request.headers.get("X-Request-ID", "")},
        )
        return JSONResponse(
            status_code=422,
            content={
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": "Request validation failed",
                    "details": {"fields": exc.errors()},
                }
            },
        )

    @app.exception_handler(404)
    async def custom_404_handler(
        request: Request, exc: Exception
    ) -> JSONResponse:
        return JSONResponse(
            status_code=404,
            content={
                "error": {
                    "code": "NOT_FOUND",
                    "message": "The requested resource was not found",
                    "details": {"path": str(request.url.path)},
                }
            },
        )

    @app.exception_handler(405)
    async def custom_405_handler(
        request: Request, exc: Exception
    ) -> JSONResponse:
        return JSONResponse(
            status_code=405,
            content={
                "error": {
                    "code": "METHOD_NOT_ALLOWED",
                    "message": "Method not allowed",
                    "details": {"method": request.method},
                }
            },
        )

    @app.exception_handler(Exception)
    async def generic_exception_handler(
        request: Request, exc: Exception
    ) -> JSONResponse:
        logger.exception(
            "Unhandled exception: %s",
            str(exc),
            extra={"request_id": request.headers.get("X-Request-ID", "")},
        )
        return JSONResponse(
            status_code=500,
            content={
                "error": {
                    "code": "INTERNAL_ERROR",
                    "message": "An unexpected error occurred",
                    "details": {},
                }
            },
        )


def _include_routers(app: FastAPI) -> None:
    from app.api.v1.endpoints.auth import router as auth_router
    from app.api.v1.endpoints.users import router as users_router
    from app.api.v1.endpoints.projects import router as projects_router
    from app.api.v1.endpoints.project_parts import router as project_parts_router
    from app.api.v1.endpoints.parts import router as parts_router
    from app.api.v1.endpoints.suppliers import router as suppliers_router
    from app.api.v1.endpoints.capacity import router as capacity_router
    from app.api.v1.endpoints.risks import router as risks_router
    from app.api.v1.endpoints.documents import router as documents_router
    from app.api.v1.endpoints.notifications import router as notifications_router
    from app.api.v1.endpoints.activity import router as activity_router
    from app.api.v1.endpoints.dashboard import router as dashboard_router

    app.include_router(auth_router)
    app.include_router(users_router)
    app.include_router(projects_router)
    app.include_router(project_parts_router)
    app.include_router(parts_router)
    app.include_router(suppliers_router)
    app.include_router(capacity_router)
    app.include_router(risks_router)
    app.include_router(documents_router)
    app.include_router(notifications_router)
    app.include_router(activity_router)
    app.include_router(dashboard_router)

    @app.get("/api/v1/health", tags=["Health"])
    async def health_check() -> dict[str, Any]:
        return {
            "status": "healthy",
            "version": settings.VERSION,
            "environment": settings.ENVIRONMENT,
        }


app = create_application()
