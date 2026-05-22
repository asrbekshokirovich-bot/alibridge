"""
China Worker endpoints — Xitoy xodimi uchun.

  GET /china/tickets — sourcing ticketlar ro'yxati (OrderLine → ticket mapping)

CHINA_WORKER roli talab qilinadi.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps.auth import require_role
from app.api.deps.db import get_db_session
from app.domain.enums import FulfillmentStatus, Role
from app.infra.db.models.order import OrderLine, SourcingSpec
from app.infra.db.models.user import User

router = APIRouter()

# FulfillmentStatus → frontend ticket status
_STATUS_MAP: dict[str, str] = {
    FulfillmentStatus.PENDING_SOURCING.value: "OPEN",
    FulfillmentStatus.SOURCING.value:         "SOURCING",
    FulfillmentStatus.IN_TRANSIT.value:       "READY",
    FulfillmentStatus.RECEIVED_FULL.value:    "DONE",
    FulfillmentStatus.RECEIVED_PARTIAL.value: "DONE",
    FulfillmentStatus.RECEIVED_OVER.value:    "DONE",
    FulfillmentStatus.CANCELLED.value:        "DONE",
}


@router.get("/tickets")
async def china_tickets(
    _: User = Depends(require_role(Role.CHINA_WORKER)),
    session: AsyncSession = Depends(get_db_session),
) -> list[dict]:
    """Sourcing ticketlar — OrderLine lar PENDING_SOURCING yoki SOURCING holatida."""
    stmt = (
        select(OrderLine, SourcingSpec)
        .join(SourcingSpec, OrderLine.sourcing_spec_id == SourcingSpec.id)
        .where(
            OrderLine.fulfillment_status.in_([
                FulfillmentStatus.PENDING_SOURCING.value,
                FulfillmentStatus.SOURCING.value,
            ])
        )
        .order_by(OrderLine.created_at.desc())
    )
    rows = (await session.execute(stmt)).all()

    return [
        {
            "id": str(line.id),
            "ticket_number": str(line.id)[:8].upper(),
            "spec_title": spec.title,
            "spec_photos": spec.photos or [],
            "quantity_needed": line.quantity,
            "quantity_sourced": 0,   # TODO: count products where order_line_id = line.id
            "target_unit_price_cny": "0",
            "notes": line.notes,
            "status": _STATUS_MAP.get(line.fulfillment_status, "OPEN"),
            "deadline": None,
        }
        for line, spec in rows
    ]
