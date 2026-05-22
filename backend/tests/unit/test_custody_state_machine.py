"""
Invariant 1 — Custody State Machine uchun ~50 ta transition test.
DEV_PLAN §17.1 ga mos.

Har bir test: qaysi transition ruxsat etilgan va qaysi taqiqlangan.
"""
import pytest
from app.domain.enums import HolderType
from app.domain.state_machines.custody import CustodyStateMachine
from app.core.exceptions import InvalidCustodyTransitionError

sm = CustodyStateMachine()

# ─── Ruxsat etilgan transition'lar ────────────────────────────────────────────

class TestValidTransitions:
    """Barcha legal state o'tishlari tekshiriladi."""

    def test_china_to_carrier(self):
        sm.validate_transition(HolderType.CHINA_WORKER, HolderType.CARRIER)

    def test_carrier_to_warehouse_uz(self):
        sm.validate_transition(HolderType.CARRIER, HolderType.WAREHOUSE_UZ)

    def test_warehouse_uz_to_warehouse_tr(self):
        sm.validate_transition(HolderType.WAREHOUSE_UZ, HolderType.WAREHOUSE_TR)

    def test_warehouse_tr_to_courier_tr(self):
        sm.validate_transition(HolderType.WAREHOUSE_TR, HolderType.COURIER_TR)

    def test_courier_tr_to_orderer(self):
        sm.validate_transition(HolderType.COURIER_TR, HolderType.ORDERER)

    def test_warehouse_uz_to_courier_uz(self):
        """Mahalliy yetkazib berish (Toshkent ichida)."""
        sm.validate_transition(HolderType.WAREHOUSE_UZ, HolderType.COURIER_UZ)

    def test_courier_uz_to_orderer(self):
        sm.validate_transition(HolderType.COURIER_UZ, HolderType.ORDERER)


# ─── Taqiqlangan transition'lar ───────────────────────────────────────────────

class TestInvalidTransitions:
    """Illegal transition'lar InvalidCustodyTransitionError ko'tarishi shart."""

    def test_carrier_to_china(self):
        """Orqaga qaytish taqiqlangan."""
        with pytest.raises(InvalidCustodyTransitionError):
            sm.validate_transition(HolderType.CARRIER, HolderType.CHINA_WORKER)

    def test_orderer_to_carrier(self):
        """Orderer hech kimga transfer qila olmaydi."""
        with pytest.raises(InvalidCustodyTransitionError):
            sm.validate_transition(HolderType.ORDERER, HolderType.CARRIER)

    def test_orderer_to_warehouse_uz(self):
        with pytest.raises(InvalidCustodyTransitionError):
            sm.validate_transition(HolderType.ORDERER, HolderType.WAREHOUSE_UZ)

    def test_china_to_warehouse_uz_skip_carrier(self):
        """Carrier'ni o'tkazib yuborish mumkin emas."""
        with pytest.raises(InvalidCustodyTransitionError):
            sm.validate_transition(HolderType.CHINA_WORKER, HolderType.WAREHOUSE_UZ)

    def test_china_to_orderer_direct(self):
        """To'g'ridan-to'g'ri delivery mumkin emas."""
        with pytest.raises(InvalidCustodyTransitionError):
            sm.validate_transition(HolderType.CHINA_WORKER, HolderType.ORDERER)

    def test_carrier_to_courier_tr(self):
        """Carrier → Courier TR (warehouse'ni o'tkazib)."""
        with pytest.raises(InvalidCustodyTransitionError):
            sm.validate_transition(HolderType.CARRIER, HolderType.COURIER_TR)

    def test_warehouse_tr_to_china(self):
        """Orqaga zanjir yo'q."""
        with pytest.raises(InvalidCustodyTransitionError):
            sm.validate_transition(HolderType.WAREHOUSE_TR, HolderType.CHINA_WORKER)

    def test_warehouse_uz_to_orderer_direct(self):
        """Warehouse UZ → Orderer (courier'ni o'tkazib)."""
        with pytest.raises(InvalidCustodyTransitionError):
            sm.validate_transition(HolderType.WAREHOUSE_UZ, HolderType.ORDERER)

    def test_carrier_to_warehouse_tr_skip_uz(self):
        """Carrier → Warehouse TR (Toshkent'ni o'tkazib)."""
        with pytest.raises(InvalidCustodyTransitionError):
            sm.validate_transition(HolderType.CARRIER, HolderType.WAREHOUSE_TR)

    def test_courier_tr_to_warehouse_uz(self):
        """Courier TR → Warehouse UZ — orqaga."""
        with pytest.raises(InvalidCustodyTransitionError):
            sm.validate_transition(HolderType.COURIER_TR, HolderType.WAREHOUSE_UZ)

    def test_courier_uz_to_warehouse_tr(self):
        with pytest.raises(InvalidCustodyTransitionError):
            sm.validate_transition(HolderType.COURIER_UZ, HolderType.WAREHOUSE_TR)

    def test_same_holder_transition(self):
        """Bir xil egadan o'tish mantiqsiz."""
        for holder in HolderType:
            with pytest.raises(InvalidCustodyTransitionError):
                sm.validate_transition(holder, holder)


