"""Cloudflare tunnel URL'ni avtomatik aniqlash (/cf_shared/tunnel.log).

Bepul trycloudflare.com tunnel uzilib qayta ulanганда URL o'zgaradi.
Backend startup'da log'dan eng oxirgi URL'ni o'qib, bot menu button + WebApp
tugmasini avtomatik yangilaydi.
"""

import logging
import re
from pathlib import Path

logger = logging.getLogger("alibridge.tunnel")

TUNNEL_LOG = Path("/cf_shared/tunnel.log")
_URL_RE = re.compile(r"https://[a-z0-9-]+\.trycloudflare\.com")
# api.trycloudflare.com — bu cloudflared API endpointi, haqiqiy tunnel URL emas
_IGNORE = "api.trycloudflare.com"


def read_tunnel_url() -> str | None:
    """tunnel.log dan eng oxirgi haqiqiy trycloudflare URL'ni qaytaradi (yoki None)."""
    if not TUNNEL_LOG.exists():
        return None
    try:
        text = TUNNEL_LOG.read_text(encoding="utf-8", errors="ignore")
    except OSError as e:
        logger.warning("tunnel.log o'qib bo'lmadi: %s", e)
        return None
    matches = [m for m in _URL_RE.findall(text) if _IGNORE not in m]
    return matches[-1] if matches else None
