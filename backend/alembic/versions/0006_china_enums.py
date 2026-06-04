"""China oqimi uchun enum qiymatlari (event_type, product_status).

Revision ID: 0006_china_enums
Revises: 0005_carrier_personal_info
Create Date: 2026-05-31 00:00:00.000000

Eslatma: role_enum ('china_worker') va holder_type_enum ('china_supplier',
'in_transit_cn_uz') 0001_initial da allaqachon mavjud. Bu migration faqat
China sourcing oqimi paytida qo'shilgan yangi custody event va product status
qiymatlarini qo'shadi.
"""
from __future__ import annotations

from collections.abc import Sequence

from alembic import op

# revision identifiers
revision: str = "0006_china_enums"
down_revision: str | None = "0005_carrier_personal_info"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # event_type_enum — China handoff event'lari
    op.execute("ALTER TYPE event_type_enum ADD VALUE IF NOT EXISTS 'shipped_from_china'")
    op.execute("ALTER TYPE event_type_enum ADD VALUE IF NOT EXISTS 'received_at_tashkent'")
    # product_status_enum — China bosqichi holatlari
    op.execute("ALTER TYPE product_status_enum ADD VALUE IF NOT EXISTS 'ready_at_china'")
    op.execute("ALTER TYPE product_status_enum ADD VALUE IF NOT EXISTS 'in_transit_cn_uz'")


def downgrade() -> None:
    # PostgreSQL ENUM qiymatini olib tashlashni qo'llab-quvvatlamaydi — no-op.
    pass
