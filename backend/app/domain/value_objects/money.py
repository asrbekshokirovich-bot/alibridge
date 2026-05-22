"""Money value object.

Immutable. DECIMAL precision (no floats — never lose a cent).
Currency is a 3-char ISO code.

Operations between different currencies raise — explicit conversion required.
"""

from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal
from typing import Self

from pydantic import BaseModel, ConfigDict, Field, field_validator


# ISO 4217 codes we deal with
SUPPORTED_CURRENCIES = frozenset({"USD", "EUR", "UZS", "TRY", "CNY", "RUB"})


class CurrencyMismatchError(ValueError):
    """Raised when trying to combine Money objects in different currencies."""


class Money(BaseModel):
    """Immutable amount + ISO currency code.

    Examples:
        Money(amount=Decimal("10.50"), currency="USD")
        Money.from_str("10.50 USD")
    """

    model_config = ConfigDict(frozen=True)

    amount: Decimal = Field(..., description="Decimal amount (any precision)")
    currency: str = Field(..., min_length=3, max_length=3)

    @field_validator("currency")
    @classmethod
    def _validate_currency(cls, v: str) -> str:
        v = v.upper()
        if v not in SUPPORTED_CURRENCIES:
            raise ValueError(f"Unsupported currency: {v}. Supported: {SUPPORTED_CURRENCIES}")
        return v

    @field_validator("amount")
    @classmethod
    def _quantize(cls, v: Decimal) -> Decimal:
        # Normalize to 4 decimal places to match DB storage
        return v.quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)

    # ============================================
    # Constructors
    # ============================================
    @classmethod
    def zero(cls, currency: str) -> Self:
        return cls(amount=Decimal("0"), currency=currency)

    @classmethod
    def from_str(cls, s: str) -> Self:
        """Parse '10.50 USD' format."""
        parts = s.strip().split()
        if len(parts) != 2:
            raise ValueError(f"Expected '<amount> <currency>', got: {s!r}")
        return cls(amount=Decimal(parts[0]), currency=parts[1])

    # ============================================
    # Arithmetic
    # ============================================
    def _check_same_currency(self, other: Money) -> None:
        if self.currency != other.currency:
            raise CurrencyMismatchError(
                f"Cannot operate on different currencies: {self.currency} vs {other.currency}"
            )

    def __add__(self, other: Money) -> Money:
        self._check_same_currency(other)
        return Money(amount=self.amount + other.amount, currency=self.currency)

    def __sub__(self, other: Money) -> Money:
        self._check_same_currency(other)
        return Money(amount=self.amount - other.amount, currency=self.currency)

    def __mul__(self, factor: int | Decimal) -> Money:
        return Money(amount=self.amount * Decimal(factor), currency=self.currency)

    __rmul__ = __mul__

    def __neg__(self) -> Money:
        return Money(amount=-self.amount, currency=self.currency)

    # ============================================
    # Comparison
    # ============================================
    def __lt__(self, other: Money) -> bool:
        self._check_same_currency(other)
        return self.amount < other.amount

    def __le__(self, other: Money) -> bool:
        self._check_same_currency(other)
        return self.amount <= other.amount

    def __gt__(self, other: Money) -> bool:
        self._check_same_currency(other)
        return self.amount > other.amount

    def __ge__(self, other: Money) -> bool:
        self._check_same_currency(other)
        return self.amount >= other.amount

    # ============================================
    # Display
    # ============================================
    def __str__(self) -> str:
        return f"{self.amount} {self.currency}"

    @property
    def is_zero(self) -> bool:
        return self.amount == Decimal("0")

    @property
    def is_positive(self) -> bool:
        return self.amount > Decimal("0")

    @property
    def is_negative(self) -> bool:
        return self.amount < Decimal("0")

    # ============================================
    # FX conversion
    # ============================================
    def convert(self, *, to_currency: str, rate: Decimal) -> Money:
        """Convert to another currency using the given FX rate.

        rate = amount of `to_currency` per unit of `self.currency`.
        Example: USD → UZS, rate = 12500.0 → Money(USD 10) becomes Money(UZS 125000)
        """
        if self.currency == to_currency:
            return self
        return Money(amount=self.amount * rate, currency=to_currency)
