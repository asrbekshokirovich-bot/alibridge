"""user role server_default pending -> new

Revision ID: a1b2c3d4e5f6
Revises: 07934df93c1c
Create Date: 2026-06-08 13:00:00.000000

"""
from collections.abc import Sequence

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: str | None = '07934df93c1c'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column('users', 'role', server_default='new')


def downgrade() -> None:
    op.alter_column('users', 'role', server_default='pending')
