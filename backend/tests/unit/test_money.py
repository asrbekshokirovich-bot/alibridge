"""
Money value object — DECIMAL arifmetika va valyuta konversiyasi test'lari.
DEV_PLAN §4 money invariant'lari.
"""
from decimal import Decimal
import pytest
from app.domain.value_objects.money import Money


class TestMoneyCreation:
    def test_basic_creation(self):
        m = Money(amount=Decimal("10.00"), currency="USD")
        assert m.amount == Decimal("10.00")
        assert m.currency == "USD"

    def test_currency_uppercase(self):
        m = Money(amount=Decimal("5"), currency="usd")
        assert m.currency == "USD"

    def test_invalid_currency_raises(self):
        with pytest.raises(Exception):
            Money(amount=Decimal("10"), currency="INVALID")

    def test_negative_amount_allowed(self):
        # Manfiy summa ruxsat etiladi (deduction / ushlab qolish uchun)
        m = Money(amount=Decimal("-1"), currency="USD")
        assert m.is_negative

    def test_zero_amount_allowed(self):
        m = Money(amount=Decimal("0"), currency="USD")
        assert m.amount == Decimal("0")

    def test_immutable(self):
        m = Money(amount=Decimal("10"), currency="USD")
        with pytest.raises(Exception):
            m.amount = Decimal("20")  # type: ignore


class TestMoneyArithmetic:
    def test_add_same_currency(self, ten_usd, five_usd):
        result = ten_usd + five_usd
        assert result.amount == Decimal("15.00")
        assert result.currency == "USD"

    def test_subtract_same_currency(self, ten_usd, five_usd):
        result = ten_usd - five_usd
        assert result.amount == Decimal("5.00")

    def test_subtract_resulting_negative_allowed(self, five_usd, ten_usd):
        # 5 - 10 = -5: manfiy natija ruxsat (deduction uchun)
        result = five_usd - ten_usd
        assert result.amount == Decimal("-5.00")

    def test_multiply_by_scalar(self, ten_usd):
        result = ten_usd * 3
        assert result.amount == Decimal("30.00")

    def test_add_different_currency_raises(self, ten_usd, twenty_try):
        with pytest.raises(Exception):
            ten_usd + twenty_try

    def test_subtract_different_currency_raises(self, ten_usd, twenty_try):
        with pytest.raises(Exception):
            ten_usd - twenty_try


class TestMoneyComparison:
    def test_equal(self):
        m1 = Money(amount=Decimal("10.00"), currency="USD")
        m2 = Money(amount=Decimal("10.00"), currency="USD")
        assert m1 == m2

    def test_not_equal_amount(self):
        m1 = Money(amount=Decimal("10.00"), currency="USD")
        m2 = Money(amount=Decimal("20.00"), currency="USD")
        assert m1 != m2

    def test_not_equal_currency(self):
        m1 = Money(amount=Decimal("10.00"), currency="USD")
        m2 = Money(amount=Decimal("10.00"), currency="EUR")
        assert m1 != m2

    def test_less_than(self, five_usd, ten_usd):
        assert five_usd < ten_usd

    def test_greater_than(self, ten_usd, five_usd):
        assert ten_usd > five_usd

    def test_compare_different_currencies_raises(self, ten_usd, twenty_try):
        with pytest.raises(Exception):
            _ = ten_usd < twenty_try


class TestMoneyConversion:
    def test_convert_usd_to_try(self, ten_usd):
        """1 USD = 32 TRY kursida konversiya."""
        result = ten_usd.convert(to_currency="TRY", rate=Decimal("32.00"))
        assert result.currency == "TRY"
        assert result.amount == Decimal("320.00")

    def test_convert_preserves_precision(self):
        m = Money(amount=Decimal("1.00"), currency="USD")
        result = m.convert(to_currency="UZS", rate=Decimal("12500.00"))
        assert result.amount == Decimal("12500.00")
        assert result.currency == "UZS"

    def test_convert_same_currency(self, ten_usd):
        result = ten_usd.convert(to_currency="USD", rate=Decimal("1.00"))
        assert result == ten_usd


class TestMoneyFormatting:
    def test_str_representation(self):
        m = Money(amount=Decimal("10.50"), currency="USD")
        s = str(m)
        assert "10.50" in s
        assert "USD" in s

    def test_repr(self):
        m = Money(amount=Decimal("5.00"), currency="EUR")
        r = repr(m)
        assert "5.00" in r or "5" in r
