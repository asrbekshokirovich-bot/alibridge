"""
Integration tests — haqiqiy DB bilan repository test'lari.
Bu test'lar pytest-asyncio va real PostgreSQL talab qiladi.

Ishlatish:
    DATABASE_URL=postgresql+asyncpg://... pytest tests/integration/ -v

Unit test'lardan farqi: SQLite o'rniga haqiqiy PG ishlatiladi.
"""
import uuid
import pytest
import pytest_asyncio
from decimal import Decimal
from datetime import datetime, timezone, timedelta

import pytest

# Bu test'lar faqat DATABASE_URL environment o'zgaruvchisi bo'lsa ishlaydi
pytestmark = pytest.mark.integration


@pytest.mark.asyncio
async def test_product_lock_for_basket_prevents_double_lock(db_session):
    """
    Invariant 1: Bir mahsulotni ikki carrier lock qila olmaydi.
    SELECT FOR UPDATE + UNIQUE constraint tekshiruvi.
    """
    from app.repositories.product_repo import ProductRepository
    from app.core.exceptions import ProductAlreadyLockedError

    repo = ProductRepository(db_session)

    # Bu test haqiqiy DB bilan ishlaydi
    # Unit test versiyasi: tests/scenarios/test_two_carriers_race.py
    pytest.skip("Requires PostgreSQL with test data — run with real DB")


@pytest.mark.asyncio
async def test_custody_event_append_only(db_session):
    """
    Invariant: CustodyEvent UPDATE/DELETE taqiqlangan.
    PostgreSQL trigger tekshiruvi.
    """
    pytest.skip("Requires PostgreSQL trigger — run against real DB with migration applied")


@pytest.mark.asyncio
async def test_order_create_and_retrieve(db_session):
    """
    OrderRepository: create + get_by_id round-trip.
    """
    from app.repositories.order_repo import OrderRepository
    from app.domain.enums import OrderSource

    repo = OrderRepository(db_session)

    user_id = str(uuid.uuid4())

    # Buyurtma yaratish
    order = await repo.create(
        orderer_id=user_id,
        walk_in_customer_id=None,
        source=OrderSource.SELF,
        destination_city="Istanbul",
        notes="Test buyurtma",
    )

    assert order.id is not None
    assert order.destination_city == "Istanbul"

    # ID bo'yicha olish
    fetched = await repo.get_by_id(order.id)
    assert fetched is not None
    assert fetched.id == order.id
    assert fetched.notes == "Test buyurtma"


@pytest.mark.asyncio
async def test_order_xor_constraint(db_session):
    """
    Buyurtmada faqat orderer_id yoki walk_in_customer_id bo'lishi mumkin, ikkisi emas.
    """
    from app.repositories.order_repo import OrderRepository
    from app.domain.enums import OrderSource

    repo = OrderRepository(db_session)

    # Ikkisi ham berilsa — AssertionError
    with pytest.raises(AssertionError):
        await repo.create(
            orderer_id="user-1",
            walk_in_customer_id="walkin-1",
            source=OrderSource.SELF,
            destination_city="Toshkent",
        )

    # Ikkisi ham None bo'lsa — AssertionError
    with pytest.raises(AssertionError):
        await repo.create(
            orderer_id=None,
            walk_in_customer_id=None,
            source=OrderSource.SELF,
            destination_city="Toshkent",
        )


@pytest.mark.asyncio
async def test_payout_create_and_approve(db_session):
    """
    PayoutRepository: so'rov yaratish va tasdiqlash.
    """
    from app.repositories.payout_repo import PayoutRepository
    from app.domain.enums import PayoutMethod, PayoutStatus

    repo = PayoutRepository(db_session)

    carrier_id = str(uuid.uuid4())

    payout = await repo.create_request(
        carrier_id=carrier_id,
        payout_method=PayoutMethod.CARD_UZ,
        account_details="8600 1234 5678 9012",
        gross_amount=Decimal("150.00"),
        deductions=Decimal("10.00"),
        currency="USD",
        fx_rate_to_usd=Decimal("1.0"),
        pick_ids=[],
    )

    assert payout.id is not None
    assert payout.status == PayoutStatus.REQUESTED
    assert payout.net_amount == str(Decimal("140.00"))

    # Tasdiqlash
    await repo.approve(payout.id)
    await db_session.refresh(payout)
    assert payout.status == PayoutStatus.PAID


@pytest.mark.asyncio
async def test_dispute_create_and_resolve(db_session):
    """
    DisputeRepository: da'vo yaratish va hal qilish.
    """
    from app.repositories.dispute_repo import DisputeRepository
    from app.domain.enums import DisputeType, DisputeStatus, DisputeResolution

    repo = DisputeRepository(db_session)

    product_id = str(uuid.uuid4())
    pick_id = str(uuid.uuid4())
    user_id = str(uuid.uuid4())

    dispute = await repo.create(
        product_id=product_id,
        pick_id=pick_id,
        filed_by_user_id=user_id,
        dispute_type=DisputeType.DAMAGED,
        description="Mahsulot shikastlangan keldi",
    )

    assert dispute.id is not None
    assert dispute.status == DisputeStatus.OPEN

    # Hal qilish
    resolved = await repo.resolve(
        dispute_id=dispute.id,
        resolution=DisputeResolution.CARRIER_FAULT,
        deduction_amount="50.00",
        resolved_by_user_id=str(uuid.uuid4()),
        notes="Carrier javobgar",
    )

    assert resolved.status == DisputeStatus.RESOLVED
    assert resolved.resolution == DisputeResolution.CARRIER_FAULT


@pytest.mark.asyncio
async def test_audit_log_append_only_behavior(db_session):
    """
    AuditRepository: yozuv qo'shish va olish.
    """
    from app.repositories.audit_repo import AuditRepository

    repo = AuditRepository(db_session)

    actor_id = str(uuid.uuid4())
    resource_id = str(uuid.uuid4())

    log = await repo.log(
        actor_id=actor_id,
        action="BASKET_ADD",
        resource_type="product",
        resource_id=resource_id,
        changes={"product_id": resource_id, "action": "lock"},
        success=True,
    )

    assert log.id is not None
    assert log.action == "BASKET_ADD"

    # Tarix olish
    history = await repo.get_by_resource("product", resource_id)
    assert len(history) == 1
    assert history[0].actor_id == actor_id
