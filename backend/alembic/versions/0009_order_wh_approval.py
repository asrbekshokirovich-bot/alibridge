"""orders jadvaliga wh_uz_approved_at ustuni qo'shish.

Revision ID: 0009_order_wh_approval
Revises: 0008_features
Create Date: 2026-06-03 00:00:00.000000
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0009_order_wh_approval"
down_revision: str | None = "0008_features"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "orders",
        sa.Column("wh_uz_approved_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_orders_wh_uz_approved_at", "orders", ["wh_uz_approved_at"])


def downgrade() -> None:
    op.drop_index("ix_orders_wh_uz_approved_at", table_name="orders")
    op.drop_column("orders", "wh_uz_approved_at")
