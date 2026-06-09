"""product tare_kg

Revision ID: 0004_tare
Revises: a1b2c3d4e5f6
Create Date: 2026-06-09

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0004_tare"
down_revision: str | None = "a1b2c3d4e5f6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "products",
        sa.Column("tare_kg", sa.Numeric(18, 4), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("products", "tare_kg")
