from __future__ import annotations

import os
from typing import ClassVar

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config: ClassVar[SettingsConfigDict] = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    ENVIRONMENT: str = "development"

    DATABASE_URL: str | None = None
    DATABASE_ASYNC_PREFIX: str = "sqlite+aiosqlite"
    DATABASE_SYNC_PREFIX: str = "sqlite"
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgres"
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_DB: str = "cmf_platform"

    SECRET_KEY: str = "change-me-in-production-use-a-real-secret-key"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    FIRST_SUPERUSER_EMAIL: str = "admin@cmf-platform.com"
    FIRST_SUPERUSER_PASSWORD: str = "admin"

    PROJECT_NAME: str = "CMF Platform"
    VERSION: str = "1.0.0"

    CORS_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:8000",
        "http://127.0.0.1:5173",
    ]

    UPLOAD_DIR: str = "./uploads"
    MAX_UPLOAD_SIZE: int = 50 * 1024 * 1024

    SMTP_HOST: str = "localhost"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_USE_TLS: bool = True

    REDIS_URL: str = "redis://localhost:6379/0"

    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "json"

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: str | list[str]) -> list[str]:
        if isinstance(v, str):
            v = v.strip()
            if not v:
                return []
            if v.startswith("[") and v.endswith("]"):
                import json
                try:
                    parsed = json.loads(v)
                    if isinstance(parsed, list):
                        return [str(origin).strip() for origin in parsed if str(origin).strip()]
                except Exception:
                    pass
                v = v.strip("[]")
            return [origin.strip().strip("'\"") for origin in v.split(",") if origin.strip().strip("'\"")]
        return v

    @field_validator("MAX_UPLOAD_SIZE", mode="before")
    @classmethod
    def parse_max_upload_size(cls, v: str | int) -> int:
        if isinstance(v, str):
            v = v.strip().upper()
            if v.endswith("MB"):
                return int(v.removesuffix("MB").strip()) * 1024 * 1024
            if v.endswith("GB"):
                return int(v.removesuffix("GB").strip()) * 1024 * 1024 * 1024
            return int(v)
        return v

    @model_validator(mode="after")
    def ensure_dev_cors_origins(self) -> "Settings":
        if self.is_development:
            required_origins = [
                "http://localhost:5173",
                "http://127.0.0.1:5173",
            ]
            for origin in required_origins:
                if origin not in self.CORS_ORIGINS:
                    self.CORS_ORIGINS.append(origin)
        return self

    def get_db_uri(self, sync: bool = False) -> str:
        """
        Return the correct database URI for sync (psycopg2 / sqlite) or async (asyncpg / aiosqlite).
        Handles any input URL scheme: postgres://, postgresql://, postgresql+asyncpg://, sqlite://, etc.
        """
        raw_url = self.DATABASE_URL
        if raw_url and raw_url.strip():
            url = raw_url.strip()

            # SQLite URLs
            if url.startswith("sqlite://") or url.startswith("sqlite+aiosqlite://"):
                if sync:
                    if url.startswith("sqlite+aiosqlite://"):
                        return url.replace("sqlite+aiosqlite://", "sqlite://", 1)
                    return url
                else:
                    if url.startswith("sqlite://") and not url.startswith("sqlite+aiosqlite://"):
                        return url.replace("sqlite://", "sqlite+aiosqlite://", 1)
                    return url

            # PostgreSQL URLs
            from urllib.parse import parse_qsl, urlencode, urlsplit

            for prefix in ("postgresql+asyncpg://", "postgresql+psycopg2://", "postgresql://", "postgres://"):
                if url.startswith(prefix):
                    rest = url[len(prefix):]
                    break
            else:
                rest = url

            # Parse query parameters from rest
            dummy_parsed = urlsplit(f"http://{rest}")
            query_dict = dict(parse_qsl(dummy_parsed.query, keep_blank_values=True))

            if sync:
                # psycopg2 / libpq uses sslmode, not ssl
                if "ssl" in query_dict and "sslmode" not in query_dict:
                    query_dict["sslmode"] = query_dict.pop("ssl")
                driver = "postgresql+psycopg2"
            else:
                # asyncpg uses ssl, does NOT accept libpq query params (sslmode, channel_binding, etc.)
                if "sslmode" in query_dict:
                    sslmode_val = query_dict.pop("sslmode")
                    if "ssl" not in query_dict and sslmode_val != "disable":
                        query_dict["ssl"] = "require"
                # Strip all unsupported libpq parameters from asyncpg URL
                valid_asyncpg_params = {
                    "ssl",
                    "timeout",
                    "command_timeout",
                    "statement_cache_size",
                    "max_cached_statement_lifetime",
                    "max_cacheable_statement_size",
                    "server_settings",
                    "target_session_attrs",
                }
                query_dict = {k: v for k, v in query_dict.items() if k in valid_asyncpg_params}
                driver = "postgresql+asyncpg"

            new_query = urlencode(query_dict)
            netloc_and_path = dummy_parsed.netloc + dummy_parsed.path
            final_url = f"{driver}://{netloc_and_path}"
            if new_query:
                final_url = f"{final_url}?{new_query}"
            return final_url

        # No DATABASE_URL provided -> fallback depending on environment
        if self.is_development:
            return "sqlite:///./cmf.db" if sync else "sqlite+aiosqlite:///./cmf.db"
        else:
            driver = "postgresql+psycopg2" if sync else "postgresql+asyncpg"
            return (
                f"{driver}://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
                f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
            )

    @property
    def is_development(self) -> bool:
        return self.ENVIRONMENT.lower() == "development"

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.lower() == "production"

    @property
    def is_testing(self) -> bool:
        return self.ENVIRONMENT.lower() == "testing"


settings = Settings()
