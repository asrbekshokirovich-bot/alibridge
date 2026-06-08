"""boxed product type: box_count, units_per_box + weight->textile

Revision ID: 0003
Revises: 0002
Create Date: 2026-06-08

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("products", sa.Column("box_count", sa.Integer(), nullable=True))
    op.add_column("products", sa.Column("units_per_box", sa.Integer(), nullable=True))
    # Eski 'weight' turi endi 'textile' deb yuritiladi
    op.execute("UPDATE products SET type = 'textile' WHERE type = 'weight'")


def downgrade() -> None:
    op.execute("UPDATE products SET type = 'weight' WHERE type = 'textile'")
    op.drop_column("products", "units_per_box")
    op.drop_column("products", "box_count")
