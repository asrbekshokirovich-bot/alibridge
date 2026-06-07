import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from slowapi.errors import RateLimitExceeded
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.responses import JSONResponse

from app.bot.runner import start_bot, stop_bot
from app.core.config import settings
from app.core.limiter import limiter


async def _rate_limit_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    return JSONResponse(
        status_code=429,
        content={"error": {"code": "RATE_LIMIT", "message": "Juda ko'p so'rov. Birozdan keyin urinib ko'ring."}},
    )
from app.core.errors import (
    AppError,
    app_error_handler,
    http_error_handler,
    unhandled_error_handler,
    validation_error_handler,
)

logging.basicConfig(
    level=getattr(logging, "DEBUG" if settings.app_debug else "INFO"),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("alibridge")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("ALI BRIDGE backend ishga tushmoqda (env=%s)", settings.app_env)
    if settings.bot_force_polling:
        await start_bot()
    yield
    if settings.bot_force_polling:
        await stop_bot()
    logger.info("ALI BRIDGE backend to'xtatilmoqda")


app = FastAPI(
    title="ALI BRIDGE API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url=None,
    lifespan=lifespan,
)

# Rate limiting (spam/DoS himoyasi) — global 120/min, alohida endpointlarda qattiqroq
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_handler)

# CORS — Telegram WebView va frontend uchun.
# Production'da CORS_ORIGINS to'ldirilishi shart; bo'sh bo'lsa faqat Telegram domenlari.
_cors_origins = settings.cors_origin_list or [
    "https://web.telegram.org",
    "https://t.me",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Xato handlerlar (kontrakt formati)
app.add_exception_handler(AppError, app_error_handler)
app.add_exception_handler(StarletteHTTPException, http_error_handler)
app.add_exception_handler(RequestValidationError, validation_error_handler)
app.add_exception_handler(Exception, unhandled_error_handler)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "app": settings.app_name, "env": settings.app_env}


from app.api.v1.router import api_router  # noqa: E402

app.include_router(api_router, prefix=settings.api_prefix)
