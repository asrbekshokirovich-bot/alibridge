"""add flight_number to orders

Revision ID: 0011_flight_number
Revises: 0010_fix_wh_holder
Create Date: 2026-06-16

"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0011_flight_number"
down_revision: str | None = "0010_fix_wh_holder"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("orders", sa.Column("flight_number", sa.String(length=32), nullable=True))


def downgrade() -> None:
    op.drop_column("orders", "flight_number")
