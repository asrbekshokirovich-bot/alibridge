/**
 * useScanner hook — barkod skanerlash.
 *
 * Telegram QR scanner ishlatadi (kamera ochiladi).
 * html5-qrcode fallback (Telegram'da ishlamasa).
 */

import { useCallback, useRef, useState } from 'react';
import { scanQr, haptic } from '@shared/utils/telegram';

interface UseScannerOptions {
  onScan: (data: string) => void | Promise<void>;
  onError?: (error: Error) => void;
  prompt?: string;
}

export function useScanner({ onScan, onError, prompt }: UseScannerOptions) {
  const [isScanning, setIsScanning] = useState(false);
  const scannerRef = useRef<HTMLDivElement>(null);

  const stopScan = useCallback(() => {
    setIsScanning(false);
    window.Telegram?.WebApp?.closeScanQrPopup?.();
  }, []);

  const startScan = useCallback(async () => {
    setIsScanning(true);
    try {
      const data = await scanQr(prompt);
      haptic('success');
      await onScan(data);
    } catch (error) {
      haptic('error');
      onError?.(error as Error);
    } finally {
      setIsScanning(false);
    }
  }, [onScan, onError, prompt]);

  return { startScan, stopScan, isScanning, scannerRef };
}
