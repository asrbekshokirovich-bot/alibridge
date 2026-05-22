"""FastAPI dependency injection."""

from app.api.deps.auth import get_current_user, require_role
from app.api.deps.db import get_db_session

__all__ = ["get_current_user", "require_role", "get_db_session"]
