"""Telegram bot integratsiyasi (aiogram)."""

from app.infra.telegram.bot import bot, dp
from app.infra.telegram.auth import validate_init_data, parse_init_data

__all__ = ["bot", "dp", "validate_init_data", "parse_init_data"]
