"""user web login

Revision ID: 0006_web_login
Revises: 0005_variants
Create Date: 2026-06-10

Sayt (brauzer) orqali kirish uchun: users.username (login) + users.password_hash.
Ikkalasi ham nullable — Telegram orqali kirgan foydalanuvchilarda bo'sh qoladi.
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0006_web_login"
down_revision: str | None = "0005_variants"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("username", sa.String(64), nullable=True))
    op.add_column("users", sa.Column("password_hash", sa.String(256), nullable=True))
    op.create_index("ix_users_username", "users", ["username"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_users_username", "users")
    op.drop_column("users", "password_hash")
    op.drop_column("users", "username")
