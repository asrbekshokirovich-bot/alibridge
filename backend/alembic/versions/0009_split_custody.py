"""split custody — miqdor bo'yicha bo'linadigan yuk egaligi

Revision ID: 0009_split_custody
Revises: 0008_oi_variant_setnull
Create Date: 2026-06-12

Yangi custody_holdings jadval: bir variant (o'lcham) bir egada nechta turibdi.
custody_events ga variant_id + quantity (split custody tarixi).

Backfill: har mavjud variant uchun WAREHOUSE_UZ holding (test yuklar ko'rinib tursin).

Eslatma: Supabase transaction pooler DO-bloklarni / CREATE FUNCTION ni
qo'llamaydi — sof DDL + sof SQL INSERT...SELECT ishlatamiz.
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0009_split_custody"
down_revision: str | None = "0008_oi_variant_setnull"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # ── 1) custody_holdings jadval ──
    op.create_table(
        "custody_holdings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("product_id", sa.Integer(), nullable=False),
        sa.Column("variant_id", sa.Integer(), nullable=False),
        sa.Column("holder_type", sa.String(32), nullable=False),
        sa.Column("holder_id", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("quantity", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["variant_id"], ["product_variants.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_custody_holdings_product_id", "custody_holdings", ["product_id"])
    op.create_unique_constraint(
        "uq_custody_holdings_variant_holder",
        "custody_holdings",
        ["variant_id", "holder_type", "holder_id"],
    )

    # ── 2) custody_events ga variant_id + quantity ──
    op.add_column("custody_events", sa.Column("variant_id", sa.Integer(), nullable=True))
    op.add_column(
        "custody_events",
        sa.Column("quantity", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_foreign_key(
        "fk_custody_events_variant_id",
        "custody_events",
        "product_variants",
        ["variant_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # ── 3) Backfill: har variant uchun holding (test yuklar ko'rinib tursin) ──
    #    holder_type: product.custody_holder_type bo'lsa o'shani, bo'lmasa warehouse_uz.
    #    holder_id: WAREHOUSE_UZ/WAREHOUSE_TR/ORDERER da DOIM 0 (xodimsiz, sentinel);
    #               kuryer/yo'lovchi da custody_holder_id (aniq shaxs).
    op.execute(
        """
        INSERT INTO custody_holdings (product_id, variant_id, holder_type, holder_id, quantity)
        SELECT
            v.product_id,
            v.id,
            COALESCE(p.custody_holder_type, 'warehouse_uz'),
            CASE
                WHEN COALESCE(p.custody_holder_type, 'warehouse_uz')
                     IN ('warehouse_uz', 'warehouse_tr', 'orderer') THEN 0
                ELSE COALESCE(p.custody_holder_id, 0)
            END,
            v.quantity
        FROM product_variants v
        JOIN products p ON p.id = v.product_id
        WHERE v.quantity > 0
        """
    )


def downgrade() -> None:
    op.drop_constraint("fk_custody_events_variant_id", "custody_events", type_="foreignkey")
    op.drop_column("custody_events", "quantity")
    op.drop_column("custody_events", "variant_id")
    op.drop_constraint(
        "uq_custody_holdings_variant_holder", "custody_holdings", type_="unique"
    )
    op.drop_index("ix_custody_holdings_product_id", "custody_holdings")
    op.drop_table("custody_holdings")
