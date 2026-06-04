"""Yangi funksiyalar: declared_value, box rejimi, carrier qarzdorligi.

Revision ID: 0008_features
Revises: 0007_carrier_approval
Create Date: 2026-06-02 00:00:00.000000

- products: declared_value, declared_currency, box_items_count
- debt_status_enum + carrier_debts jadvali
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0008_features"
down_revision: str | None = "0007_carrier_approval"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # ── products: yangi ustunlar ────────────────────────────────────────────
    op.add_column(
        "products",
        sa.Column("declared_value", sa.Numeric(18, 4), nullable=True),
    )
    op.add_column(
        "products",
        sa.Column(
            "declared_currency",
            sa.String(3),
            nullable=False,
            server_default="USD",
        ),
    )
    op.add_column(
        "products",
        sa.Column("box_items_count", sa.Integer(), nullable=True),
    )

    # ── debt_status_enum ─────────────────────────────────────────────────────
    debt_status = postgresql.ENUM(
        "outstanding", "settled", name="debt_status_enum"
    )
    debt_status.create(op.get_bind(), checkfirst=True)

    # ── carrier_debts jadvali ────────────────────────────────────────────────
    op.create_table(
        "carrier_debts",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("carrier_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("dispute_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("amount", sa.Numeric(18, 4), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False, server_default="USD"),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column(
            "status",
            postgresql.ENUM(
                "outstanding", "settled", name="debt_status_enum", create_type=False
            ),
            nullable=False,
            server_default="outstanding",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("settled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("settled_by_admin_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["carrier_user_id"],
            ["carrier_profiles.user_id"],
            name="fk_carrier_debts_carrier_user_id_carrier_profiles",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["product_id"],
            ["products.id"],
            name="fk_carrier_debts_product_id_products",
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["dispute_id"],
            ["disputes.id"],
            name="fk_carrier_debts_dispute_id_disputes",
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_carrier_debts"),
    )
    op.create_index(
        "ix_carrier_debts_carrier",
        "carrier_debts",
        ["carrier_user_id", "status"],
    )
    op.create_index(
        "ix_carrier_debts_created_at",
        "carrier_debts",
        ["created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_carrier_debts_created_at", table_name="carrier_debts")
    op.drop_index("ix_carrier_debts_carrier", table_name="carrier_debts")
    op.drop_table("carrier_debts")
    postgresql.ENUM(name="debt_status_enum").drop(op.get_bind(), checkfirst=True)
    op.drop_column("products", "box_items_count")
    op.drop_column("products", "declared_currency")
    op.drop_column("products", "declared_value")
