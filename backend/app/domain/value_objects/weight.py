"""Weight value object.

Stored internally in grams (int). Display in kg.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Self

from pydantic import BaseModel, ConfigDict, Field


class Weight(BaseModel):
    """Immutable weight, stored as grams (integer).

    Convert to kg with .kg property.
    """

    model_config = ConfigDict(frozen=True)

    grams: int = Field(..., ge=0, description="Weight in grams (non-negative)")

    # ============================================
    # Constructors
    # ============================================
    @classmethod
    def zero(cls) -> Self:
        return cls(grams=0)

    @classmethod
    def from_kg(cls, kg: float | Decimal) -> Self:
        return cls(grams=int(Decimal(str(kg)) * 1000))

    # ============================================
    # Display
    # ============================================
    @property
    def kg(self) -> Decimal:
        return Decimal(self.grams) / Decimal(1000)

    def __str__(self) -> str:
        if self.grams >= 1000:
            return f"{self.kg:.2f} kg"
        return f"{self.grams} g"

    # ============================================
    # Arithmetic
    # ============================================
    def __add__(self, other: Weight) -> Weight:
        return Weight(grams=self.grams + other.grams)

    def __sub__(self, other: Weight) -> Weight:
        if other.grams > self.grams:
            raise ValueError(f"Cannot subtract {other} from {self} — result would be negative")
        return Weight(grams=self.grams - other.grams)

    def __mul__(self, factor: int) -> Weight:
        return Weight(grams=self.grams * factor)

    __rmul__ = __mul__

    # ============================================
    # Comparison
    # ============================================
    def __lt__(self, other: Weight) -> bool:
        return self.grams < other.grams

    def __le__(self, other: Weight) -> bool:
        return self.grams <= other.grams

    def __gt__(self, other: Weight) -> bool:
        return self.grams > other.grams

    def __ge__(self, other: Weight) -> bool:
        return self.grams >= other.grams

    @property
    def is_zero(self) -> bool:
        return self.grams == 0
