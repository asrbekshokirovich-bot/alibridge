"""carrier_profiles — shaxsiy ma'lumot maydonlari qo'shish

Revision ID: 0005_carrier_personal_info
Revises: 0004_carrier_passport_nullable
Create Date: 2026-05-26
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision: str = '0005_carrier_personal_info'
down_revision: str | None = '0004_carrier_passport_nullable'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('carrier_profiles', sa.Column('first_name',  sa.String(100), nullable=True))
    op.add_column('carrier_profiles', sa.Column('last_name',   sa.String(100), nullable=True))
    op.add_column('carrier_profiles', sa.Column('middle_name', sa.String(100), nullable=True))
    op.add_column('carrier_profiles', sa.Column('birth_date',  sa.Date(),      nullable=True))


def downgrade() -> None:
    op.drop_column('carrier_profiles', 'birth_date')
    op.drop_column('carrier_profiles', 'middle_name')
    op.drop_column('carrier_profiles', 'last_name')
    op.drop_column('carrier_profiles', 'first_name')
