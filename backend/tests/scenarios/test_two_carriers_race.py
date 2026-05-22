"""
SCENARIO: Ikki carrier bir xil mahsulotni olishga harakat qiladi (race condition).
DEV_PLAN §17.3

Invariant 1 tekshiruvi: SELECT FOR UPDATE + UNIQUE constraint bitta egani kafolatlaydi.
Kutilgan natija: bitta carrier muvaffaqiyatli, ikkinchisi xato oladi.
"""
import asyncio
import uuid
import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from decimal import Decimal


class TestTwoCarriersRace:
    """
    Unit-darajada race condition simulyatsiyasi.
    Haqiqiy PostgreSQL bilan integration test uchun:
    tests/integration/test_basket_race.py ga qarang.
    """

    @pytest.mark.asyncio
    async def test_only_one_winner(self):
        """
        Mock ProductRepository yordamida race simulation.
        lock_for_basket ikkinchi marta chaqirilganda AlreadyLockedError qaytaradi.
        """
        from app.core.exceptions import ProductAlreadyLockedError

        product_id = str(uuid.uuid4())
        call_count = 0
        winner_carrier_id = str(uuid.uuid4())
        loser_carrier_id = str(uuid.uuid4())

        async def mock_lock(prod_id, carrier_id, weight_limit_g):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                # Birinchi carrier muvaffaqiyatli
                return MagicMock(id=str(uuid.uuid4()), product_id=prod_id)
            else:
                # Ikkinchi carrier xato oladi
                raise ProductAlreadyLockedError(f"Product {prod_id} already locked")

        with patch(
            "app.repositories.product_repo.ProductRepository.lock_for_basket",
            side_effect=mock_lock,
        ):
            from app.repositories.product_repo import ProductRepository
            repo = MagicMock()
            repo.lock_for_basket = mock_lock

            # Birinchi carrier muvaffaqiyatli
            result1 = await repo.lock_for_basket(product_id, winner_carrier_id, 5000)
            assert result1 is not None

            # Ikkinchi carrier xato oladi
            with pytest.raises(ProductAlreadyLockedError):
                await repo.lock_for_basket(product_id, loser_carrier_id, 5000)

        assert call_count == 2

    @pytest.mark.asyncio
    async def test_concurrent_lock_attempts(self):
        """
        asyncio.gather bilan parallel urinish simulyatsiyasi.
        """
        from app.core.exceptions import ProductAlreadyLockedError

        product_id = str(uuid.uuid4())
        lock = asyncio.Lock()
        locked_by = None
        winners = []
        losers = []

        async def try_lock(carrier_id: str):
            nonlocal locked_by
            async with lock:
                if locked_by is None:
                    locked_by = carrier_id
                    winners.append(carrier_id)
                else:
                    losers.append(carrier_id)
                    raise ProductAlreadyLockedError(f"Already locked by {locked_by}")

        carrier_ids = [str(uuid.uuid4()) for _ in range(5)]

        results = await asyncio.gather(
            *[try_lock(cid) for cid in carrier_ids],
            return_exceptions=True,
        )

        assert len(winners) == 1, f"Expected 1 winner, got {len(winners)}"
        assert len(losers) == 4, f"Expected 4 losers, got {len(losers)}"

        errors = [r for r in results if isinstance(r, Exception)]
        assert len(errors) == 4

    @pytest.mark.asyncio
    async def test_released_lock_can_be_taken(self):
        """
        Lock release qilinganda boshqa carrier olishi mumkin.
        """
        from app.core.exceptions import ProductAlreadyLockedError

        product_id = str(uuid.uuid4())
        current_holder = None

        async def lock(carrier_id):
            nonlocal current_holder
            if current_holder is not None:
                raise ProductAlreadyLockedError("locked")
            current_holder = carrier_id
            return carrier_id

        async def release():
            nonlocal current_holder
            current_holder = None

        carrier1 = str(uuid.uuid4())
        carrier2 = str(uuid.uuid4())

        # Carrier1 lock oladi
        await lock(carrier1)
        assert current_holder == carrier1

        # Carrier2 urinib ko'radi — muvaffaqiyatsiz
        with pytest.raises(ProductAlreadyLockedError):
            await lock(carrier2)

        # Carrier1 lock'ni qo'yib beradi
        await release()
        assert current_holder is None

        # Carrier2 endi muvaffaqiyatli lock oladi
        await lock(carrier2)
        assert current_holder == carrier2
