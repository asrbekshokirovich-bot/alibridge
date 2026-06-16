"""add pending_handovers table

Revision ID: 0012_pending_handover
Revises: 0011_flight_number
Create Date: 2026-06-16

"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0012_pending_handover"
down_revision: str | None = "0011_flight_number"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "pending_handovers",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("carrier_id", sa.Integer(), nullable=False),
        sa.Column("courier_id", sa.Integer(), nullable=False),
        sa.Column("items", sa.JSON(), nullable=True),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="pending"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["carrier_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["courier_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_pending_handovers_carrier_id", "pending_handovers", ["carrier_id"])
    op.create_index("ix_pending_handovers_status", "pending_handovers", ["status"])


def downgrade() -> None:
    op.drop_index("ix_pending_handovers_status", table_name="pending_handovers")
    op.drop_index("ix_pending_handovers_carrier_id", table_name="pending_handovers")
    op.drop_table("pending_handovers")
