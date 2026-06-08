"""Rate limiting (spam/DoS himoyasi) — markaziy limiter.

Reverse-proxy (Render) ortida ishlaydi, shuning uchun X-Forwarded-For
sarlavhasidagi birinchi IP bo'yicha cheklaydi.
"""

from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address


def client_key(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return get_remote_address(request)


# Global default: 120 so'rov/daqiqa har IP uchun. Alohida endpointlarda qattiqroq.
limiter = Limiter(key_func=client_key, default_limits=["120/minute"])
