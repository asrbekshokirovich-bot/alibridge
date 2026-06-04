"""Product.tare_weight_g — quti(tara) vazni (tekstil rejimi).

Revision ID: 0012_product_tare_weight
Revises: 0011_sourcing_mode
Create Date: 2026-06-04 00:00:00.000000
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0012_product_tare_weight"
down_revision: str | None = "0011_sourcing_mode"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "products",
        sa.Column("tare_weight_g", sa.Integer(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("products", "tare_weight_g")
