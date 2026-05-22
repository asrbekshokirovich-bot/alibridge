"""DB session dependency."""

from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession

from app.infra.db.session import AsyncSessionLocal


async def get_db_session() -> AsyncIterator[AsyncSession]:
    """Async DB session (per request)."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
