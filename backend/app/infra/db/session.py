"""Async database session management.

Uses SQLAlchemy 2.0 async with asyncpg driver.
"""

from __future__ import annotations

from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import settings
from app.core.logger import get_logger

log = get_logger(__name__)


# ============================================
# Engine — single instance per process
# ============================================
_connect_args: dict = {"ssl": "require"} if settings.db_use_ssl else {}

engine: AsyncEngine = create_async_engine(
    settings.db_url,
    echo=settings.is_development and settings.app_debug,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
    pool_recycle=3600,
    connect_args=_connect_args,
)


# ============================================
# Session factory
# ============================================
AsyncSessionLocal: async_sessionmaker[AsyncSession] = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


# ============================================
# Dependency for FastAPI
# ============================================
async def get_session() -> AsyncIterator[AsyncSession]:
    """Yield a database session.

    Usage in FastAPI:
        from fastapi import Depends
        async def endpoint(session: AsyncSession = Depends(get_session)): ...
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


# ============================================
# Lifespan helpers
# ============================================
async def init_db() -> None:
    """Initialize database on app startup (run once)."""
    log.info("db_initializing", url=str(engine.url))
    # Connection test
    async with engine.begin() as conn:
        await conn.execute(__import__("sqlalchemy").text("SELECT 1"))
    log.info("db_initialized")


async def close_db() -> None:
    """Close database connections on app shutdown."""
    log.info("db_closing")
    await engine.dispose()
    log.info("db_closed")
