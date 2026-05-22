"""Rate limiter — SlowAPI + Redis.

Alohida modulda saqlanadi, circular import oldini olish uchun.
main.py da ro'yxatga olinadi, endpointlarda decorator sifatida ishlatiladi.
"""

from __future__ import annotations

from slowapi import Limiter
from slowapi.util import get_remote_address

# X-Real-IP headerini ham tekshiradi (nginx orqali kelganda)
def _get_real_ip(request: object) -> str:  # type: ignore[return]
    """nginx tomonidan o'tkazilgan real IP ni olish."""
    from fastapi import Request
    if isinstance(request, Request):
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip
    return get_remote_address(request)  # type: ignore[arg-type]


limiter = Limiter(key_func=_get_real_ip)
