"""
HOSTILE TEST — Invariant 2: Information Firewall.
DEV_PLAN §17.3

Xitoy xodimi HECH QACHON orderer ma'lumotlarini ko'ra olmasligi shart.
Bu test ChinaRepository'ning API'sida orderer_id yoki customer_paid
fieldlari mavjud emasligini tekshiradi.
"""
import pytest
from app.repositories.china_repo import SourcingTicket


class TestInvariant2InformationFirewall:
    """
    Xitoy xodimi uchun SourcingTicket strukturasi
    orderer_id va customer_paid field'larini o'z ichiga olmaydi.
    """

    def test_sourcing_ticket_has_no_orderer_id(self):
        """SourcingTicket'da orderer_id atributi bo'lmasligi shart."""
        ticket = SourcingTicket(
            id="test-id",
            ticket_number="TK-001",
            spec_title="iPhone 15 Pro",
            spec_photos=["https://example.com/photo.jpg"],
            quantity_needed=5,
            quantity_sourced=0,
            target_unit_price_cny="4500.00",
            notes=None,
            status="OPEN",
            deadline=None,
        )
        assert not hasattr(ticket, "orderer_id"), (
            "SECURITY VIOLATION: SourcingTicket should NOT have orderer_id field!"
        )

    def test_sourcing_ticket_has_no_customer_paid(self):
        """SourcingTicket'da customer_paid atributi bo'lmasligi shart."""
        ticket = SourcingTicket(
            id="test-id",
            ticket_number="TK-001",
            spec_title="Test Product",
            spec_photos=[],
            quantity_needed=1,
            quantity_sourced=0,
            target_unit_price_cny="100.00",
            notes=None,
            status="OPEN",
            deadline=None,
        )
        assert not hasattr(ticket, "customer_paid"), (
            "SECURITY VIOLATION: SourcingTicket should NOT have customer_paid field!"
        )

    def test_sourcing_ticket_has_no_order_price(self):
        """SourcingTicket'da order_price atributi bo'lmasligi shart."""
        ticket = SourcingTicket(
            id="test-id",
            ticket_number="TK-001",
            spec_title="Test",
            spec_photos=[],
            quantity_needed=1,
            quantity_sourced=0,
            target_unit_price_cny="100.00",
            notes=None,
            status="OPEN",
            deadline=None,
        )
        assert not hasattr(ticket, "order_price"), (
            "SECURITY VIOLATION: SourcingTicket should NOT expose order pricing!"
        )

    def test_sourcing_ticket_has_no_orderer_name(self):
        """SourcingTicket'da orderer_name atributi bo'lmasligi shart."""
        ticket = SourcingTicket(
            id="test-id",
            ticket_number="TK-001",
            spec_title="Test",
            spec_photos=[],
            quantity_needed=1,
            quantity_sourced=0,
            target_unit_price_cny="100.00",
            notes=None,
            status="OPEN",
            deadline=None,
        )
        assert not hasattr(ticket, "orderer_name"), (
            "SECURITY VIOLATION: SourcingTicket should NOT expose orderer identity!"
        )

    def test_sourcing_ticket_fields_are_product_only(self):
        """
        SourcingTicket faqat mahsulot spesifikatsiyasini o'z ichiga oladi:
        - spec_title, spec_photos, quantity, price guidance, notes, status, deadline.
        """
        ticket = SourcingTicket(
            id="test-id",
            ticket_number="TK-001",
            spec_title="Test",
            spec_photos=[],
            quantity_needed=2,
            quantity_sourced=1,
            target_unit_price_cny="200.00",
            notes="Check color carefully",
            status="SOURCING",
            deadline="2025-01-01T00:00:00Z",
        )
        # Mavjud bo'lishi kerak bo'lgan fieldlar
        assert hasattr(ticket, "spec_title")
        assert hasattr(ticket, "spec_photos")
        assert hasattr(ticket, "quantity_needed")
        assert hasattr(ticket, "quantity_sourced")
        assert hasattr(ticket, "target_unit_price_cny")
        assert hasattr(ticket, "status")

    def test_china_repository_does_not_import_order_model(self):
        """
        ChinaRepository moduli Order yoki orderer bog'liq import qilmasligi shart.
        Bu structural check.
        """
        import inspect
        import app.repositories.china_repo as china_module

        source = inspect.getsource(china_module)
        # Xavfli import'lar
        forbidden_patterns = [
            "orderer_id",
            "customer_paid",
            "order_price",
            "OrderLine",
        ]
        for pattern in forbidden_patterns:
            assert pattern not in source, (
                f"SECURITY VIOLATION: '{pattern}' found in china_repo.py source!"
            )
