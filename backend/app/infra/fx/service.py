"""FX (foreign exchange) — valyuta kurslari.

Manbalar:
- CBU (Markaziy Bank): UZS kurslari — https://cbu.uz/ru/arkhiv-kursov-valyut/json/
- TCMB (Türkiye Merkez Bankası): TRY kurslari — https://www.tcmb.gov.tr/kurlar/today.xml

Cache: Redis'da 4 soat (settings.fx_cache_ttl).
Payout vaqtida kurs lock qilinadi (Invariant 3 ga o'xshash mantiq).
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any

import httpx

from app.core.config import settings
from app.core.exceptions import ExternalServiceError
from app.core.logger import get_logger
from app.infra.cache.redis_client import get_json, set_json

log = get_logger(__name__)

CBU_URL = "https://cbu.uz/ru/arkhiv-kursov-valyut/json/"
TCMB_URL = "https://www.tcmb.gov.tr/kurlar/today.xml"

CACHE_KEY = "fx:rates:v1"


class FxService:
    """Cached FX kurslari.

    Asosiy valyuta: USD (rates['USD']=1.0 deb hisoblanadi)
    """

    def __init__(self) -> None:
        self._client = httpx.AsyncClient(timeout=10.0)

    async def get_rates(self) -> dict[str, Decimal]:
        """Barcha qo'llanma valyutalar uchun USD-bazaviy kurslarni qaytarish.

        Misol: {"USD": 1.0, "UZS": 12500.0, "TRY": 33.5, "EUR": 0.92}
        """
        # Cache'dan urinish
        cached = await get_json(CACHE_KEY)
        if cached:
            return {k: Decimal(str(v)) for k, v in cached.items()}

        # Yangi kurslarni olish
        rates = await self._fetch_rates()

        # Cache'ga saqlash
        await set_json(
            CACHE_KEY,
            {k: str(v) for k, v in rates.items()},
            ttl=settings.fx_cache_ttl,
        )

        log.info("fx_rates_refreshed", rates=rates)
        return rates

    async def convert(
        self,
        amount: Decimal,
        *,
        from_currency: str,
        to_currency: str,
    ) -> Decimal:
        """Valyutadan valyutaga o'tkazish.

        from → USD → to
        """
        if from_currency == to_currency:
            return amount

        rates = await self.get_rates()
        if from_currency not in rates or to_currency not in rates:
            raise ExternalServiceError(
                message=f"Valyuta qo'llanmaydi: {from_currency} yoki {to_currency}",
            )

        usd_amount = amount / rates[from_currency]
        return usd_amount * rates[to_currency]

    # ============================================
    # Internal: kurslar olish
    # ============================================
    async def _fetch_rates(self) -> dict[str, Decimal]:
        """CBU va TCMB'dan kurslarni olish."""
        rates: dict[str, Decimal] = {"USD": Decimal("1.0")}

        # CBU — UZS
        try:
            resp = await self._client.get(CBU_URL)
            data: list[dict[str, Any]] = resp.json()
            for item in data:
                code = item.get("Ccy")
                rate = item.get("Rate")
                if code == "USD" and rate:
                    # CBU'da USD/UZS kursi → biz UZS/USD ko'rinishida saqlaymiz
                    rates["UZS"] = Decimal(rate)
                elif code == "EUR" and rate:
                    # EUR/UZS kursini hisoblash uchun
                    rates["EUR"] = Decimal("1.0") / (Decimal(rate) / rates.get("UZS", Decimal("1")))
        except Exception as e:
            log.warning("cbu_fetch_failed", error=str(e))

        # TCMB — TRY (USD/TRY cross rate)
        try:
            import xml.etree.ElementTree as ET
            resp = await self._client.get(TCMB_URL)
            root = ET.fromstring(resp.text)
            for currency in root.findall("Currency"):
                if currency.get("CurrencyCode") == "USD":
                    selling = currency.findtext("ForexSelling")
                    if selling:
                        # TCMB beradi: 1 USD = X TRY → biz TRY/USD saqlaymiz
                        rates["TRY"] = Decimal(selling)
                    break
        except Exception as e:
            log.warning("tcmb_fetch_failed", error=str(e))

        rates.setdefault("UZS", Decimal("12500"))
        rates.setdefault("TRY", Decimal("33.5"))
        rates.setdefault("EUR", Decimal("0.92"))
        rates.setdefault("CNY", Decimal("7.2"))
        rates.setdefault("RUB", Decimal("90"))

        return rates

    async def close(self) -> None:
        await self._client.aclose()


# Singleton
_fx_service: FxService | None = None


def get_fx_service() -> FxService:
    global _fx_service
    if _fx_service is None:
        _fx_service = FxService()
    return _fx_service
