from __future__ import annotations

from collections.abc import AsyncGenerator
from contextlib import contextmanager
from typing import Any

from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings


def _get_engine_options(uri: str) -> dict[str, Any]:
    options: dict[str, Any] = {
        "echo": False,
        "future": True,
    }
    # SQLite does not support standard pool_size/max_overflow or pool_pre_ping in the same way
    if not uri.startswith("sqlite"):
        options.update({
            "pool_pre_ping": True,
            "pool_size": 20,
            "max_overflow": 10,
        })
    return options


async_uri = settings.get_db_uri(sync=False)
sync_uri = settings.get_db_uri(sync=True)

async_engine = create_async_engine(
    async_uri,
    **_get_engine_options(async_uri),
)

sync_engine = create_engine(
    sync_uri,
    **_get_engine_options(sync_uri),
)

async_session_maker = async_sessionmaker(
    bind=async_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)

sync_session_maker = sessionmaker(
    bind=sync_engine,
    class_=Session,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)


async def get_async_session() -> AsyncGenerator[AsyncSession, Any]:
    async with async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


@contextmanager
def get_sync_session() -> Session:
    session = sync_session_maker()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


async def get_db() -> AsyncGenerator[AsyncSession, Any]:
    async with async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
