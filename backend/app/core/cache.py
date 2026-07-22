from __future__ import annotations

import functools
import hashlib
import inspect
import json
import time
from collections import OrderedDict
from collections.abc import Callable
from typing import Any, TypeVar

from app.core.config import settings

F = TypeVar("F", bound=Callable[..., Any])


try:
    import redis.asyncio as aioredis

    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False


def cache_key_builder(
    prefix: str = "",
    args: tuple[Any, ...] = (),
    kwargs: dict[str, Any] | None = None,
) -> str:
    parts: list[str] = [prefix]
    if args:
        parts.append(str(args))
    if kwargs:
        sorted_kwargs = dict(sorted(kwargs.items()))
        parts.append(json.dumps(sorted_kwargs, sort_keys=True, default=str))
    raw = ":".join(parts)
    return hashlib.md5(raw.encode("utf-8")).hexdigest()


class CacheService:
    async def get(self, key: str) -> Any | None:
        raise NotImplementedError

    async def set(
        self,
        key: str,
        value: Any,
        ttl: int | None = None,
    ) -> None:
        raise NotImplementedError

    async def delete(self, key: str) -> bool:
        raise NotImplementedError

    async def clear(self) -> None:
        raise NotImplementedError

    async def exists(self, key: str) -> bool:
        raise NotImplementedError


class InMemoryCache(CacheService):
    def __init__(self, default_ttl: int = 300, max_size: int = 1000) -> None:
        self._store: dict[str, tuple[Any, float]] = OrderedDict()
        self._default_ttl = default_ttl
        self._max_size = max_size

    async def get(self, key: str) -> Any | None:
        entry = self._store.get(key)
        if entry is None:
            return None
        value, expiry = entry
        if time.monotonic() > expiry:
            del self._store[key]
            return None
        self._store.move_to_end(key)
        return value

    async def set(
        self,
        key: str,
        value: Any,
        ttl: int | None = None,
    ) -> None:
        if ttl is None:
            ttl = self._default_ttl
        expiry = time.monotonic() + ttl
        self._store[key] = (value, expiry)
        self._store.move_to_end(key)
        while len(self._store) > self._max_size:
            self._store.popitem(last=False)

    async def delete(self, key: str) -> bool:
        if key in self._store:
            del self._store[key]
            return True
        return False

    async def clear(self) -> None:
        self._store.clear()

    async def exists(self, key: str) -> bool:
        entry = self._store.get(key)
        if entry is None:
            return False
        value, expiry = entry
        if time.monotonic() > expiry:
            del self._store[key]
            return False
        return True

    @property
    def size(self) -> int:
        _now = time.monotonic()
        stale = [k for k, (_, e) in self._store.items() if _now > e]
        for k in stale:
            del self._store[k]
        return len(self._store)


class RedisCache(CacheService):
    def __init__(
        self,
        redis_url: str | None = None,
        default_ttl: int = 300,
    ) -> None:
        if not REDIS_AVAILABLE:
            raise RuntimeError(
                "redis package is not installed. Install with: pip install redis"
            )
        self._redis_url = redis_url or settings.REDIS_URL
        self._default_ttl = default_ttl
        self._client: aioredis.Redis | None = None

    async def _get_client(self) -> aioredis.Redis:
        if self._client is None:
            self._client = await aioredis.from_url(
                self._redis_url,
                decode_responses=True,
            )
        return self._client

    async def get(self, key: str) -> Any | None:
        client = await self._get_client()
        value = await client.get(key)
        return value

    async def set(
        self,
        key: str,
        value: Any,
        ttl: int | None = None,
    ) -> None:
        client = await self._get_client()
        if ttl is None:
            ttl = self._default_ttl
        await client.setex(key, ttl, value)

    async def delete(self, key: str) -> bool:
        client = await self._get_client()
        result = await client.delete(key)
        return result > 0

    async def clear(self) -> None:
        client = await self._get_client()
        await client.flushdb()

    async def exists(self, key: str) -> bool:
        client = await self._get_client()
        return await client.exists(key) > 0

    async def close(self) -> None:
        if self._client is not None:
            await self._client.aclose()
            self._client = None


def cached(
    ttl: int | None = None,
    prefix: str | None = None,
    key_builder: Callable[..., str] | None = None,
) -> Callable[[F], F]:
    cache_service = get_cache_service()

    def decorator(func: F) -> F:
        @functools.wraps(func)
        async def async_wrapper(*args: Any, **kwargs: Any) -> Any:
            nonlocal prefix
            if prefix is None:
                prefix = f"{func.__module__}.{func.__qualname__}"
            builder = key_builder or cache_key_builder
            cache_key = builder(prefix=prefix, args=args, kwargs=kwargs)

            cached_value = await cache_service.get(cache_key)
            if cached_value is not None:
                return cached_value

            result = await func(*args, **kwargs)
            await cache_service.set(cache_key, result, ttl=ttl)
            return result

        @functools.wraps(func)
        def sync_wrapper(*args: Any, **kwargs: Any) -> Any:
            import asyncio

            loop = asyncio.new_event_loop()
            try:
                return loop.run_until_complete(
                    async_wrapper(*args, **kwargs)
                )
            finally:
                loop.close()

        if inspect.iscoroutinefunction(func):
            return async_wrapper  # type: ignore[return-value]
        return sync_wrapper  # type: ignore[return-value]

    return decorator


_cache_service: CacheService | None = None


def get_cache_service() -> CacheService:
    global _cache_service
    if _cache_service is None:
        if REDIS_AVAILABLE:
            _cache_service = RedisCache()
        else:
            _cache_service = InMemoryCache()
    return _cache_service


def set_cache_service(service: CacheService) -> None:
    global _cache_service
    _cache_service = service
