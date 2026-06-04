"""ALI BRIDGE — Application entry point.

Combines FastAPI (REST API for Mini App) with aiogram (Telegram bot)
in a single process (modular monolith).
"""

from __future__ import annotations

import asyncio
import re
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
# Cloudflared tunnel URL — avtomatik topish
# ============================================
def _get_cloudflared_webhook_url() -> str | None:
    """cloudflared tunnel URL'ni avto-topish.

    Ustuvorlik tartibi:
    1. Shared volume faylidagi log (`/cf_shared/tunnel.log`)
    2. Docker socket (Linux muhitida)
    """
    # ── 1. Shared volume (cross-platform, eng ishonchli) ─────────────────────
    try:
        with open("/cf_shared/tunnel.log") as fh:
            content = fh.read()
        # JSON format: {"message":"...https://xxx.trycloudflare.com..."} yoki oddiy matn
        # re.findall — oxirgi (eng yangi) URL ni olish uchun
        matches = re.findall(r"https://[a-z0-9-]+\.trycloudflare\.com", content)
        if matches:
            base = matches[-1].rstrip("/")
            return f"{base}/api/v1/telegram/webhook"
    except OSError:
        pass

    # ── 2. Docker socket (Linux) ──────────────────────────────────────────────
    try:
        import docker  # type: ignore[import]
        client = docker.DockerClient(base_url="unix:///var/run/docker.sock")
        try:
            container = client.containers.get("alibridge-cloudflared")
            raw_logs = container.logs(tail=100, stdout=True, stderr=True)
            logs = raw_logs.decode("utf-8", errors="ignore")
            match = re.search(r"https://[a-z0-9-]+\.trycloudflare\.com", logs)
            if match:
                base = match.group(0).rstrip("/")
                return f"{base}/api/v1/telegram/webhook"
        finally:
            client.close()
    except Exception as e:
        log.debug("cloudflared_url_detect_failed", error=str(e))

    return None


def _detect_miniapp_url() -> str | None:
    """cloudflared log'dan jonli Mini App bazaviy URL'ini topadi (webhook suffsiksiz)."""
    webhook = _get_cloudflared_webhook_url()
    if webhook and "trycloudflare.com" in webhook:
        return webhook.replace("/api/v1/telegram/webhook", "").rstrip("/")
    return None


async def _set_menu_button(url: str) -> bool:
    """Telegram "Menu Button"ni berilgan Mini App URL bilan o'rnatadi."""
    if not url.startswith("https://") or "localhost" in url:
        return False
    try:
        from aiogram.types import MenuButtonWebApp, WebAppInfo as _WebAppInfo

        await bot.set_chat_menu_button(
            menu_button=MenuButtonWebApp(
                text="ALI BRIDGE",
                web_app=_WebAppInfo(url=url),
            )
        )
        log.info("menu_button_set", url=url)
        return True
    except Exception as e:
        log.warning("menu_button_failed", error=str(e))
        return False


async def _miniapp_url_watcher() -> None:
    """Ephemeral cloudflared tunnel URL'i restart/qayta-ulanishda o'zgaradi.

    Bu fon vazifasi log faylni davriy kuzatib, yangi URL paydo bo'lganda
    menu button'ni avto-yangilaydi — Mini App havolasi doim jonli qoladi.
    """
    while True:
        await asyncio.sleep(15)
        try:
            latest = _detect_miniapp_url()
            if latest and latest != settings.miniapp_url:
                log.info(
                    "miniapp_url_changed",
                    old=settings.miniapp_url,
                    new=latest,
                )
                settings.miniapp_url = latest
                await _set_menu_button(latest)
        except asyncio.CancelledError:
            raise
        except Exception as e:
            log.debug("miniapp_url_watcher_error", error=str(e))


