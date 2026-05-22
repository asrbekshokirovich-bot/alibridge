"""carrier passport fields and arrive_at nullable

Revision ID: 0004_carrier_passport_nullable
Revises: 0003_dispute_resolution_to_text
Create Date: 2026-05-22
"""
from __future__ import annotations

from alembic import op

revision: str = '0004_carrier_passport_nullable'
down_revision: str | None = '0003_dispute_res'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # passport identity fields — now optional (mini-app onboarding doesn't do MRZ)
    op.alter_column('carrier_profiles', 'passport_number', nullable=True)
    op.alter_column('carrier_profiles', 'passport_country', nullable=True)
    op.alter_column('carrier_profiles', 'passport_expires_on', nullable=True)
    # arrive_at — optional (carrier may not know exact arrival time at registration)
    op.alter_column('carrier_profiles', 'arrive_at', nullable=True)


def downgrade() -> None:
    op.alter_column('carrier_profiles', 'arrive_at', nullable=False)
    op.alter_column('carrier_profiles', 'passport_expires_on', nullable=False)
    op.alter_column('carrier_profiles', 'passport_country', nullable=False)
    op.alter_column('carrier_profiles', 'passport_number', nullable=False)
