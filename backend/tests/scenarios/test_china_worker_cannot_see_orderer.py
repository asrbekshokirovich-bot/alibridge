"""
HOSTILE TEST — Invariant 2: Information Firewall.
DEV_PLAN §17.3

Xitoy xodimi HECH QACHON orderer ma'lumotlarini (kim buyurtma bergan,
qancha to'lagan) ko'ra olmasligi shart.

ChinaSourcingRepository faqat sourcing uchun zarur maydonlarni qaytaradi
(title, photos, miqdor, rang, izoh). orderer_id / customer_paid_amount kabi
maxfiy maydonlar SQL SELECT'ga FIZIK JIHATDAN kirmaydi — shuning uchun bu
test repo metodlarining manba kodini tekshiradi: agar kelajakda kimdir
maxfiy maydonni qo'shsa, test darhol buziladi.
"""
import inspect

from app.repositories.china_repo import ChinaSourcingRepository

# China worker'ga OCHILMAYDIGAN maxfiy maydonlar (Invariant 2)
FORBIDDEN_FIELDS = [
    "orderer_id",
    "orderer_user_id",
    "customer_paid_amount",
    "customer_paid_currency",
    "walk_in_customer_id",
    "orderer_name",
]


class TestInvariant2InformationFirewall:
    """China repo metodlari orderer/to'lov ma'lumotini ochmasligi shart."""

    def test_get_open_tickets_excludes_orderer_fields(self):
        source = inspect.getsource(ChinaSourcingRepository.get_open_tickets)
        for field in FORBIDDEN_FIELDS:
            assert field not in source, (
                f"SECURITY VIOLATION: get_open_tickets '{field}' maydonini "
                f"qaytarishi mumkin emas (Invariant 2 — Information Firewall)!"
            )

    def test_get_my_shipments_excludes_orderer_fields(self):
        source = inspect.getsource(ChinaSourcingRepository.get_my_shipments)
        for field in FORBIDDEN_FIELDS:
            assert field not in source, (
                f"SECURITY VIOLATION: get_my_shipments '{field}' maydonini "
                f"qaytarishi mumkin emas (Invariant 2 — Information Firewall)!"
            )
