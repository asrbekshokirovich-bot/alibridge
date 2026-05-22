"""Audit log — every state change is recorded here.

Retained 3 years minimum. Used for:
- Compliance / regulatory audits
- Debugging "who did what when"
- Detecting suspicious admin activity
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Index,
    String,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.infra.db.base import Base, UUIDPrimaryKeyMixin


class AuditLog(Base, UUIDPrimaryKeyMixin):
    """Append-only audit log for all significant state changes.

    Similar to custody_events but covers ALL changes, not just custody.
    """

    __tablename__ = "audit_log"
    __table_args__ = (
        Index("ix_audit_log_actor_at", "actor_user_id", "at"),
        Index("ix_audit_log_target", "target_table", "target_id"),
        Index("ix_audit_log_action_at", "action", "at"),
    )

    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,  # null for system actions
    )
    action: Mapped[str] = mapped_column(String(64), nullable=False)

    target_table: Mapped[str] = mapped_column(String(64), nullable=False)
    target_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)

    before: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    after: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)

    # Context (request_id, IP, user agent, etc.)
    context: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)

    at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    def __repr__(self) -> str:
        return (
            f"<AuditLog action={self.action} target={self.target_table}/{self.target_id} "
            f"actor={self.actor_user_id} at={self.at}>"
        )
