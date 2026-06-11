"""order_items.variant_id FK -> ON DELETE SET NULL

Revision ID: 0008_oi_variant_setnull
Revises: 0007_delete_cascade
Create Date: 2026-06-11

Mahsulot o'chirilganda variantlari CASCADE bilan o'chadi (0005/0007).
Lekin order_items.variant_id o'sha variantga ishora qilsa, FK bloklaydi.
SET NULL bilan: buyurtma tarixi saqlanadi, faqat variant havolasi bo'shaydi.
"""
from collections.abc import Sequence

from alembic import op

revision: str = "0008_oi_variant_setnull"
down_revision: str | None = "0007_delete_cascade"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _drop_variant_fk() -> None:
    """order_items.variant_id ustunidagi BARCHA FK'larni nomidan qat'i nazar o'chiradi."""
    op.execute(
        """
        DO $$
        DECLARE r record;
        BEGIN
            FOR r IN
                SELECT con.conname
                FROM pg_constraint con
                JOIN pg_class rel ON rel.oid = con.conrelid
                JOIN pg_attribute att ON att.attrelid = con.conrelid
                    AND att.attnum = ANY(con.conkey)
                WHERE rel.relname = 'order_items'
                  AND con.contype = 'f'
                  AND att.attname = 'variant_id'
            LOOP
                EXECUTE format('ALTER TABLE order_items DROP CONSTRAINT %I', r.conname);
            END LOOP;
        END $$;
        """
    )


def upgrade() -> None:
    _drop_variant_fk()
    op.create_foreign_key(
        "fk_order_items_variant_id",
        "order_items",
        "product_variants",
        ["variant_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    _drop_variant_fk()
    op.create_foreign_key(
        "fk_order_items_variant_id",
        "order_items",
        "product_variants",
        ["variant_id"],
        ["id"],
    )
