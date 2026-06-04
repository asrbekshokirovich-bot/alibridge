"""SourcingSpec.sourcing_mode (piece/box/textile) ustuni.

Revision ID: 0011_sourcing_mode
Revises: 0010_carrier_pick_approval
Create Date: 2026-06-03 00:00:00.000000
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0011_sourcing_mode"
down_revision: str | None = "0010_carrier_pick_approval"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "sourcing_specs",
        sa.Column("sourcing_mode", sa.String(16), nullable=False, server_default="piece"),
    )


def downgrade() -> None:
    op.drop_column("sourcing_specs", "sourcing_mode")
