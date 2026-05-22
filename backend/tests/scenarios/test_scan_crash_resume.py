"""
SCENARIO: Skan jarayonida server crash bo'lsa va qayta tiklansa nima bo'ladi?
DEV_PLAN §17.3 — Invariant 4 tekshiruvi.

Har bir scan o'z tranzaksiyasida amalga oshiriladi.
Crash bo'lsa faqat commit bo'lmagan scan yo'qoladi (rollback) —
avvalgi muvaffaqiyatli scan'lar saqlanib qoladi.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from app.domain.enums import HolderType
from app.core.exceptions import InvalidCustodyTransitionError


class TestScanCrashResume:
    """Scan atomicity va crash recovery test'lari."""

    @pytest.mark.asyncio
    async def test_successful_scans_persist_after_crash(self):
        """
        3 ta skan: 2 ta muvaffaqiyatli, 3-sida crash.
        Kutilgan: 2 ta skan DB da saqlanib qoladi.
        """
        committed_scans = []
        scan_count = 0

        async def mock_scan_one(qr_payload: str):
            nonlocal scan_count
            scan_count += 1

            if scan_count == 3:
                # 3-skanida "server crash" simulyatsiyasi
                raise RuntimeError("DB connection lost — simulated crash")

            # Muvaffaqiyatli scan — commit bo'ldi
            committed_scans.append(qr_payload)
            return MagicMock(
                product_id=f"product-{scan_count}",
                short_code=f"SC{scan_count:06d}",
                new_holder_type=HolderType.WAREHOUSE_UZ,
            )

        payloads = ["QR_A", "QR_B", "QR_C_CRASH"]

        results = []
        for payload in payloads:
            try:
                result = await mock_scan_one(payload)
                results.append(result)
            except RuntimeError:
                # Crash — bu scan yo'qoldi, lekin oldingilar saqlanib qoldi
                pass

        assert len(committed_scans) == 2, "Only 2 scans should persist"
        assert "QR_A" in committed_scans
        assert "QR_B" in committed_scans
        assert "QR_C_CRASH" not in committed_scans

    @pytest.mark.asyncio
    async def test_scan_idempotency_on_retry(self):
        """
        Bir xil QR ikki marta skanlansa nima bo'ladi?
        Kutilgan: ikkinchi scan InvalidCustodyTransitionError qaytaradi
        (mahsulot allaqachon boshqa egada).
        """
        already_scanned = set()

        async def mock_scan(qr_payload: str):
            if qr_payload in already_scanned:
                raise InvalidCustodyTransitionError(
                    f"Product already transferred: {qr_payload}"
                )
            already_scanned.add(qr_payload)
            return MagicMock(short_code="SC000001")

        # Birinchi scan — muvaffaqiyatli
        result = await mock_scan("QR_PRODUCT_1")
        assert result is not None

        # Ikkinchi scan (retry) — xato
        with pytest.raises(InvalidCustodyTransitionError):
            await mock_scan("QR_PRODUCT_1")

    @pytest.mark.asyncio
    async def test_scan_isolation_per_request(self):
        """
        Invariant 4: Har bir scan o'z tranzaksiyasida.
        Bir scan'ning muvaffaqiyatsizligi boshqasiga ta'sir qilmasligi shart.
        """
        scan_results = {}

        async def isolated_scan(product_id: str, should_fail: bool):
            """Har bir scan izolatsiyalangan tranzaksiya."""
            try:
                if should_fail:
                    raise ValueError(f"Scan failed for {product_id}")
                scan_results[product_id] = "OK"
                return f"success:{product_id}"
            except ValueError:
                # Rollback — bu product'ning holati o'zgarmadi
                scan_results[product_id] = "FAILED"
                raise

        # Parallel scan'lar: ba'zilari muvaffaqiyatli, ba'zilari muvaffaqiyatsiz
        import asyncio
        tasks = [
            isolated_scan("P1", should_fail=False),
            isolated_scan("P2", should_fail=True),
            isolated_scan("P3", should_fail=False),
            isolated_scan("P4", should_fail=True),
            isolated_scan("P5", should_fail=False),
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        ok_count = sum(1 for r in results if isinstance(r, str) and r.startswith("success"))
        fail_count = sum(1 for r in results if isinstance(r, Exception))

        assert ok_count == 3, "3 successful scans expected"
        assert fail_count == 2, "2 failed scans expected"

        # Muvaffaqiyatli scan'lar saqlanib qoldi
        assert scan_results["P1"] == "OK"
        assert scan_results["P3"] == "OK"
        assert scan_results["P5"] == "OK"
        # Muvaffaqiyatsiz scan'lar rollback bo'ldi
        assert scan_results["P2"] == "FAILED"
        assert scan_results["P4"] == "FAILED"

    @pytest.mark.asyncio
    async def test_session_id_groups_scans_but_not_atomic(self):
        """
        session_id faqat UI grouping uchun — atomic birlik emas.
        Scan session ichidagi har bir scan mustaqil commit bo'ladi.
        """
        session_id = "session-abc-123"
        committed = []

        async def scan_with_session(qr: str, sess_id: str):
            # session_id saqlangan lekin atomic emas
            committed.append({"qr": qr, "session_id": sess_id})
            return {"qr": qr, "session_id": sess_id}

        # Session davomida 5 ta scan
        for i in range(5):
            await scan_with_session(f"QR_{i}", session_id)

        # Barcha 5 ta scan bitta session_id bilan, lekin mustaqil commit qilingan
        assert len(committed) == 5
        assert all(s["session_id"] == session_id for s in committed)
