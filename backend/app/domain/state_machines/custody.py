"""Custody state machine — Invariant 1.

At any instant, every product has EXACTLY ONE holder.
Transitions are server-validated. Invalid transitions raise.

This module has NO external dependencies — pure business logic.

Reference: docs/DEV_PLAN_V2 §3 (Invariant 1) and §4.4 (custody_events).
"""

from __future__ import annotations

from dataclasses import dataclass

from app.core.exceptions import InvalidCustodyTransitionError
from app.domain.enums import CustodyEventType, HolderType


@dataclass(frozen=True, slots=True)
class CustodyTransition:
    """A single valid transition in the custody state machine."""

    from_holder: HolderType | None  # None = creation event
    to_holder: HolderType
    event_type: CustodyEventType


# ============================================
# The state machine: ALL valid transitions
# ============================================
# Read as: (from, to, event) is allowed.
# Anything not in this set is rejected.
VALID_TRANSITIONS: frozenset[CustodyTransition] = frozenset(
    {
        # Initial creation: product card created at UZ WH intake
        CustodyTransition(
            from_holder=None,
            to_holder=HolderType.TASHKENT_WH,
            event_type=CustodyEventType.CREATED,
        ),
        # ============================================
        # UZ side: warehouse → carrier (3 modes)
        # ============================================
        # Mode A: warehouse pickup (direct to carrier)
        CustodyTransition(
            from_holder=HolderType.TASHKENT_WH,
            to_holder=HolderType.CARRIER,
            event_type=CustodyEventType.DELIVERED_TO_CARRIER,
        ),
        # Mode B: free Tashkent delivery (warehouse → courier → carrier)
        CustodyTransition(
            from_holder=HolderType.TASHKENT_WH,
            to_holder=HolderType.COURIER_UZ,
            event_type=CustodyEventType.PICKED_BY_COURIER,
        ),
        CustodyTransition(
            from_holder=HolderType.COURIER_UZ,
            to_holder=HolderType.CARRIER,
            event_type=CustodyEventType.DELIVERED_TO_CARRIER,
        ),
        # Mode C: Yandex Go (sealed bag)
        CustodyTransition(
            from_holder=HolderType.TASHKENT_WH,
            to_holder=HolderType.YANDEX_BRIDGE,
            event_type=CustodyEventType.YANDEX_SEALED,
        ),
        CustodyTransition(
            from_holder=HolderType.YANDEX_BRIDGE,
            to_holder=HolderType.CARRIER,
            event_type=CustodyEventType.YANDEX_RECEIVED,
        ),
        # Mode D: Airport-backside (UZ courier carries airport stock)
        CustodyTransition(
            from_holder=HolderType.COURIER_UZ,
            to_holder=HolderType.TASHKENT_WH,
            event_type=CustodyEventType.RETURNED,
        ),
        # ============================================
        # Carrier flight: UZ → TR
        # ============================================
        # Note: DEPARTED and LANDED don't change holder, just status.
        # They're recorded in custody_events for audit but holder stays CARRIER.
        # ============================================
        # TR side: carrier → courier/warehouse
        # ============================================
        # Option 1: TR courier picks up from carrier
        CustodyTransition(
            from_holder=HolderType.CARRIER,
            to_holder=HolderType.COURIER_TR,
            event_type=CustodyEventType.HANDED_TO_TR_COURIER,
        ),
        CustodyTransition(
            from_holder=HolderType.COURIER_TR,
            to_holder=HolderType.TR_WH,
            event_type=CustodyEventType.HANDED_TO_TR_WH,
        ),
        # Option 2: Carrier drops off directly at TR warehouse
        CustodyTransition(
            from_holder=HolderType.CARRIER,
            to_holder=HolderType.TR_WH,
            event_type=CustodyEventType.HANDED_TO_TR_WH,
        ),
        # ============================================
        # Final delivery to orderer
        # ============================================
        CustodyTransition(
            from_holder=HolderType.TR_WH,
            to_holder=HolderType.ORDERER,
            event_type=CustodyEventType.DELIVERED_TO_ORDERER,
        ),
        CustodyTransition(
            from_holder=HolderType.TR_WH,
            to_holder=HolderType.ORDERER_WALKIN,
            event_type=CustodyEventType.DELIVERED_TO_ORDERER,
        ),
        # ============================================
        # Loss / write-off (terminal)
        # ============================================
        # Any holder can transition to LOST via admin override or dispute.
        # We list common loss paths but admin_override covers edge cases.
        CustodyTransition(
            from_holder=HolderType.CARRIER,
            to_holder=HolderType.LOST,
            event_type=CustodyEventType.FLAGGED_LOST,
        ),
        CustodyTransition(
            from_holder=HolderType.COURIER_UZ,
            to_holder=HolderType.LOST,
            event_type=CustodyEventType.FLAGGED_LOST,
        ),
        CustodyTransition(
            from_holder=HolderType.COURIER_TR,
            to_holder=HolderType.LOST,
            event_type=CustodyEventType.FLAGGED_LOST,
        ),
        CustodyTransition(
            from_holder=HolderType.YANDEX_BRIDGE,
            to_holder=HolderType.LOST,
            event_type=CustodyEventType.FLAGGED_LOST,
        ),
    }
)


