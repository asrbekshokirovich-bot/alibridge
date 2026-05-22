/**
 * useTelegram hook — Telegram WebApp bilan ishlash.
 */

import { useEffect, useMemo } from 'react';
import { getTelegramAppOrNull, haptic } from '@shared/utils/telegram';
import { useBackHandlerRef } from '@shared/context/BackButtonContext';

export function useTelegram() {
  return useMemo(() => getTelegramAppOrNull(), []);
}

export function useTelegramUser() {
  const tg = useTelegram();
  return tg?.initDataUnsafe?.user ?? null;
}

/**
 * MainButton — pastdagi katta tugma.
 */
export function useMainButton(text: string, onClick: () => void, visible = true) {
  useEffect(() => {
    const tg = getTelegramAppOrNull();
    if (!tg) return;

    const button = tg.MainButton;
    button.setText(text);

    if (visible) {
      button.show();
    } else {
      button.hide();
    }

    button.onClick(onClick);

    return () => {
      button.offClick(onClick);
      button.hide();
    };
  }, [text, onClick, visible]);
}

/**
 * BackButton — tepa-chap burchakdagi qaytish tugmasi.
 *
 * Ko'rsatish/yashirish BackButtonManager tomonidan avtomatik boshqariladi.
 * Bu hook faqat maxsus handlerni o'rnatadi (unmount bo'lsa — tozalaydi).
 */
export function useBackButton(onClick: () => void) {
  const handlerRef = useBackHandlerRef();

  useEffect(() => {
    handlerRef.current = onClick;
    return () => {
      handlerRef.current = null;
    };
  }, [onClick, handlerRef]);
}

export { haptic };
