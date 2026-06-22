from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Barcha sozlamalar .env dan o'qiladi. Ortiqcha kalitlar e'tiborsiz qoldiriladi."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # Application
    app_name: str = "ali-bridge"
    app_env: str = "development"
    app_debug: bool = False
    app_timezone: str = "Asia/Tashkent"

    # Telegram Bot
    bot_token: str
    bot_username: str = "alibridgebot"
    bot_webhook_url: str = ""
    bot_webhook_secret: str = ""
    bot_force_polling: bool = True

    # Mini App
    miniapp_url: str = ""
    miniapp_base_path: str = "/"

    # Backend API
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    api_prefix: str = "/api/v1"
    cors_origins: str = ""

    # JWT
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60

    # Database
    database_url: str
    db_use_ssl: bool = False
    # Ulanish puli (connection pool) — NullPool O'RNIGA.
    # Pul ulanishlarni qayta ishlatadi: har so'rovda yangi TCP+TLS+auth ochilmaydi.
    # Supabase pooler ulanish limitiga sig'ish uchun kichik qiymatlar (maks = size+overflow).
    db_pool_size: int = 5
    db_max_overflow: int = 5
    db_pool_recycle: int = 1800  # bo'sh ulanishni 30 daqiqada yangilash (pooler uzishi mumkin)

    # Public base URL (PDF yorliq linklari uchun) — bo'sh bo'lsa miniapp_url
    public_base_url: str = ""

    # Storage (S3-mos: Supabase Storage / MinIO / Wasabi)
    s3_endpoint: str = ""
    s3_region: str = "us-east-1"
    s3_bucket: str = ""
    s3_access_key: str = ""
    s3_secret_key: str = ""
    s3_use_ssl: bool = True
    s3_public_url: str = ""

    @property
    def s3_enabled(self) -> bool:
        return bool(self.s3_endpoint and self.s3_access_key and self.s3_secret_key)

    @property
    def cors_origin_list(self) -> list[str]:
        if not self.cors_origins:
            return []
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def sync_database_url(self) -> str:
        """Alembic uchun sinxron URL (asyncpg -> psycopg2 emas, biz async engine ishlatamiz)."""
        return self.database_url

    @property
    def label_base_url(self) -> str:
        """PDF yorliq linki uchun tashqi URL."""
        return (self.public_base_url or self.miniapp_url or "").rstrip("/")


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
