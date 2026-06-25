"""add handed_to_courier_id to orders

Revision ID: 0013_order_handover
Revises: 0012_pending_handover
Create Date: 2026-06-25

Buyurtma kuryerga topshirilganda — qaysi kuryerga berilgani yoziladi.
Shu maydon to'lgach, ombor "Topshirish" tugmasini qayta ko'rsatmaydi.
"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0013_order_handover"
down_revision: str | None = "0012_pending_handover"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "orders",
        sa.Column(
            "handed_to_courier_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("orders", "handed_to_courier_id")
