"""S3-compatible storage (passport, ticket, intake photos)."""

from app.infra.storage.s3 import S3Storage, get_storage

__all__ = ["S3Storage", "get_storage"]
