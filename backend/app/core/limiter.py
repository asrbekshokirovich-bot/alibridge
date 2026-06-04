"""Rate limiter — SlowAPI + Redis.

Alohida modulda saqlanadi, circular import oldini olish uchun.
main.py da ro'yxatga olinadi, endpointlarda decorator sifatida ishlatiladi.

Xavfsizlik eslatmasi:
  X-Forwarded-For headerini faqat TRUSTED_PROXIES dan kelsa ishonish kerak.
  Aks holda attacker har so'rovda boshqa IP yuborib rate limitni chetlab o'tadi.
"""

from __future__ import annotations

import ipaddress

from slowapi import Limiter
from slowapi.util import get_remote_address

# Docker ichki tarmoq + loopback — faqat shu manzillardan kelgan
# X-Forwarded-For / X-Real-IP headerlari ishonchli deb qabul qilinadi.
_TRUSTED_PROXY_NETS = [
    ipaddress.ip_network("127.0.0.0/8"),    # loopback
    ipaddress.ip_network("10.0.0.0/8"),     # Docker default bridge
    ipaddress.ip_network("172.16.0.0/12"),  # Docker compose networks
    ipaddress.ip_network("192.168.0.0/16"), # local LAN
]


def _is_trusted_proxy(addr: str) -> bool:
    try:
        ip = ipaddress.ip_address(addr)
        return any(ip in net for net in _TRUSTED_PROXY_NETS)
    except ValueError:
        return False


def _get_real_ip(request: object) -> str:  # type: ignore[return]
    """Faqat ishonchli proxy'dan kelgan X-Forwarded-For / X-Real-IP'ga ishonish."""
    from fastapi import Request
    if isinstance(request, Request):
        # Ulanish manzilini aniqlash
        connecting_ip = request.client.host if request.client else None

        if connecting_ip and _is_trusted_proxy(connecting_ip):
            # Faqat ishonchli proxy orqali kelgan so'rovlarda headerlarga ishoniladi
            forwarded_for = request.headers.get("X-Forwarded-For")
            if forwarded_for:
                # Birinchi (haqiqiy client) IP — oxirgi ishonchli proxy qo'shadi
                client_ip = forwarded_for.split(",")[0].strip()
                if client_ip:
                    return client_ip
            real_ip = request.headers.get("X-Real-IP")
            if real_ip:
                return real_ip

        # Ishonchsiz yoki to'g'ridan ulanishda — real socket IP
        if connecting_ip:
            return connecting_ip

    return get_remote_address(request)  # type: ignore[arg-type]


limiter = Limiter(key_func=_get_real_ip)
