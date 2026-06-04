"""Carrier pick WH approval + yangi TR delivery enum qiymatlari.

Revision ID: 0010_carrier_pick_approval
Revises: 0009_order_wh_approval
Create Date: 2026-06-03 00:00:00.000000

- carrier_picks: wh_approved_at, wh_rejected_at, rejection_reason ustunlari
- tr_delivery_enum: 'tr_airport_pickup', 'tr_home_hotel_pickup' qiymatlari
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers
revision: str = "0010_carrier_pick_approval"
down_revision: str | None = "0009_order_wh_approval"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Yangi TR delivery usullari (ADD VALUE — yangi qiymat shu transaksiyada
    # ISHLATILMAYDI, faqat qo'shiladi, shuning uchun xavfsiz)
    op.execute("ALTER TYPE tr_delivery_enum ADD VALUE IF NOT EXISTS 'tr_airport_pickup'")
    op.execute("ALTER TYPE tr_delivery_enum ADD VALUE IF NOT EXISTS 'tr_home_hotel_pickup'")

    # Carrier pick WH approval ustunlari
    op.add_column(
        "carrier_picks",
        sa.Column("wh_approved_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "carrier_picks",
        sa.Column("wh_rejected_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "carrier_picks",
        sa.Column("rejection_reason", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("carrier_picks", "rejection_reason")
    op.drop_column("carrier_picks", "wh_rejected_at")
    op.drop_column("carrier_picks", "wh_approved_at")
    # PostgreSQL ENUM qiymatini olib tashlashni qo'llab-quvvatlamaydi — no-op.
