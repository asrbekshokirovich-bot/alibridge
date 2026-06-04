"""
Invariant 1 — Custody State Machine transition testlari.
DEV_PLAN §17.1 ga mos.

Har bir test: qaysi transition ruxsat etilgan va qaysi taqiqlangan.
Zanjir: China → Tashkent → Carrier → TR → Orderer.
"""
import pytest

from app.core.exceptions import InvalidCustodyTransitionError
from app.domain.enums import CustodyEventType, HolderType
from app.domain.state_machines.custody import (
    VALID_TRANSITIONS,
    CustodyStateMachine,
)

sm = CustodyStateMachine()


# ─── Ruxsat etilgan transition'lar ────────────────────────────────────────────

class TestValidTransitions:
    """Barcha legal state o'tishlari tekshiriladi."""

    # China oqimi (zanjir boshi)
    def test_create_at_china(self):
        sm.validate_transition(
            from_holder=None,
            to_holder=HolderType.CHINA_SUPPLIER,
            event_type=CustodyEventType.CREATED,
        )

    def test_china_to_transit(self):
        sm.validate_transition(
            from_holder=HolderType.CHINA_SUPPLIER,
            to_holder=HolderType.IN_TRANSIT_CN_UZ,
            event_type=CustodyEventType.SHIPPED_FROM_CHINA,
        )

    def test_transit_to_tashkent(self):
        sm.validate_transition(
            from_holder=HolderType.IN_TRANSIT_CN_UZ,
            to_holder=HolderType.TASHKENT_WH,
            event_type=CustodyEventType.RECEIVED_AT_TASHKENT,
        )

    # UZ oqimi
    def test_create_at_tashkent(self):
        sm.validate_transition(
            from_holder=None,
            to_holder=HolderType.TASHKENT_WH,
            event_type=CustodyEventType.CREATED,
        )

    def test_tashkent_to_carrier(self):
        sm.validate_transition(
            from_holder=HolderType.TASHKENT_WH,
            to_holder=HolderType.CARRIER,
            event_type=CustodyEventType.DELIVERED_TO_CARRIER,
        )

    def test_tashkent_to_courier_uz(self):
        sm.validate_transition(
            from_holder=HolderType.TASHKENT_WH,
            to_holder=HolderType.COURIER_UZ,
            event_type=CustodyEventType.PICKED_BY_COURIER,
        )

    def test_courier_uz_to_carrier(self):
        sm.validate_transition(
            from_holder=HolderType.COURIER_UZ,
            to_holder=HolderType.CARRIER,
            event_type=CustodyEventType.DELIVERED_TO_CARRIER,
        )

    # TR oqimi
    def test_carrier_to_courier_tr(self):
        sm.validate_transition(
            from_holder=HolderType.CARRIER,
            to_holder=HolderType.COURIER_TR,
            event_type=CustodyEventType.HANDED_TO_TR_COURIER,
        )

    def test_courier_tr_to_tr_wh(self):
        sm.validate_transition(
            from_holder=HolderType.COURIER_TR,
            to_holder=HolderType.TR_WH,
            event_type=CustodyEventType.HANDED_TO_TR_WH,
        )

    def test_carrier_to_tr_wh_direct(self):
        sm.validate_transition(
            from_holder=HolderType.CARRIER,
            to_holder=HolderType.TR_WH,
            event_type=CustodyEventType.HANDED_TO_TR_WH,
        )

    def test_tr_wh_to_orderer(self):
        sm.validate_transition(
            from_holder=HolderType.TR_WH,
            to_holder=HolderType.ORDERER,
            event_type=CustodyEventType.DELIVERED_TO_ORDERER,
        )

    # Reys (holder o'zgarmaydi)
    def test_carrier_departed_same_holder(self):
        sm.validate_transition(
            from_holder=HolderType.CARRIER,
            to_holder=HolderType.CARRIER,
            event_type=CustodyEventType.DEPARTED,
        )

    def test_admin_override_anywhere(self):
        sm.validate_transition(
            from_holder=HolderType.ORDERER,
            to_holder=HolderType.CHINA_SUPPLIER,
            event_type=CustodyEventType.ADMIN_OVERRIDE,
        )


# ─── Taqiqlangan transition'lar ───────────────────────────────────────────────

