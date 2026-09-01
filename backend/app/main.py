from __future__ import annotations

import logging
import uuid
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from typing import Any

import time

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
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
    _init_database()
    yield
    logger.info("Shutting down CMF Platform API")


def _init_database() -> None:
    """Ensure all database tables exist, run self-healing migrations, and seed superuser."""
    try:
        from app.infrastructure.persistence.models.base import Base
        import app.infrastructure.persistence.models  # noqa: F401
        from app.core.database import sync_engine
        from sqlalchemy import inspect, text

        # 1. Create all tables on the database (works for PostgreSQL & SQLite)
        Base.metadata.create_all(bind=sync_engine)
        logger.info("Database tables verified/created successfully")

        # 2. Run Alembic in production if available
        if not settings.is_development:
            _run_alembic_migrations()

        # 3. Self-healing migration for new capacity_assessments columns
        inspector = inspect(sync_engine)
        if "capacity_assessments" in inspector.get_table_names():
            existing_cols = {c["name"] for c in inspector.get_columns("capacity_assessments")}
            new_columns = [
                ("cate", "VARCHAR(50)"),
                ("gate", "VARCHAR(50)"),
                ("target_week", "VARCHAR(50)"),
                ("forecast_week", "VARCHAR(50)"),
                ("completed_week", "VARCHAR(50)"),
                ("risk_level", "VARCHAR(50) DEFAULT 'low'"),
            ]
            with sync_engine.begin() as conn:
                for col_name, col_type in new_columns:
                    if col_name not in existing_cols:
                        conn.execute(text(f"ALTER TABLE capacity_assessments ADD COLUMN {col_name} {col_type}"))
                        logger.info("Added column %s to capacity_assessments", col_name)

        # 4. Seed initial superuser if not already present
        _seed_initial_superuser(sync_engine)

        # 5. Auto-seed initial project, template, supplier, and risk data on fresh database
        from app.infrastructure.persistence.seeds.auto_seed import run_auto_seed
        run_auto_seed(sync_engine)

    except Exception as exc:
        logger.warning("Could not initialize database: %s", exc)


def _seed_initial_superuser(engine: Any) -> None:
    """Seed initial superuser if not present."""
    try:
        from sqlalchemy.orm import Session
        from app.infrastructure.persistence.models.user import User
        from app.domain.enums import UserRole
        from app.core.security import get_password_hash

        with Session(engine) as session:
            admin_email = (settings.FIRST_SUPERUSER_EMAIL or "admin@cmf-platform.com").strip().lower()
            existing_user = session.query(User).filter(User.email == admin_email).first()
            if not existing_user:
                logger.info("Seeding initial superuser: %s", admin_email)
                superuser = User(
                    id=uuid.uuid4(),
                    email=admin_email,
                    username=admin_email.split("@")[0],
                    password_hash=get_password_hash(settings.FIRST_SUPERUSER_PASSWORD or "admin"),
                    first_name="Admin",
                    last_name="CMF",
                    role=UserRole.ADMIN.value,
                    is_active=True,
                    is_superuser=True,
                )
                session.add(superuser)
                session.commit()
                logger.info("Initial superuser (%s) created successfully", admin_email)
    except Exception as exc:
        logger.warning("Failed to seed initial superuser (harmless if already exists): %s", exc)


def _run_alembic_migrations() -> None:
    """Run Alembic migrations to head on production startup (PostgreSQL)."""
    try:
        from alembic.config import Config
        from alembic import command
        import os

        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        alembic_cfg = Config(os.path.join(base_dir, "alembic.ini"))
        alembic_cfg.set_main_option("sqlalchemy.url", settings.get_db_uri(sync=True))
        command.upgrade(alembic_cfg, "head")
        logger.info("Alembic migrations applied successfully")
    except Exception as exc:
        logger.warning("Alembic migration check completed: %s", exc)


def create_application() -> FastAPI:
    app = FastAPI(
        title=settings.PROJECT_NAME,
        version=settings.VERSION,
        lifespan=lifespan,
        # Keep docs available in production so the live API can be inspected
        docs_url="/api/docs",
        redoc_url="/api/redoc",
        openapi_url="/api/openapi.json",
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
        allow_origin_regex=r"^https:\/\/.*\.vercel\.app$",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
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
        sanitized_errors = jsonable_encoder(exc.errors())
        logger.warning(
            "Validation error: %s",
            sanitized_errors,
            extra={"request_id": request.headers.get("X-Request-ID", "")},
        )
        return JSONResponse(
            status_code=422,
            content={
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": "Request validation failed",
                    "details": {"fields": sanitized_errors},
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
    from app.api.v1.endpoints.import_endpoints import router as import_router
    from app.api.v1.endpoints.templates import router as templates_router

    app.include_router(auth_router)
    app.include_router(users_router)
    app.include_router(templates_router)
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
    app.include_router(import_router)

    @app.get("/api/v1/health", tags=["Health"])
    async def health_check() -> dict[str, Any]:
        return {
            "status": "healthy",
            "version": settings.VERSION,
            "environment": settings.ENVIRONMENT,
        }


app = create_application()