# ─── can_transition va get_valid_next_holders ─────────────────────────────────

class TestHelperMethods:
    def test_can_transition_valid(self):
        assert sm.can_transition(HolderType.CHINA_WORKER, HolderType.CARRIER) is True

    def test_can_transition_invalid(self):
        assert sm.can_transition(HolderType.ORDERER, HolderType.CARRIER) is False

    def test_get_valid_next_holders_china(self):
        nexts = sm.get_valid_next_holders(HolderType.CHINA_WORKER)
        assert HolderType.CARRIER in nexts
        assert HolderType.WAREHOUSE_UZ not in nexts

    def test_get_valid_next_holders_carrier(self):
        nexts = sm.get_valid_next_holders(HolderType.CARRIER)
        assert HolderType.WAREHOUSE_UZ in nexts
        assert len(nexts) == 1  # faqat bitta yo'l

    def test_get_valid_next_holders_warehouse_uz(self):
        nexts = sm.get_valid_next_holders(HolderType.WAREHOUSE_UZ)
        assert HolderType.WAREHOUSE_TR in nexts
        assert HolderType.COURIER_UZ in nexts

    def test_get_valid_next_holders_orderer_is_empty(self):
        """Orderer — terminal state."""
        nexts = sm.get_valid_next_holders(HolderType.ORDERER)
        assert len(nexts) == 0

    def test_validate_returns_none_on_success(self):
        """validate_transition muvaffaqiyatda None qaytarishi shart."""
        result = sm.validate_transition(HolderType.CARRIER, HolderType.WAREHOUSE_UZ)
        assert result is None

    def test_error_message_contains_holders(self):
        """Xato xabarida from/to holderlar ko'rsatilishi shart."""
        with pytest.raises(InvalidCustodyTransitionError) as exc_info:
            sm.validate_transition(HolderType.ORDERER, HolderType.CARRIER)
        assert "ORDERER" in str(exc_info.value) or "orderer" in str(exc_info.value).lower()


# ─── VALID_TRANSITIONS frozenset tekshiruvi ────────────────────────────────────

class TestTransitionSet:
    def test_valid_transitions_is_frozenset(self):
        from app.domain.state_machines.custody import VALID_TRANSITIONS
        assert isinstance(VALID_TRANSITIONS, frozenset)

    def test_valid_transitions_not_empty(self):
        from app.domain.state_machines.custody import VALID_TRANSITIONS
        assert len(VALID_TRANSITIONS) >= 5

    def test_no_self_loops_in_transitions(self):
        from app.domain.state_machines.custody import VALID_TRANSITIONS
        for (frm, to) in VALID_TRANSITIONS:
            assert frm != to, f"Self-loop detected: {frm}"

    def test_all_pairs_are_holder_types(self):
        from app.domain.state_machines.custody import VALID_TRANSITIONS
        holder_values = {h.value for h in HolderType}
        for (frm, to) in VALID_TRANSITIONS:
            assert frm.value in holder_values
            assert to.value in holder_values
