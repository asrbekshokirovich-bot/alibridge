"""Domain enums.

All enumerated types used across the system.
These values are also reflected in the database schema.
"""

from __future__ import annotations

from enum import StrEnum


# ============================================
# Roles
# ============================================
class Role(StrEnum):
    """User roles. Multiple roles per user are allowed (additive)."""

    ORDERER = "orderer"
    CHINA_WORKER = "china_worker"
    WAREHOUSE_UZ = "warehouse_uz"
    WAREHOUSE_TR = "warehouse_tr"
    CARRIER = "carrier"
    COURIER_UZ = "courier_uz"
    COURIER_TR = "courier_tr"
    ADMIN = "admin"


# ============================================
# Custody holders
# ============================================
class HolderType(StrEnum):
    """Who is currently holding a product."""

    CHINA_SUPPLIER = "china_supplier"
    IN_TRANSIT_CN_UZ = "in_transit_cn_uz"
    TASHKENT_WH = "tashkent_wh"
    COURIER_UZ = "courier_uz"
    YANDEX_BRIDGE = "yandex_bridge"
    CARRIER = "carrier"
    COURIER_TR = "courier_tr"
    TR_WH = "tr_wh"
    ORDERER = "orderer"
    ORDERER_WALKIN = "orderer_walkin"
    LOST = "lost"  # terminal: dispute resolution


# ============================================
# Product status
# ============================================
class ProductStatus(StrEnum):
    """Lifecycle status of a product (one physical unit)."""

    PENDING_INTAKE = "pending_intake"      # arrived at UZ WH, not yet processed
    AT_TASHKENT_WH = "at_tashkent_wh"      # in catalog, available
    IN_BASKET = "in_basket"                # in some carrier's basket (locked)
    WITH_COURIER_UZ = "with_courier_uz"    # being delivered to carrier
    WITH_CARRIER = "with_carrier"          # carrier holds it
    IN_FLIGHT = "in_flight"                # carrier is flying
    WITH_COURIER_TR = "with_courier_tr"    # picked up by TR courier
    AT_TR_WH = "at_tr_wh"                  # arrived at TR warehouse
    DELIVERED = "delivered"                # final delivery to orderer
    LOST = "lost"                          # disputed/written off
    CANCELLED = "cancelled"                # withdrawn before delivery


# ============================================
# Custody event types
# ============================================
class CustodyEventType(StrEnum):
    """Type of custody event recorded in the ledger."""

    CREATED = "created"                    # product card created at intake
    PICKED_BY_COURIER = "picked_by_courier"
    DELIVERED_TO_CARRIER = "delivered_to_carrier"
    YANDEX_SEALED = "yandex_sealed"
    YANDEX_RECEIVED = "yandex_received"
    DEPARTED = "departed"                  # carrier boarded the flight
    LANDED = "landed"                      # carrier arrived in TR
    HANDED_TO_TR_COURIER = "handed_to_tr_courier"
    HANDED_TO_TR_WH = "handed_to_tr_wh"
    DELIVERED_TO_ORDERER = "delivered_to_orderer"
    FLAGGED_LOST = "flagged_lost"
    RETURNED = "returned"
    ADMIN_OVERRIDE = "admin_override"


# ============================================
# Orders
# ============================================
class OrderSource(StrEnum):
    """How was the order created."""

    SELF_VIA_BOT = "self_via_bot"          # orderer used the bot
    ON_BEHALF_WALKIN = "on_behalf_walkin"  # worker created for walk-in


class OrderStatus(StrEnum):
    """Derived order status, computed from order_lines + products."""

    DRAFT = "draft"
    PENDING_SOURCING = "pending_sourcing"
    SOURCING = "sourcing"
    IN_TRANSIT_CN_UZ = "in_transit_cn_uz"
    AT_TASHKENT = "at_tashkent"
    IN_TRANSIT_UZ_TR = "in_transit_uz_tr"
    AT_TR_WH = "at_tr_wh"
    PARTIALLY_DELIVERED = "partially_delivered"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"
    DISPUTED = "disputed"