class TestInvalidTransitions:
    """Illegal transition'lar InvalidCustodyTransitionError ko'tarishi shart."""

    def test_china_to_tashkent_skip_transit(self):
        """China'dan to'g'ridan Tashkent'ga (transit'ni o'tkazib) — mumkin emas."""
        with pytest.raises(InvalidCustodyTransitionError):
            sm.validate_transition(
                from_holder=HolderType.CHINA_SUPPLIER,
                to_holder=HolderType.TASHKENT_WH,
                event_type=CustodyEventType.RECEIVED_AT_TASHKENT,
            )

    def test_china_to_carrier(self):
        """China'dan to'g'ridan carrier'ga — Tashkent'ni o'tkazib bo'lmaydi."""
        with pytest.raises(InvalidCustodyTransitionError):
            sm.validate_transition(
                from_holder=HolderType.CHINA_SUPPLIER,
                to_holder=HolderType.CARRIER,
                event_type=CustodyEventType.DELIVERED_TO_CARRIER,
            )

    def test_tashkent_to_china_backwards(self):
        """Orqaga qaytish taqiqlangan."""
        with pytest.raises(InvalidCustodyTransitionError):
            sm.validate_transition(
                from_holder=HolderType.TASHKENT_WH,
                to_holder=HolderType.CHINA_SUPPLIER,
                event_type=CustodyEventType.CREATED,
            )

    def test_china_to_transit_wrong_event(self):
        """To'g'ri yo'nalish, lekin noto'g'ri event_type."""
        with pytest.raises(InvalidCustodyTransitionError):
            sm.validate_transition(
                from_holder=HolderType.CHINA_SUPPLIER,
                to_holder=HolderType.IN_TRANSIT_CN_UZ,
                event_type=CustodyEventType.CREATED,
            )

    def test_orderer_to_carrier(self):
        """Orderer — terminal, hech kimga transfer qila olmaydi."""
        with pytest.raises(InvalidCustodyTransitionError):
            sm.validate_transition(
                from_holder=HolderType.ORDERER,
                to_holder=HolderType.CARRIER,
                event_type=CustodyEventType.DELIVERED_TO_CARRIER,
            )

    def test_carrier_to_tashkent_skip(self):
        """Carrier → Tashkent (orqaga) — mumkin emas."""
        with pytest.raises(InvalidCustodyTransitionError):
            sm.validate_transition(
                from_holder=HolderType.CARRIER,
                to_holder=HolderType.TASHKENT_WH,
                event_type=CustodyEventType.DELIVERED_TO_CARRIER,
            )

    def test_same_holder_without_flight_event(self):
        """Bir xil egadan o'tish faqat DEPARTED/LANDED uchun; boshqasi mumkin emas."""
        with pytest.raises(InvalidCustodyTransitionError):
            sm.validate_transition(
                from_holder=HolderType.TASHKENT_WH,
                to_holder=HolderType.TASHKENT_WH,
                event_type=CustodyEventType.DELIVERED_TO_CARRIER,
            )


# ─── can_transition va get_valid_next_holders ─────────────────────────────────

class TestHelperMethods:
    def test_can_transition_valid(self):
        assert sm.can_transition(
            from_holder=HolderType.CHINA_SUPPLIER,
            to_holder=HolderType.IN_TRANSIT_CN_UZ,
            event_type=CustodyEventType.SHIPPED_FROM_CHINA,
        ) is True

    def test_can_transition_invalid(self):
        assert sm.can_transition(
            from_holder=HolderType.ORDERER,
            to_holder=HolderType.CARRIER,
            event_type=CustodyEventType.DELIVERED_TO_CARRIER,
        ) is False

    def test_next_holders_china(self):
        nexts = sm.get_valid_next_holders(HolderType.CHINA_SUPPLIER)
        assert HolderType.IN_TRANSIT_CN_UZ in nexts
        assert HolderType.LOST in nexts
        assert HolderType.TASHKENT_WH not in nexts

    def test_next_holders_transit(self):
        nexts = sm.get_valid_next_holders(HolderType.IN_TRANSIT_CN_UZ)
        assert HolderType.TASHKENT_WH in nexts
        assert HolderType.CARRIER not in nexts

    def test_next_holders_orderer_is_empty(self):
        """Orderer — terminal state."""
        assert len(sm.get_valid_next_holders(HolderType.ORDERER)) == 0

    def test_validate_returns_none_on_success(self):
        result = sm.validate_transition(
            from_holder=HolderType.CARRIER,
            to_holder=HolderType.TR_WH,
            event_type=CustodyEventType.HANDED_TO_TR_WH,
        )
        assert result is None

    def test_error_message_contains_holders(self):
        with pytest.raises(InvalidCustodyTransitionError) as exc_info:
            sm.validate_transition(
                from_holder=HolderType.ORDERER,
                to_holder=HolderType.CARRIER,
                event_type=CustodyEventType.DELIVERED_TO_CARRIER,
            )
        msg = str(exc_info.value).lower()
        assert "orderer" in msg


# ─── VALID_TRANSITIONS frozenset tekshiruvi ────────────────────────────────────

class TestTransitionSet:
    def test_valid_transitions_is_frozenset(self):
        assert isinstance(VALID_TRANSITIONS, frozenset)

    def test_valid_transitions_not_empty(self):
        assert len(VALID_TRANSITIONS) >= 5

    def test_no_self_loops_in_transitions(self):
        for t in VALID_TRANSITIONS:
            assert t.from_holder != t.to_holder, f"Self-loop: {t.from_holder}"

    def test_all_holders_are_valid_types(self):
        for t in VALID_TRANSITIONS:
            if t.from_holder is not None:
                assert isinstance(t.from_holder, HolderType)
            assert isinstance(t.to_holder, HolderType)

    def test_china_chain_present(self):
        """China zanjiri to'liq mavjudligini tasdiqlash."""
        froms_tos = {(t.from_holder, t.to_holder) for t in VALID_TRANSITIONS}
        assert (None, HolderType.CHINA_SUPPLIER) in froms_tos
        assert (HolderType.CHINA_SUPPLIER, HolderType.IN_TRANSIT_CN_UZ) in froms_tos
        assert (HolderType.IN_TRANSIT_CN_UZ, HolderType.TASHKENT_WH) in froms_tos
