"""dispute_resolution_to_text

Revision ID: 0003_dispute_res
Revises: 5382bb69f1ea
Create Date: 2026-05-21 15:00:00.000000

dispute_resolution_enum (DEDUCT/WRITE_OFF/REORDER/REFUND_ORDERER) ni TEXT ga
o'zgartirish. Frontend CARRIER_FAULT/FORCE_MAJEURE/ORDERER_FAULT/SPLIT yuboradi.
disputes jadvali bo'sh (0 rows) — xavfsiz.
"""
from __future__ import annotations
from alembic import op


revision: str = '0003_dispute_res'
down_revision: str | None = '5382bb69f1ea'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Column type: enum → text (disputes table bo'sh)
    op.execute("ALTER TABLE disputes ALTER COLUMN resolution TYPE TEXT")
    op.execute("DROP TYPE IF EXISTS dispute_resolution_enum")


def downgrade() -> None:
    # No rollback needed — table is empty and enum values have changed
    pass
