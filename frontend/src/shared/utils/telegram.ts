/**
 * Telegram Mini App SDK helpers.
 *
 * Wraps the global window.Telegram.WebApp object for type-safe usage.
 */

export interface TelegramUser {
  id: number;
  is_bot?: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  photo_url?: string;
}

export interface TelegramWebApp {
  initData: string;
  initDataUnsafe: {
    query_id?: string;
    user?: TelegramUser;
    auth_date: number;
    hash: string;
    start_param?: string;
  };
  version: string;
  platform: string;
  colorScheme: 'light' | 'dark';
  themeParams: Record<string, string>;
  isExpanded: boolean;
  viewportHeight: number;
  viewportStableHeight: number;
  ready: () => void;
  expand: () => void;
  close: () => void;
  enableClosingConfirmation: () => void;
  disableClosingConfirmation: () => void;
  showAlert: (message: string, callback?: () => void) => void;
  showConfirm: (message: string, callback: (confirmed: boolean) => void) => void;
  showPopup: (params: PopupParams, callback?: (id: string) => void) => void;
  showScanQrPopup: (
    params: { text?: string },
    callback?: (data: string) => boolean,
  ) => void;
  closeScanQrPopup: () => void;
  HapticFeedback: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
    selectionChanged: () => void;
  };
  MainButton: {
    text: string;
    color: string;
    textColor: string;
    isVisible: boolean;
    isActive: boolean;
    isProgressVisible: boolean;
    setText: (text: string) => void;
    onClick: (callback: () => void) => void;
    offClick: (callback: () => void) => void;
    show: () => void;
    hide: () => void;
    enable: () => void;
    disable: () => void;
    showProgress: (leaveActive?: boolean) => void;
    hideProgress: () => void;
  };
  BackButton: {
    isVisible: boolean;
    onClick: (callback: () => void) => void;
    offClick: (callback: () => void) => void;
    show: () => void;
    hide: () => void;
  };
  sendData: (data: string) => void;
  openLink: (url: string, options?: { try_instant_view?: boolean }) => void;
  openTelegramLink: (url: string) => void;
}

interface PopupParams {
  title?: string;
  message: string;
  buttons?: Array<{
    id?: string;
    type?: 'default' | 'ok' | 'close' | 'cancel' | 'destructive';
    text?: string;
  }>;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp: TelegramWebApp;
    };
  }
}

/**
 * Get the Telegram WebApp instance.
 * Throws if running outside Telegram.
 */
export function getTelegramApp(): TelegramWebApp {
  const tg = window.Telegram?.WebApp;
  if (!tg) {
    throw new Error('Telegram WebApp is not available. Running outside Telegram?');
  }
  return tg;
}

/**
 * Safe getter — returns null if not in Telegram (for dev / testing).
 */
export function getTelegramAppOrNull(): TelegramWebApp | null {
  return window.Telegram?.WebApp ?? null;
}

/**
 * Initialize the Telegram Mini App.
 * Call once on app mount.
 */
export function initTelegramApp(): void {
  const tg = getTelegramAppOrNull();
  if (!tg) {
    console.warn('Telegram WebApp not detected — running in dev mode');
    return;
  }

  tg.ready();
  tg.expand();
  tg.enableClosingConfirmation();
}

/**
 * Get the current Telegram user (or null if unavailable).
 */
export function getTelegramUser(): TelegramUser | null {
  return getTelegramAppOrNull()?.initDataUnsafe?.user ?? null;
}

/**
 * Get raw initData string for server-side validation.
 */
export function getInitData(): string {
  return getTelegramAppOrNull()?.initData ?? '';
}

/**
 * Trigger haptic feedback (for button presses, success, etc.).
 */
export function haptic(
  type: 'light' | 'medium' | 'heavy' | 'success' | 'error' | 'warning' = 'light',
): void {
  const tg = getTelegramAppOrNull();
  if (!tg) return;

  if (type === 'success' || type === 'error' || type === 'warning') {
    tg.HapticFeedback.notificationOccurred(type);
  } else {
    tg.HapticFeedback.impactOccurred(type);
  }
}

/**
 * Open native QR scanner.
 */
export function scanQr(
  prompt = 'Skanerlash uchun barkodga yo\'naltiring',
): Promise<string> {
  return new Promise((resolve, reject) => {
    const tg = getTelegramAppOrNull();
    if (!tg) {
      reject(new Error('Telegram WebApp not available'));
      return;
    }

    tg.showScanQrPopup({ text: prompt }, (data) => {
      tg.closeScanQrPopup();
      resolve(data);
      return true; // close the popup
    });
  });
}
