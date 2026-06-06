import uuid
from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import NullPool

from app.core.config import settings


class Base(DeclarativeBase):
    """Barcha ORM modellar uchun asosiy klass."""

    pass


def _is_pgbouncer() -> bool:
    return "pooler.supabase.com" in settings.database_url or ":6543" in settings.database_url


def _engine_kwargs() -> dict:
    kwargs: dict = {
        "echo": settings.app_debug,
        "pool_pre_ping": True,
    }
    # Supabase pgbouncer (transaction pooler) prepared statement'larni qo'llamaydi.
    if _is_pgbouncer():
        kwargs["connect_args"] = {
            # asyncpg client-side statement cache'ni o'chirish
            "statement_cache_size": 0,
            # Har prepared statement uchun noyob nom — pgbouncer transaction mode'da
            # "prepared statement already exists" xatosini oldini oladi.
            "prepared_statement_name_func": lambda: f"__asyncpg_{uuid.uuid4()}__",
        }
        # Transaction pooler bilan SQLAlchemy connection pool'i mos kelmaydi —
        # har so'rov uchun yangi ulanish (NullPool).
        kwargs["poolclass"] = NullPool
        kwargs.pop("pool_pre_ping", None)
    return kwargs


engine = create_async_engine(settings.database_url, **_engine_kwargs())

SessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency — har so'rov uchun bitta session."""
    async with SessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
