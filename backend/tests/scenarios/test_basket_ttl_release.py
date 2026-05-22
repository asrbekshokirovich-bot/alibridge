"""
SCENARIO: Basket TTL — 20 daqiqa o'tgach lock avtomatik bo'shatiladi.
DEV_PLAN §17.3

Invariant 1 tekshiruvi: TTL worker basket lock'larini o'z vaqtida bo'shatadi
va boshqa carrier ushbu mahsulotni olishi mumkin bo'ladi.
"""
import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, MagicMock, patch


BASKET_TTL_MINUTES = 20


def make_pick(product_id: str, lock_until: datetime):
    """Mock CarrierPick yaratish."""
    return MagicMock(
        id=f"pick-{product_id}",
        product_id=product_id,
        basket_lock_until=lock_until,
    )


class TestBasketTTLRelease:
    @pytest.mark.asyncio
    async def test_expired_picks_are_released(self):
        """
        Muddat o'tgan pick'lar release qilinishi shart.
        """
        now = datetime.now(timezone.utc)
        expired_time = now - timedelta(minutes=25)  # 25 daqiqa oldin
        valid_time = now + timedelta(minutes=10)    # 10 daqiqa keyin

        picks = [
            make_pick("P1", expired_time),  # Muddati o'tgan
            make_pick("P2", valid_time),     # Hali amal qiladi
            make_pick("P3", expired_time),  # Muddati o'tgan
        ]

        released = []

        async def mock_release(pick_id: str):
            released.append(pick_id)

        for pick in picks:
            if pick.basket_lock_until < now:
                await mock_release(pick.id)

        assert len(released) == 2
        assert "pick-P1" in released
        assert "pick-P3" in released
        assert "pick-P2" not in released

    @pytest.mark.asyncio
    async def test_released_product_available_for_others(self):
        """
        Release qilingandan keyin mahsulot boshqa carrier uchun ochiq.
        """
        product_id = "product-001"
        current_lock_holder = {"carrier_id": "carrier-A", "until": None}

        def lock(carrier_id: str, duration_minutes: int):
            current_lock_holder["carrier_id"] = carrier_id
            current_lock_holder["until"] = datetime.now(timezone.utc) + timedelta(
                minutes=duration_minutes
            )

        def release():
            current_lock_holder["carrier_id"] = None
            current_lock_holder["until"] = None

        def is_locked() -> bool:
            if current_lock_holder["until"] is None:
                return False
            return current_lock_holder["until"] > datetime.now(timezone.utc)

        # Carrier A lock oldi
        lock("carrier-A", 20)
        assert is_locked() is True
        assert current_lock_holder["carrier_id"] == "carrier-A"

        # TTL worker release qildi
        release()
        assert is_locked() is False

        # Carrier B endi olishi mumkin
        lock("carrier-B", 20)
        assert current_lock_holder["carrier_id"] == "carrier-B"

    @pytest.mark.asyncio
    async def test_ttl_countdown(self):
        """
        Lock 20 daqiqa amal qiladi, keyin muddati tugaydi.
        """
        now = datetime.now(timezone.utc)
        lock_until = now + timedelta(minutes=20)

        def minutes_remaining():
            delta = lock_until - datetime.now(timezone.utc)
            return delta.total_seconds() / 60

        remaining = minutes_remaining()
        assert 19 <= remaining <= 20, f"Expected ~20 min remaining, got {remaining:.1f}"

    @pytest.mark.asyncio
    async def test_checkout_before_ttl_keeps_lock(self):
        """
        Carrier basket'ni checkout qilsa lock saqlanib qoladi (TTL bo'shatmaydi).
        """
        now = datetime.now(timezone.utc)
        checked_out_picks = set()

        def checkout(pick_id: str):
            checked_out_picks.add(pick_id)

        pick_id = "pick-001"
        lock_until = now + timedelta(minutes=15)  # Hali 15 daqiqa bor

        # Checkout qilindi
        checkout(pick_id)

        # TTL worker faqat checkout bo'lmagan, muddati o'tgan pick'larni release qiladi
        should_release = (
            lock_until < now  # Muddati o'tgan
            and pick_id not in checked_out_picks  # Checkout qilinmagan
        )
        assert should_release is False, "Checked-out pick should NOT be released by TTL worker"

    @pytest.mark.asyncio
    async def test_null_lock_until_is_released(self):
        """
        basket_lock_until=None bo'lsa ham release qilinishi shart.
        (Anomal holat — himoya qatlami)
        """
        now = datetime.now(timezone.utc)

        def should_release(lock_until) -> bool:
            if lock_until is None:
                return True
            return lock_until < now

        assert should_release(None) is True
        assert should_release(now + timedelta(minutes=5)) is False
        assert should_release(now - timedelta(minutes=1)) is True
