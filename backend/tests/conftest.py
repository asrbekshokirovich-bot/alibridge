"""
Pytest fixtures — barcha test'lar uchun umumiy sozlamalar.
Izolatsiyalangan test DB va mock infra ishlatiladi.
"""
import asyncio
import uuid
from decimal import Decimal
from typing import AsyncGenerator

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from app.infra.db.base import Base
from app.infra.db.models import (  # noqa: F401 — import all models for metadata
    user, order, product, custody, carrier, payout, dispute, audit
)
from app.domain.enums import Role, HolderType, ProductStatus
from app.core.config import settings

# ─── Test database ────────────────────────────────────────────────────────────

# SQLite in-memory for unit tests (fast, no Docker required)
# Integration tests use real PostgreSQL from env
TEST_DB_URL = "sqlite+aiosqlite:///:memory:"
INTEGRATION_DB_URL = settings.db_url.replace(
    "postgresql+asyncpg", "postgresql+asyncpg"
)  # same as prod for integration

@pytest.fixture(scope="session")
def event_loop():
    """Barcha async test'lar uchun bitta event loop."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="function")
async def engine():
    """Test uchun yangi SQLite engine."""
    engine = create_async_engine(TEST_DB_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture(scope="function")
async def db_session(engine) -> AsyncGenerator[AsyncSession, None]:
    """Har bir test uchun yangi DB sessiyasi."""
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with session_factory() as session:
        yield session
        await session.rollback()


# ─── Factory helpers ──────────────────────────────────────────────────────────

def make_uuid() -> str:
    return str(uuid.uuid4())


@pytest.fixture
def sample_user_id() -> str:
    return make_uuid()


@pytest.fixture
def sample_product_id() -> str:
    return make_uuid()


@pytest.fixture
def sample_carrier_id() -> str:
    return make_uuid()


# ─── Money helpers ─────────────────────────────────────────────────────────────

@pytest.fixture
def ten_usd():
    from app.domain.value_objects.money import Money
    return Money(amount=Decimal("10.00"), currency="USD")


@pytest.fixture
def five_usd():
    from app.domain.value_objects.money import Money
    return Money(amount=Decimal("5.00"), currency="USD")


@pytest.fixture
def twenty_try():
    from app.domain.value_objects.money import Money
    return Money(amount=Decimal("20.00"), currency="TRY")


# ─── QR signer fixture ─────────────────────────────────────────────────────────

@pytest.fixture
def qr_signer():
    from app.infra.qr.signer import QrSigner
    return QrSigner(secret="test-secret-key-for-tests-only-32b")


# ─── Weight fixtures ───────────────────────────────────────────────────────────

@pytest.fixture
def weight_1kg():
    from app.domain.value_objects.weight import Weight
    return Weight(grams=1000)


@pytest.fixture
def weight_500g():
    from app.domain.value_objects.weight import Weight
    return Weight(grams=500)
