"""ALI BRIDGE — Application entry point.

Combines FastAPI (REST API for Mini App) with aiogram (Telegram bot)
in a single process (modular monolith).
"""

from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app import __version__
from app.api.v1.router import api_router
from app.bot.dispatcher import setup_dispatcher
from app.core.config import settings
from app.core.exceptions import AppException
from app.core.limiter import limiter
from app.core.logger import configure_logging, get_logger
from app.infra.cache.redis_client import close_redis, init_redis
from app.infra.db.session import close_db, init_db
from app.infra.telegram.bot import bot, dp

log = get_logger(__name__)


# ============================================
# Lifespan: startup / shutdown
# ============================================
@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Application lifespan: setup on startup, teardown on shutdown."""
    # ---------- Startup ----------
    configure_logging()
    log.info(
        "application_starting",
        env=settings.app_env,
        version=__version__,
    )

    # DB va Redis ulanishlari
    await init_db()
    await init_redis()

    # Telegram bot — webhook yoki polling
    setup_dispatcher()

    _polling_task: asyncio.Task | None = None

    # Webhook URL localhost yoki yo'q bo'lsa — polling ishlatamiz
    _use_polling = not settings.bot_webhook_url or any(
        h in (settings.bot_webhook_url or "")
        for h in ("localhost", "127.0.0.1", "0.0.0.0")
    )

    if not _use_polling:
        # Production webhook
        try:
            await bot.set_webhook(
                url=settings.bot_webhook_url,
                secret_token=settings.bot_webhook_secret,
                drop_pending_updates=False,
            )
            log.info("bot_webhook_set", url=settings.bot_webhook_url)
        except Exception as e:
            log.warning("bot_webhook_failed_fallback_polling", error=str(e))
            _use_polling = True

    if _use_polling:
        # Local dev: polling — eski webhook'ni o'chirish
        try:
            await bot.delete_webhook(drop_pending_updates=True)
        except Exception:
            pass

        async def _safe_poll() -> None:
            try:
                await dp.start_polling(bot, handle_signals=False)
            except Exception as e:
                log.error(
                    "bot_polling_error",
                    error=str(e),
                    hint="Check BOT_TOKEN in .env — get it from @BotFather",
                )

        _polling_task = asyncio.create_task(_safe_poll())
        log.info("bot_polling_started")

    log.info("application_ready")

    yield

    # ---------- Shutdown ----------
    log.info("application_shutting_down")

    if _polling_task and not _polling_task.done():
        _polling_task.cancel()
        try:
            await _polling_task
        except (asyncio.CancelledError, Exception):
            pass

    await bot.session.close()
    await close_redis()
    await close_db()

    log.info("application_stopped")


# ============================================
# Create FastAPI application
# ============================================
app = FastAPI(
    title="ALI BRIDGE API",
    description="Telegram Bot + Mini App for cargo logistics (CN → UZ → TR)",
    version=__version__,
    docs_url="/docs" if not settings.is_production else None,
    redoc_url="/redoc" if not settings.is_production else None,
    openapi_url="/openapi.json" if not settings.is_production else None,
    lifespan=lifespan,
)

# Rate limiter — SlowAPI
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


# ============================================
# CORS
# ============================================
if settings.cors_origins_list:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


# ============================================
# Exception handlers
# ============================================
@app.exception_handler(AppException)
async def app_exception_handler(
    request: Request,
    exc: AppException,
) -> JSONResponse:
    """Handle application-level exceptions uniformly."""
    log.warning(
        "app_exception",
        path=request.url.path,
        error_code=exc.error_code,
        message=exc.message,
        details=exc.details,
    )
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": exc.error_code,
                "message": exc.message,
                "details": exc.details,
            }
        },
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request,
    exc: RequestValidationError,
) -> JSONResponse:
    """Handle Pydantic validation errors."""
    return JSONResponse(
        status_code=422,
        content={
            "error": {
                "code": "validation_error",
                "message": "Request validation failed",
                "details": {"errors": exc.errors()},
            }
        },
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(
    request: Request,
    exc: Exception,
) -> JSONResponse:
    """Catch-all for unhandled exceptions."""
    log.exception(
        "unhandled_exception",
        path=request.url.path,
        error_type=type(exc).__name__,
    )
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "internal_error",
                "message": "An internal error occurred",
            }
        },
    )


# ============================================
# Health check
# ============================================
@app.get("/health", tags=["health"])
async def health_check() -> dict[str, str]:
    """Basic liveness check."""
    return {
        "status": "ok",
        "service": "ali-bridge",
        "version": __version__,
        "environment": settings.app_env,
    }


@app.get("/", tags=["root"])
async def root() -> dict[str, str]:
    """Root endpoint."""
    return {
        "service": "ALI BRIDGE",
        "version": __version__,
        "docs": "/docs" if not settings.is_production else "disabled",
    }


# ============================================
# API routers — barchasi
# ============================================
app.include_router(api_router, prefix=settings.api_prefix)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=settings.is_development,
    )
