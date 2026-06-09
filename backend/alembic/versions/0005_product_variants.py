"""product variants

Revision ID: 0005_variants
Revises: 0004_tare
Create Date: 2026-06-10

Yangi product_variants jadval + order_items.variant_id.
Backfill: har mavjud Product uchun 1 ta variant (size_label='') yaratiladi,
keyin har order_item shu yagona variantga bog'lanadi (backward-compat).
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0005_variants"
down_revision: str | None = "0004_tare"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "product_variants",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("product_id", sa.Integer(), nullable=False),
        sa.Column("size_label", sa.String(64), nullable=False, server_default=""),
        sa.Column("quantity", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("weight_kg", sa.Numeric(18, 4), nullable=False, server_default="0"),
        sa.Column("tare_kg", sa.Numeric(18, 4), nullable=True),
        sa.Column("unit_weight_kg", sa.Numeric(18, 4), nullable=True),
        sa.Column("box_weight_kg", sa.Numeric(18, 4), nullable=True),
        sa.Column("box_count", sa.Integer(), nullable=True),
        sa.Column("units_per_box", sa.Integer(), nullable=True),
        sa.Column("cargo_price", sa.Numeric(18, 4), nullable=False, server_default="0"),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_product_variants_product_id", "product_variants", ["product_id"])

    op.add_column(
        "order_items",
        sa.Column("variant_id", sa.Integer(), nullable=True),
    )
    op.create_index("ix_order_items_variant_id", "order_items", ["variant_id"])
    op.create_foreign_key(
        "fk_order_items_variant_id",
        "order_items",
        "product_variants",
        ["variant_id"],
        ["id"],
    )

    # ── Backfill: har Product uchun 1 ta variant (mavjud qiymatlardan ko'chiriladi) ──
    op.execute(
        """
        INSERT INTO product_variants
            (product_id, size_label, quantity, weight_kg, tare_kg, unit_weight_kg,
             box_weight_kg, box_count, units_per_box, cargo_price, position)
        SELECT
            id, '', quantity, weight_kg, tare_kg, unit_weight_kg,
            box_weight_kg, box_count, units_per_box, cargo_price, 0
        FROM products
        """
    )
    # Har order_item ni mos productning yagona variantiga bog'laymiz
    op.execute(
        """
        UPDATE order_items oi
        SET variant_id = pv.id
        FROM product_variants pv
        WHERE pv.product_id = oi.product_id
        """
    )


def downgrade() -> None:
    op.drop_constraint("fk_order_items_variant_id", "order_items", type_="foreignkey")
    op.drop_index("ix_order_items_variant_id", "order_items")
    op.drop_column("order_items", "variant_id")
    op.drop_index("ix_product_variants_product_id", "product_variants")
    op.drop_table("product_variants")
