"""order_items.variant_id FK -> ON DELETE SET NULL

Revision ID: 0008_oi_variant_setnull
Revises: 0007_delete_cascade
Create Date: 2026-06-11

Mahsulot o'chirilganda variantlari CASCADE bilan o'chadi (0005/0007).
Lekin order_items.variant_id o'sha variantga ishora qilsa, FK bloklaydi.
SET NULL bilan: buyurtma tarixi saqlanadi, faqat variant havolasi bo'shaydi.

Eslatma: Supabase transaction pooler DO-bloklarni qo'llamaydi —
FK nomi (fk_order_items_variant_id, 0005 dan) ma'lum, sof DDL ishlatamiz.
"""
from collections.abc import Sequence

from alembic import op

revision: str = "0008_oi_variant_setnull"
down_revision: str | None = "0007_delete_cascade"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE order_items DROP CONSTRAINT IF EXISTS fk_order_items_variant_id"
    )
    op.execute(
        "ALTER TABLE order_items ADD CONSTRAINT fk_order_items_variant_id "
        "FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE SET NULL"
    )


def downgrade() -> None:
    op.execute(
        "ALTER TABLE order_items DROP CONSTRAINT IF EXISTS fk_order_items_variant_id"
    )
    op.execute(
        "ALTER TABLE order_items ADD CONSTRAINT fk_order_items_variant_id "
        "FOREIGN KEY (variant_id) REFERENCES product_variants(id)"
    )
