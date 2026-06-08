from enum import StrEnum


class Role(StrEnum):
    NEW = "new"  # botda ro'yxatdan o'tdi, hali rol tanlamagan (Welcome ko'rsatiladi)
    ORDERER = "orderer"
    WAREHOUSE_UZ = "warehouse_uz"
    WAREHOUSE_TR = "warehouse_tr"
    CHINA_WORKER = "china_worker"
    CARRIER = "carrier"
    COURIER_UZ = "courier_uz"
    COURIER_TR = "courier_tr"
    ADMIN = "admin"
    PENDING = "pending"  # xodim ro'yxatdan o'tdi, admin tasdig'ini kutmoqda


class RegType(StrEnum):
    CARRIER = "carrier"
    ORDERER = "orderer"
    STAFF = "staff"


class ProductType(StrEnum):
    PIECE = "piece"  # donali
    BOXED = "boxed"  # kiloli (qutili) — narx kg bo'yicha
    TEXTILE = "textile"  # tekstil — narx kg bo'yicha
    WEIGHT = "weight"  # ESKI — textile ga ko'chiriladi (orqaga moslik uchun saqlanadi)

    @property
    def priced_by_weight(self) -> bool:
        """Narx kg bo'yicha hisoblanadigan turlar (donali emas)."""
        return self in (ProductType.BOXED, ProductType.TEXTILE, ProductType.WEIGHT)


class ProductStatus(StrEnum):
    IN_WAREHOUSE_UZ = "in_warehouse_uz"  # Toshkent omborida (katalogda)
    PENDING_ADMIN = "pending_admin"  # yo'lovchi tanladi, admin tasdig'i kutilmoqda
    CONFIRMED = "confirmed"  # admin tasdiqladi
    WITH_CARRIER = "with_carrier"  # yo'lovchida
    DELIVERED_TR = "delivered_tr"  # Turkiyaga topshirildi
    DAMAGED = "damaged"  # zarar yetgan


class OrderStatus(StrEnum):
    PENDING_ADMIN = "pending_admin"
    CONFIRMED = "confirmed"
    IN_WAREHOUSE_UZ = "in_warehouse_uz"
    WITH_CARRIER = "with_carrier"
    DELIVERED_TR = "delivered_tr"


class PickupType(StrEnum):
    SELF = "self"  # yo'lovchi o'zi oladi
    COURIER = "courier"  # kuryer keladi


class DisputeStatus(StrEnum):
    OPEN = "open"
    RESOLVED = "resolved"
    REJECTED = "rejected"


class PaymentStatus(StrEnum):
    UNPAID = "unpaid"
    PAID = "paid"


class StaffRequestStatus(StrEnum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class HolderType(StrEnum):
    """custody_events — yuk kimda."""

    WAREHOUSE_UZ = "warehouse_uz"
    COURIER_UZ = "courier_uz"
    CARRIER = "carrier"
    COURIER_TR = "courier_tr"
    WAREHOUSE_TR = "warehouse_tr"
    ORDERER = "orderer"


class CustodyEventType(StrEnum):
    RECEIVED = "received"  # ombor qabul qildi (Xitoydan)
    HANDOVER_TO_CARRIER = "handover_to_carrier"
    HANDOVER_TO_COURIER_UZ = "handover_to_courier_uz"
    COURIER_UZ_PICKUP = "courier_uz_pickup"
    AIRPORT_HANDOVER = "airport_handover"  # kuryer -> yo'lovchi aeroportda
    CARRIER_RECEIVED = "carrier_received"  # yo'lovchi qabul qildi
    COURIER_TR_RECEIVED = "courier_tr_received"
    WAREHOUSE_TR_RECEIVED = "warehouse_tr_received"
    WAREHOUSE_TR_HANDOVER = "warehouse_tr_handover"
    DELIVERED = "delivered"  # buyurtmachiga yetkazildi
    DAMAGED = "damaged"
