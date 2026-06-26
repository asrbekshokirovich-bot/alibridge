"""drop pending_handovers table

Revision ID: 0014_drop_pending_handovers
Revises: 0013_order_handover
Create Date: 2026-06-26

Kuryer endi yo'lovchiga yukni DARHOL topshiradi (qabul tasdig'i shart emas),
shuning uchun pending_handovers jadvali kerak emas.
"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0014_drop_pending_handovers"
down_revision: str | None = "0013_order_handover"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_table("pending_handovers")


def downgrade() -> None:
    op.create_table(
        "pending_handovers",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("carrier_id", sa.Integer(), sa.ForeignKey("users.id"), index=True),
        sa.Column("courier_id", sa.Integer(), sa.ForeignKey("users.id")),
        sa.Column("items", sa.JSON(), nullable=True),
        sa.Column("status", sa.String(length=16), index=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
    )
