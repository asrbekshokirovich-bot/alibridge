"""arq Worker konfiguratsiyasi.

Background ishlar:
- landing_ping_escalator (1h/6h/24h/72h)
- basket_ttl_releaser (har daqiqada)
- fx_refresher (har 4 soatda)
- dispute_reminder
"""

from __future__ import annotations

from arq import cron
from arq.connections import RedisSettings

from app.core.config import settings
from app.workers.basket_ttl import release_expired_baskets
from app.workers.fx_refresher import refresh_fx_rates
from app.workers.landing_ping import escalate_landing_pings
from app.workers.dispute_reminder import remind_stale_disputes


class WorkerSettings:
    """arq Worker konfiguratsiyasi."""

    redis_settings = RedisSettings.from_dsn(settings.cache_url)

    # Funksiyalar
    functions = [
        release_expired_baskets,
        escalate_landing_pings,
        refresh_fx_rates,
        remind_stale_disputes,
    ]

    # Cron jobs (har daqiqada / soatda)
    cron_jobs = [
        # Har daqiqada — basket TTL tekshiruvi
        cron(release_expired_baskets, minute=set(range(0, 60))),
        # Har daqiqada — landing ping eskalatsiya
        cron(escalate_landing_pings, minute=set(range(0, 60))),
        # Har 4 soatda — FX kurslari
        cron(refresh_fx_rates, hour={0, 4, 8, 12, 16, 20}, minute=0),
        # Har soatda — dispute eslatma
        cron(remind_stale_disputes, minute=0),
    ]

    # Performance
    max_jobs = settings.worker_concurrency
    job_timeout = 300  # 5 daqiqa
