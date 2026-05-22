"""Domain entities — Pydantic DTOs for API responses and internal use.

These are NOT SQLAlchemy models. They're pure data transfer objects
that decouple the domain from the persistence layer.
"""

from app.domain.entities.carrier import (
    CarrierProfileEntity,
    CarrierPickEntity,
    RouteEntity,
)
from app.domain.entities.custody import CustodyEventEntity
from app.domain.entities.dispute import DisputeEntity
from app.domain.entities.order import (
    OrderEntity,
    OrderLineEntity,
    SourcingSpecEntity,
)
from app.domain.entities.payout import PayoutEntity, PayoutLineEntity
from app.domain.entities.product import ProductEntity
from app.domain.entities.user import (
    UserEntity,
    UserRoleEntity,
    WalkInCustomerEntity,
)

__all__ = [
    "CarrierProfileEntity",
    "CarrierPickEntity",
    "RouteEntity",
    "CustodyEventEntity",
    "DisputeEntity",
    "OrderEntity",
    "OrderLineEntity",
    "SourcingSpecEntity",
    "PayoutEntity",
    "PayoutLineEntity",
    "ProductEntity",
    "UserEntity",
    "UserRoleEntity",
    "WalkInCustomerEntity",
]
