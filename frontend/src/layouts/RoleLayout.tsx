import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { LoadingScreen } from '@shared/components/LoadingScreen';

/**
 * Rol-specific layout.
 * Kelajakda bottom navigation, breadcrumb qo'shish mumkin.
 */
export default function RoleLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-tg-bg text-tg-text">
      <main className="flex-1">
        <Suspense fallback={<LoadingScreen />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}
