"""Carrier admin tasdig'i maydonlari (Invariant 5 — dual confirmation).

Revision ID: 0007_carrier_approval
Revises: 0006_china_enums
Create Date: 2026-06-01 00:00:00.000000

carrier_profiles ga approved_at + approved_by_admin_id qo'shadi.

ESLATMA: Carrier tasdiqlash oqimi keyinchalik olib tashlandi (ro'yxatdan
o'tgach darhol pick qiladi). Bu ustunlar HOZIRCHA ISHLATILMAYDI, lekin
alembic tarixini buzmaslik uchun migration saqlanadi (reserved).
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers
revision: str = "0007_carrier_approval"
down_revision: str | None = "0006_china_enums"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "carrier_profiles",
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "carrier_profiles",
        sa.Column("approved_by_admin_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    # Backfill: mavjud carrier'lar tasdiqlangan deb hisoblanadi
    op.execute("UPDATE carrier_profiles SET approved_at = now() WHERE approved_at IS NULL")


def downgrade() -> None:
    op.drop_column("carrier_profiles", "approved_by_admin_id")
    op.drop_column("carrier_profiles", "approved_at")
