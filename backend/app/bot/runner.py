import asyncio
import logging

from aiogram.types import BotCommand, MenuButtonCommands

from app.bot.handlers import router as handlers_router
from app.bot.instance import get_bot, get_dispatcher
from app.bot.tunnel import read_tunnel_url
from app.core.config import settings

logger = logging.getLogger("alibridge.bot")

_polling_task: asyncio.Task | None = None
_watchdog_task: asyncio.Task | None = None

# Tunnel URL o'zgarishini har shuncha soniyada tekshiramiz
TUNNEL_CHECK_INTERVAL = 30


async def _sync_miniapp_url(bot, *, force: bool = False) -> None:
    """Tunnel URL'ni log'dan o'qib settings.miniapp_url'ga yozadi.

    Bepul tunnel uzilib qayta ulansa URL o'zgaradi. Watchdog buni avtomatik
    aniqlaydi va yangi URL'ni saqlaydi (/start tugmasi shu URL'ni ishlatadi).

    Eslatma: Mini App'ga faqat /start orqali kiriladi (telefon+ism olingach).
    Shu sababli bot menu button (WebApp) O'RNATILMAYDI — uning o'rniga /start
    buyrug'i ko'rsatiladi. force parametri moslik uchun qoldirilgan.
    """
    detected = read_tunnel_url()
    if detected and detected != settings.miniapp_url:
        logger.info("Tunnel URL yangilandi: %s -> %s", settings.miniapp_url, detected)
        settings.miniapp_url = detected


async def _tunnel_watchdog(bot) -> None:
    """Tunnel URL o'zgarishini doimiy kuzatadi.

    cloudflared o'zi qayta ulanadi (restart: unless-stopped) va yangi URL
    beradi; watchdog uni aniqlab bot menu button'ni avtomatik yangilaydi.
    """
    while True:
        try:
            await asyncio.sleep(TUNNEL_CHECK_INTERVAL)
            await _sync_miniapp_url(bot)
        except asyncio.CancelledError:
            break
        except Exception as e:  # noqa: BLE001
            logger.warning("Tunnel watchdog xatosi: %s", e)


def _setup_dispatcher() -> None:
    dp = get_dispatcher()
    # Routerlar faqat bir marta ulanadi
    if not getattr(dp, "_alibridge_ready", False):
        dp.include_router(handlers_router)
        dp._alibridge_ready = True  # type: ignore[attr-defined]


async def start_bot() -> None:
    """Botni polling rejimida fon vazifasi sifatida ishga tushiradi."""
    global _polling_task, _watchdog_task

    bot = get_bot()
    dp = get_dispatcher()
    _setup_dispatcher()

    try:
        me = await bot.get_me()
        logger.info("Bot ulandi: @%s (id=%s)", me.username, me.id)
    except Exception as e:  # noqa: BLE001
        logger.error("Bot tokenini tekshirishda xato: %s", e)
        return

    # Webhook bo'lsa o'chiramiz (polling uchun)
    await bot.delete_webhook(drop_pending_updates=True)

    # Tunnel URL'ni avtomatik aniqlash (settings.miniapp_url — /start tugmasi uchun)
    await _sync_miniapp_url(bot, force=True)

    # Mini App'ga faqat /start orqali kiriladi — menu tugmasi /start buyrug'ini
    # ko'rsatadi (WebApp emas). Avvalgi WebApp menu bo'lsa ham bekor qilinadi.
    try:
        await bot.set_my_commands(
            [BotCommand(command="start", description="Boshlash / Ilovani ochish")]
        )
        await bot.set_chat_menu_button(menu_button=MenuButtonCommands())
        logger.info("Bot menu: /start buyrug'i o'rnatildi (WebApp menu olib tashlandi)")
    except Exception as e:  # noqa: BLE001
        logger.warning("Bot menu o'rnatishda xato: %s", e)

    # Botni birinchi ochganda (START bosishdan oldin) ko'rinadigan tanishtiruv matni
    try:
        await bot.set_my_description(
            "Xush kelibsiz ALI BRIDGE Cargo botiga! 🚚\n\n"
            "Xitoy va Turkiyadan yuk yetkazish tizimi. "
            "Boshlash uchun pastdagi START tugmasini bosing."
        )
        await bot.set_my_short_description("ALI BRIDGE — Xitoy/Turkiya yuk yetkazish tizimi")
        logger.info("Bot tanishtiruv matni (description) o'rnatildi")
    except Exception as e:  # noqa: BLE001
        logger.warning("Bot description o'rnatishda xato: %s", e)

    # Tunnel watchdog faqat local'da (cloudflared tunnel.log mavjud bo'lsa).
    # Render'da tunnel yo'q — MINIAPP_URL env'dan keladi, watchdog kerak emas.
    if read_tunnel_url() is not None:
        _watchdog_task = asyncio.create_task(_tunnel_watchdog(bot))
        logger.info("Tunnel watchdog ishga tushdi (local rejim)")
    else:
        logger.info("Tunnel topilmadi — watchdog o'chirilgan (server rejim, MINIAPP_URL env'dan)")

    async def _run() -> None:
        try:
            logger.info("Bot polling boshlandi")
            await dp.start_polling(bot, handle_signals=False)
        except asyncio.CancelledError:
            logger.info("Bot polling to'xtatildi")
        except Exception as e:  # noqa: BLE001
            logger.exception("Bot polling xatosi: %s", e)

    _polling_task = asyncio.create_task(_run())


async def stop_bot() -> None:
    global _polling_task, _watchdog_task
    dp = get_dispatcher()
    bot = get_bot()
    try:
        await dp.stop_polling()
    except Exception:  # noqa: BLE001
        pass
    for task_ref in (_polling_task, _watchdog_task):
        if task_ref:
            task_ref.cancel()
            try:
                await task_ref
            except (asyncio.CancelledError, Exception):  # noqa: BLE001
                pass
    _polling_task = None
    _watchdog_task = None
    await bot.session.close()