async def _run_in_process_worker():
    """arq Worker'ni backend process'i ichida ishga tushiradi (alohida servis o'rniga).

    Render Starter'da bitta servis uchun — fon cron vazifalari (basket TTL,
    landing ping, FX kurslari, dispute eslatma) shu yerda bajariladi.
    Worker'ni faqat bitta instance ishga tushirishi kerak; agar autoscaling
    yoqilsa, alohida `type: worker` servisiga ko'chirilsin.
    """
    from arq.worker import Worker

    from app.workers.main import WorkerSettings

    worker = Worker(
        functions=WorkerSettings.functions,
        cron_jobs=WorkerSettings.cron_jobs,
        redis_settings=WorkerSettings.redis_settings,
        max_jobs=WorkerSettings.max_jobs,
        job_timeout=WorkerSettings.job_timeout,
        handle_signals=False,  # FastAPI lifespan signallarni boshqaradi
    )
    log.info("in_process_worker_starting")
    try:
        await worker.async_run()
    except asyncio.CancelledError:
        await worker.close()
        raise
    except Exception as e:
        log.error("in_process_worker_error", error=str(e))


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

    # Webhook URL aniqlash:
    # 1. Agar BOT_WEBHOOK_URL bo'sh yoki trycloudflare.com (ephemeral) bo'lsa —
    #    cloudflared log'dan yangi URL avto-aniqlanadi
    # 2. Aks holda (real domain) — env qiymati ishlatiladi
    _configured_url = settings.bot_webhook_url or ""
    if not _configured_url or "trycloudflare.com" in _configured_url:
        await asyncio.sleep(2)  # cloudflared tayyor bo'lishi uchun
        _webhook_url: str | None = _get_cloudflared_webhook_url()
    else:
        _webhook_url = _configured_url

    # Mini App tugmasi ephemeral cloudflared tunnel'ining JONLI URL'ini ishlatsin.
    # (.env dagi MINIAPP_URL har cloudflared restartida eskirib qoladi → "kirmayapti".)
    if _webhook_url and "trycloudflare.com" in _webhook_url:
        _miniapp_base = _webhook_url.replace("/api/v1/telegram/webhook", "").rstrip("/")
        settings.miniapp_url = _miniapp_base
        log.info("miniapp_url_autodetected", url=_miniapp_base)

    _use_polling = settings.bot_force_polling or not _webhook_url or any(
        h in (_webhook_url or "")
        for h in ("localhost", "127.0.0.1", "0.0.0.0")
    )

    if not _use_polling and _webhook_url:
        # Production webhook
        try:
            await bot.set_webhook(
                url=_webhook_url,
                secret_token=settings.bot_webhook_secret,
                drop_pending_updates=False,
            )
            log.info("bot_webhook_set", url=_webhook_url)
        except Exception as e:
            log.warning("bot_webhook_failed_polling", error=str(e))
            _use_polling = True

    if _use_polling:
        # Local dev: polling — eski webhook'ni o'chirish
        try:
            await bot.delete_webhook(drop_pending_updates=True)
        except Exception:
            pass

        _ALLOWED_UPDATES = ["message", "callback_query", "my_chat_member"]

        async def _safe_poll() -> None:
            backoff = 5
            while True:
                try:
                    await dp.start_polling(
                        bot,
                        handle_signals=False,
                        allowed_updates=_ALLOWED_UPDATES,
                    )
                    break  # clean shutdown (CancelledError raised externally)
                except asyncio.CancelledError:
                    raise
                except Exception as e:
                    log.error(
                        "bot_polling_error",
                        error=str(e),
                        hint="Restarting in seconds...",
                    )
                    await asyncio.sleep(backoff)
                    backoff = min(backoff * 2, 60)

        _polling_task = asyncio.create_task(_safe_poll())
        log.info("bot_polling_started", allowed_updates=["message", "callback_query", "my_chat_member"])

    # Telegram "Menu Button" (chap-pastdagi doimiy tugma) — jonli Mini App URL bilan
    # sinxronlash. Aks holda BotFather'dagi eski statik URL yangi userlarda
    # "Name or service not known" beradi (ephemeral cloudflared tunnel o'zgaradi).
    await _set_menu_button(settings.miniapp_url)

    # Tunnel URL'i restart/qayta-ulanishda o'zgaradi — fon kuzatuvchisi
    # menu button'ni jonli tutadi.
    _url_watcher_task: asyncio.Task | None = None
    if "trycloudflare.com" in settings.miniapp_url:
        _url_watcher_task = asyncio.create_task(_miniapp_url_watcher())

    # arq fon worker'i — alohida servis o'rniga shu process'da (Render Starter).
    _worker_task: asyncio.Task | None = None
    if settings.run_worker_in_process:
        _worker_task = asyncio.create_task(_run_in_process_worker())

    log.info("application_ready")

    yield

    # ---------- Shutdown ----------
    log.info("application_shutting_down")

    if _worker_task and not _worker_task.done():
        _worker_task.cancel()
        try:
            await _worker_task
        except (asyncio.CancelledError, Exception):
            pass

    if _url_watcher_task and not _url_watcher_task.done():
        _url_watcher_task.cancel()
        try:
            await _url_watcher_task
        except (asyncio.CancelledError, Exception):
            pass

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
    # Xavfsizlik: wildcard "*" + credentials birga ishlatilmaydi (footgun).
    # Auth Bearer token orqali (cookie emas), shuning uchun wildcard bo'lsa
    # credentials'ni o'chiramiz.
    _has_wildcard = "*" in settings.cors_origins_list
    if _has_wildcard and settings.is_production:
        log.warning("cors_wildcard_in_production", origins=settings.cors_origins_list)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=not _has_wildcard,
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