class FulfillmentStatus(StrEnum):
    """Per-order-line fulfillment status."""

    PENDING_SOURCING = "pending_sourcing"
    SOURCING = "sourcing"
    IN_TRANSIT = "in_transit"
    RECEIVED_FULL = "received_full"
    RECEIVED_PARTIAL = "received_partial"
    RECEIVED_OVER = "received_over"
    CANCELLED = "cancelled"


class ValueTier(StrEnum):
    """Item value tier — affects carrier visibility (NEW carriers can't see LUXURY)."""

    REGULAR = "regular"
    LUXURY = "luxury"


# ============================================
# Carriers
# ============================================
class TrustTier(StrEnum):
    """Carrier trust level. Auto-promoted after successful trips."""

    NEW = "new"          # first trip, capped value, no LUXURY
    STANDARD = "standard"
    TRUSTED = "trusted"  # can see LUXURY
    VIP = "vip"          # bigger weight limits, priority


class OnboardingChannel(StrEnum):
    """How the carrier was onboarded."""

    SELF_SERVE = "self_serve"
    AIRPORT_BACKSIDE = "airport_backside"
    ADMIN_INVITED = "admin_invited"


# ============================================
# Handoff modes
# ============================================
class HandoffMode(StrEnum):
    """How does the carrier receive items in Tashkent."""

    WH_PICKUP = "wh_pickup"            # carrier comes to warehouse
    FREE_TASHKENT = "free_tashkent"    # our courier delivers (free)
    YANDEX = "yandex"                  # Yandex Go (paid by carrier)
    AIRPORT_BACKSIDE = "airport_backside"


class HandoffStatus(StrEnum):
    """Carrier pick (basket item) status."""

    IN_BASKET = "in_basket"                  # 20-min TTL lock
    AWAITING_HANDOFF = "awaiting_handoff"    # confirmed, waiting pickup
    CARRIER_HAS_CUSTODY = "carrier_has_custody"
    IN_FLIGHT = "in_flight"
    LANDED = "landed"
    DROPPED_OFF = "dropped_off"              # at TR
    DELIVERED = "delivered"                  # to orderer
    CANCELLED = "cancelled"


class TrDeliveryMode(StrEnum):
    """How items reach TR warehouse from carrier."""

    TR_COURIER_FROM_CARRIER = "tr_courier_from_carrier"
    CARRIER_DROPOFF = "carrier_dropoff"


# ============================================
# Conditions & damages
# ============================================
class ProductCondition(StrEnum):
    """Item condition observed at intake."""

    OK = "ok"
    DAMAGED = "damaged"
    WRONG_SPEC = "wrong_spec"


# ============================================
# Payouts
# ============================================
class PayoutMethod(StrEnum):
    """How carrier wants to be paid."""

    CASH = "cash"
    BANK = "bank"
    CRYPTO = "crypto"
    OTHER = "other"


class PayoutStatus(StrEnum):
    """Payout request lifecycle."""

    REQUESTED = "requested"
    APPROVED = "approved"
    PAID = "paid"
    REJECTED = "rejected"


# ============================================
# Disputes
# ============================================
class DisputeType(StrEnum):
    """Type of dispute raised."""

    LOST = "lost"
    DAMAGED = "damaged"
    WRONG_ITEM = "wrong_item"
    NOT_RECEIVED = "not_received"


class DisputeStatus(StrEnum):
    """Dispute lifecycle on a carrier_pick."""

    NONE = "none"
    DISPUTED = "disputed"
    RESOLVED = "resolved"


class DisputeResolution(StrEnum):
    """How the admin resolved a dispute."""

    CARRIER_FAULT = "CARRIER_FAULT"    # deduct from carrier payout
    FORCE_MAJEURE = "FORCE_MAJEURE"    # company eats the loss
    ORDERER_FAULT = "ORDERER_FAULT"    # orderer at fault, no deduction
    SPLIT         = "SPLIT"            # partial deduction


# ============================================
# Languages
# ============================================
class Language(StrEnum):
    """Supported languages."""

    UZ = "uz"
    RU = "ru"
    TR = "tr"
    EN = "en"