# ============================================
# Status transitions WITHOUT holder change
# These are recorded in custody_events but holder stays the same.
# ============================================
SAME_HOLDER_EVENTS: frozenset[CustodyEventType] = frozenset(
    {
        CustodyEventType.DEPARTED,  # carrier boarded the flight
        CustodyEventType.LANDED,    # carrier arrived in TR
    }
)


class CustodyStateMachine:
    """Validates and applies custody transitions.

    Usage:
        sm = CustodyStateMachine()
        sm.validate_transition(
            from_holder=HolderType.TASHKENT_WH,
            to_holder=HolderType.CARRIER,
            event_type=CustodyEventType.DELIVERED_TO_CARRIER,
        )  # Raises InvalidCustodyTransitionError if invalid

    Or check without raising:
        if sm.can_transition(...):
            ...
    """

    def can_transition(
        self,
        *,
        from_holder: HolderType | None,
        to_holder: HolderType,
        event_type: CustodyEventType,
    ) -> bool:
        """Check if a transition is valid (no raise)."""
        # Same-holder events: only require event_type validation
        if event_type in SAME_HOLDER_EVENTS:
            return from_holder == to_holder

        # Admin override: allowed from anywhere to anywhere (audit logged)
        if event_type == CustodyEventType.ADMIN_OVERRIDE:
            return True

        transition = CustodyTransition(
            from_holder=from_holder,
            to_holder=to_holder,
            event_type=event_type,
        )
        return transition in VALID_TRANSITIONS

    def validate_transition(
        self,
        *,
        from_holder: HolderType | None,
        to_holder: HolderType,
        event_type: CustodyEventType,
    ) -> None:
        """Validate transition. Raises InvalidCustodyTransitionError if invalid."""
        if not self.can_transition(
            from_holder=from_holder,
            to_holder=to_holder,
            event_type=event_type,
        ):
            raise InvalidCustodyTransitionError(
                message=(
                    f"Invalid custody transition: "
                    f"{from_holder} → {to_holder} via {event_type}"
                ),
                details={
                    "from_holder": from_holder,
                    "to_holder": to_holder,
                    "event_type": event_type,
                },
            )

    def get_valid_next_holders(
        self,
        current_holder: HolderType,
    ) -> set[HolderType]:
        """Get all holders this item can transition to from current state."""
        return {
            t.to_holder
            for t in VALID_TRANSITIONS
            if t.from_holder == current_holder
        }

    def get_valid_events_for_transition(
        self,
        *,
        from_holder: HolderType,
        to_holder: HolderType,
    ) -> set[CustodyEventType]:
        """Get all event types that can carry this from→to transition."""
        return {
            t.event_type
            for t in VALID_TRANSITIONS
            if t.from_holder == from_holder and t.to_holder == to_holder
        }
