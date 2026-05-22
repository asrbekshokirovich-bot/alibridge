"""
Audit repository — audit log yozish (append-only).
Barcha muvaffaqiyatli va muvaffaqiyatsiz operatsiyalar.
"""
from __future__ import annotations

import uuid
from typing import Any, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infra.db.models.audit import AuditLog


class AuditRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def log(
        self,
        *,
        actor_id: str,
        action: str,
        resource_type: str,
        resource_id: str,
        changes: Optional[dict] = None,
        ip_address: Optional[str] = None,
        success: bool = True,
        error_message: Optional[str] = None,
    ) -> AuditLog:
        """Audit yozuvi qo'shish (APPEND ONLY — hech qachon o'zgartirma)."""
        import json
        log = AuditLog(
            id=str(uuid.uuid4()),
            actor_id=actor_id,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            changes=json.dumps(changes) if changes else None,
            ip_address=ip_address,
            success=success,
            error_message=error_message,
        )
        self._session.add(log)
        await self._session.flush()
        return log

    async def get_by_resource(
        self, resource_type: str, resource_id: str, limit: int = 50
    ):
        """Resurs bo'yicha audit tarixi."""
        stmt = (
            select(AuditLog)
            .where(
                AuditLog.resource_type == resource_type,
                AuditLog.resource_id == resource_id,
            )
            .order_by(AuditLog.created_at.desc())
            .limit(limit)
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def get_by_actor(self, actor_id: str, limit: int = 100):
        """Foydalanuvchi harakatlari tarixi."""
        stmt = (
            select(AuditLog)
            .where(AuditLog.actor_id == actor_id)
            .order_by(AuditLog.created_at.desc())
            .limit(limit)
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())
