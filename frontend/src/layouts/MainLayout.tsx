import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { LoadingScreen } from '@shared/components/LoadingScreen';

/**
 * Asosiy layout — barcha sahifalar uchun Suspense wrapper.
 * Telegram Mini App'da header/footer yo'q, faqat content.
 */
export default function MainLayout() {
  return (
    <div className="min-h-screen bg-tg-bg text-tg-text">
      <Suspense fallback={<LoadingScreen />}>
        <Outlet />
      </Suspense>
    </div>
  );
}
