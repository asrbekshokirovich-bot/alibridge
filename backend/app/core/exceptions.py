"""Application-wide exceptions.

Custom exception hierarchy for domain errors.
"""

from __future__ import annotations

from typing import Any


class AppException(Exception):
    """Base application exception."""

    status_code: int = 500
    error_code: str = "internal_error"
    message: str = "An internal error occurred"

    def __init__(
        self,
        message: str | None = None,
        *,
        error_code: str | None = None,
        details: dict[str, Any] | None = None,
    ) -> None:
        self.message = message or self.message
        self.error_code = error_code or self.error_code
        self.details = details or {}
        super().__init__(self.message)


# ============================================
# Authentication / Authorization
# ============================================
class UnauthorizedError(AppException):
    """User is not authenticated."""

    status_code = 401
    error_code = "unauthorized"
    message = "Authentication required"


class ForbiddenError(AppException):
    """User is authenticated but lacks permissions."""

    status_code = 403
    error_code = "forbidden"
    message = "Access denied"


class TelegramAuthError(UnauthorizedError):
    """Telegram initData signature invalid."""

    error_code = "telegram_auth_failed"
    message = "Telegram authentication failed"


# ============================================
# Resource errors
# ============================================
class NotFoundError(AppException):
    """Resource not found."""

    status_code = 404
    error_code = "not_found"
    message = "Resource not found"


class ConflictError(AppException):
    """Resource conflict (e.g., duplicate)."""

    status_code = 409
    error_code = "conflict"
    message = "Resource conflict"


# ============================================
# Validation
# ============================================
class ValidationError(AppException):
    """Input validation failed."""

    status_code = 422
    error_code = "validation_error"
    message = "Validation failed"


# ============================================
# Domain errors (business logic)
# ============================================
class DomainError(AppException):
    """Base for domain/business logic errors."""

    status_code = 400


class InvalidCustodyTransitionError(DomainError):
    """Invalid custody state transition.

    Defends: Invariant 1.
    Example: trying to move package from WH directly to ORDERER (skipping CARRIER).
    """

    error_code = "invalid_custody_transition"
    message = "This custody transition is not allowed"


class WeightLimitExceededError(DomainError):
    """Carrier weight limit exceeded."""

    error_code = "weight_limit_exceeded"
    message = "Adding this item would exceed your weight limit"


class BasketLockedError(ConflictError):
    """Item already in another carrier's basket."""

    error_code = "basket_locked"
    message = "This item is already in another carrier's basket"


class TrustTierViolationError(DomainError):
    """Trust tier doesn't allow this action.

    Example: NEW carrier trying to pick LUXURY items.
    """

    error_code = "trust_tier_violation"
    message = "Your trust tier doesn't allow this action"


class FirstTripCapExceededError(DomainError):
    """First-trip value cap exceeded."""

    error_code = "first_trip_cap_exceeded"
    message = "First-trip value cap exceeded"


# ============================================
# External services
# ============================================
class ExternalServiceError(AppException):
    """External service (OCR, SMS, etc.) failed."""

    status_code = 503
    error_code = "external_service_error"
    message = "External service unavailable"


class OcrError(ExternalServiceError):
    """OCR service failed."""

    error_code = "ocr_failed"
    message = "Document recognition failed"


class SmsError(ExternalServiceError):
    """SMS sending failed."""

    error_code = "sms_failed"
    message = "SMS sending failed"


# ============================================
# Rate limiting
# ============================================
class RateLimitError(AppException):
    """Too many requests."""

    status_code = 429
    error_code = "rate_limit_exceeded"
    message = "Too many requests, please try again later"
