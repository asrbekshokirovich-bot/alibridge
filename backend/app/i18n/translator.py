"""Simple translator — JSON file'lardan tarjimalar oladi."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any


LOCALES_DIR = Path(__file__).parent / "locales"


@lru_cache(maxsize=8)
def _load_locale(lang: str) -> dict[str, Any]:
    """Til faylini yuklash (kesh bilan)."""
    path = LOCALES_DIR / f"{lang}.json"
    if not path.exists():
        return {}
    with open(path, encoding="utf-8") as f:
        return json.load(f)


class Translator:
    """Tarjimon — dot-notation kalitlar bilan ishlaydi.

    Misol: t("common.welcome", name="Ali")
    Locale faylda: {"common": {"welcome": "Salom, {name}!"}}
    """

    def __init__(self, lang: str = "uz") -> None:
        self.lang = lang
        self._data = _load_locale(lang)
        self._fallback = _load_locale("uz") if lang != "uz" else {}

    def __call__(self, key: str, **kwargs: Any) -> str:
        """Tarjima qaytarish."""
        value = self._get_nested(self._data, key)
        if value is None and self._fallback:
            value = self._get_nested(self._fallback, key)
        if value is None:
            return key  # kalit topilmasa, kalitni qaytarish

        if isinstance(value, str) and kwargs:
            try:
                return value.format(**kwargs)
            except KeyError:
                return value
        return str(value)

    @staticmethod
    def _get_nested(data: dict[str, Any], key: str) -> Any:
        """Dot-notation bo'yicha qiymat olish."""
        parts = key.split(".")
        current: Any = data
        for part in parts:
            if isinstance(current, dict) and part in current:
                current = current[part]
            else:
                return None
        return current
