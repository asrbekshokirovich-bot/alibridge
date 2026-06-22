import uuid
from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings


class Base(DeclarativeBase):
    """Barcha ORM modellar uchun asosiy klass."""

    pass


def _is_pgbouncer() -> bool:
    return "pooler.supabase.com" in settings.database_url or ":6543" in settings.database_url


def _engine_kwargs() -> dict:
    # Haqiqiy ulanish puli — barcha rejimlar uchun (NullPool ENDi ishlatilmaydi).
    # Sabab: NullPool har so'rov uchun yangi ulanish ochadi — Supabase pooler
    # eu-central-1'da bu ~200-700 ms (TCP+TLS+auth) qo'shadi. Pul ulanishni
    # qayta ishlatadi, shu sababli so'rov ~100x tezroq javob beradi.
    kwargs: dict = {
        "echo": settings.app_debug,
        "pool_size": settings.db_pool_size,
        "max_overflow": settings.db_max_overflow,
        "pool_recycle": settings.db_pool_recycle,
        # Ishlatishdan oldin "SELECT 1" — pooler uzgan bo'sh ulanishni aniqlaydi.
        "pool_pre_ping": True,
    }
    # Supabase pgbouncer (pooler) prepared statement'larni (transaction mode'da) qo'llamaydi.
    # Pul ulanishni qayta ishlatadi — bu pgbouncer bilan MOS keladi (client<->pgbouncer
    # ulanishi qayta ishlatiladi, pgbouncer esa server tomonni o'zi multiplekslaydi).
    if _is_pgbouncer():
        kwargs["connect_args"] = {
            # asyncpg client-side statement cache'ni o'chirish
            "statement_cache_size": 0,
            # Har prepared statement uchun noyob nom — pgbouncer transaction mode'da
            # "prepared statement already exists" xatosini oldini oladi.
            "prepared_statement_name_func": lambda: f"__asyncpg_{uuid.uuid4()}__",
        }
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
