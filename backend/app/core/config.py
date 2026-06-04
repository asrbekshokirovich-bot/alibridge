"""Application configuration.

Loads settings from environment variables using Pydantic Settings.
"""

from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field, PostgresDsn, RedisDsn, computed_field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Production'da qabul qilinmaydigan zaif/standart sir qiymatlari
_WEAK_SECRET_MARKERS = ("change-me", "changeme", "your-", "example", "secret-2024")
_WEAK_DB_PASSWORDS = frozenset(
    {"changeme", "postgres", "password", "A1L2I3B4R5I6D7G8E9"}
)


class AppSettings(BaseSettings):
    """Main application settings."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ============================================
    # Application
    # ============================================
    app_name: str = "ali-bridge"
    app_env: Literal["development", "staging", "production"] = "development"
    app_debug: bool = False
    app_timezone: str = "Asia/Tashkent"

    # ============================================
    # Telegram Bot
    # ============================================
    bot_token: str
    bot_username: str
    bot_webhook_url: str | None = None
    bot_webhook_secret: str | None = None
    # webhook o'rniga polling ishlatish (beqaror tunnel uchun — bot updatelarni
    # o'zi tortib oladi, inbound tunnel kerak emas)
    bot_force_polling: bool = False

    miniapp_url: str
    miniapp_base_path: str = "/"

    # ============================================
    # API
    # ============================================
    api_host: str = "0.0.0.0"  # noqa: S104
    api_port: int = 8000
    api_prefix: str = "/api/v1"

    cors_origins: str = ""

    @computed_field  # type: ignore[misc]
    @property
    def cors_origins_list(self) -> list[str]:
        """Parse comma-separated CORS origins."""
        if not self.cors_origins:
            return []
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    # ============================================
    # JWT
    # ============================================
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60

    # ============================================
    # Database (PostgreSQL)
    # ============================================
    postgres_host: str = "postgres"
    postgres_port: int = 5432
    postgres_user: str
    postgres_password: str
    postgres_db: str
    database_url: PostgresDsn | None = None
    db_use_ssl: bool = False  # True for Supabase / external postgres

    @computed_field  # type: ignore[misc]
    @property
    def db_url(self) -> str:
        """Resolved database URL."""
        if self.database_url:
            return str(self.database_url)
        return (
            f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    # ============================================
    # Redis
    # ============================================
    redis_host: str = "redis"
    redis_port: int = 6379
    redis_password: str | None = None
    redis_db: int = 0
    redis_url: RedisDsn | None = None

    @computed_field  # type: ignore[misc]
    @property
    def cache_url(self) -> str:
        """Resolved Redis URL."""
        if self.redis_url:
            return str(self.redis_url)
        auth = f":{self.redis_password}@" if self.redis_password else ""
        return f"redis://{auth}{self.redis_host}:{self.redis_port}/{self.redis_db}"

    # ============================================
    # Storage (S3)
    # ============================================
    s3_endpoint: str = ""
    s3_region: str = "eu-central-1"
    s3_bucket: str = "alibridge-uploads"
    s3_access_key: str = ""
    s3_secret_key: str = ""
    s3_use_ssl: bool = True
    # Tashqi URL — brauzerdan fayllarni ko'rish uchun (bo'sh bo'lsa s3_endpoint ishlatiladi)
    s3_public_url: str = ""

    # ============================================
    # OCR
    # ============================================
    ocr_enabled: bool = True
    google_vision_credentials_path: str = ""

    # ============================================
    # SMS
    # ============================================
    sms_provider: Literal["eskiz", "twilio"] = "eskiz"
    eskiz_email: str = ""
    eskiz_password: str = ""
    eskiz_from: str = "4546"

    # ============================================
    # FX rates
    # ============================================
    fx_provider: Literal["cbu", "tcmb", "combined"] = "combined"
    fx_cache_ttl: int = 14400  # 4 hours
    fx_base_currency: str = "USD"

    # ============================================
    # Yandex
    # ============================================
    yandex_api_key: str = ""
    yandex_api_url: str = "https://b2b.taxi.yandex.net"
    yandex_enabled: bool = False

    # ============================================
    # Security
    # ============================================
    qr_hmac_secret: str
    encryption_key: str

    # ============================================
    # Logging
    # ============================================
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"
    log_format: Literal["json", "text"] = "json"
    log_file: str = "/app/logs/app.log"

    # ============================================
    # Monitoring (Sentry)
    # ============================================
    sentry_dsn: str = ""
    sentry_enabled: bool = False
    sentry_traces_sample_rate: float = 0.1

    # ============================================
    # Workers
    # ============================================
    worker_concurrency: int = 4
    landing_ping_interval: int = 60
    basket_ttl_minutes: int = 20
    payout_check_interval: int = 300
    # arq worker'ni backend process'i ichida ishga tushirish (alohida servis o'rniga).
    # Render Starter (bitta servis) uchun true. Alohida worker servisi bo'lsa false.
    run_worker_in_process: bool = False

    # ============================================
    # Feature flags
    # ============================================
    feature_airport_backside: bool = True
    feature_yandex_integration: bool = False
    feature_auto_flight_tracking: bool = False
    feature_face_match: bool = False

    @computed_field  # type: ignore[misc]
    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    @model_validator(mode="after")
    def _validate_production_secrets(self) -> "AppSettings":
        """Production'da zaif yoki standart sirlarni rad etish (xavfsizlik guard).

        Development'da o'tkazib yuboriladi — faqat APP_ENV=production da ishlaydi.
        """
        if self.app_env != "production":
            return self

        problems: list[str] = []

        def _check_secret(name: str, value: str, min_len: int = 32) -> None:
            low = (value or "").lower()
            if not value or len(value) < min_len:
                problems.append(f"{name}: kamida {min_len} belgi bo'lishi shart")
            elif any(m in low for m in _WEAK_SECRET_MARKERS):
                problems.append(f"{name}: standart/zaif qiymat — tasodifiy qiymatga almashtiring")

        _check_secret("JWT_SECRET", self.jwt_secret)
        _check_secret("QR_HMAC_SECRET", self.qr_hmac_secret)
        _check_secret("ENCRYPTION_KEY", self.encryption_key, min_len=32)

        # Webhook secret production'da majburiy (H2)
        if not self.bot_webhook_secret or len(self.bot_webhook_secret) < 16:
            problems.append("BOT_WEBHOOK_SECRET: production'da majburiy (kamida 16 belgi)")
        elif any(m in self.bot_webhook_secret.lower() for m in _WEAK_SECRET_MARKERS):
            problems.append("BOT_WEBHOOK_SECRET: standart/zaif qiymat")

        # DB paroli
        if self.postgres_password in _WEAK_DB_PASSWORDS or len(self.postgres_password) < 12:
            problems.append("POSTGRES_PASSWORD: zaif yoki standart — kuchli tasodifiy parol qo'ying")

        if problems:
            raise ValueError(
                "Production xavfsizlik tekshiruvi muvaffaqiyatsiz:\n  - "
                + "\n  - ".join(problems)
            )
        return self

    @computed_field  # type: ignore[misc]
    @property
    def is_development(self) -> bool:
        return self.app_env == "development"


@lru_cache
def get_settings() -> AppSettings:
    """Get cached application settings.

    Using lru_cache ensures settings are loaded once and reused.
    """
    return AppSettings()  # type: ignore[call-arg]


# Convenient global instance
settings = get_settings()
