/**
 * BackButtonManager — Telegram BackButton ni global boshqarish.
 *
 * Qoidalar:
 *   • Sahifa chuqurligi > 1  (/carrier/catalog, /admin/users, ...)  → ko'rinadi
 *   • Sahifa chuqurligi ≤ 1  (/, /carrier, /admin, ...)             → yashirin
 *   • Bosilganda: sahifaning maxsus handleri → aks holda navigate(-1)
 *
 * BrowserRouter ichida bo'lishi shart (useLocation uchun).
 */

import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getTelegramAppOrNull } from '@shared/utils/telegram';
import { useBackHandlerRef } from '@shared/context/BackButtonContext';

function isSubPage(pathname: string): boolean {
  return pathname.split('/').filter(Boolean).length > 1;
}

/** /carrier/catalog → /carrier, /admin/users/edit → /admin/users */
function parentPath(pathname: string): string {
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length <= 1) return '/';
  return '/' + parts.slice(0, -1).join('/');
}

export function BackButtonManager() {
  const location = useLocation();
  const navigate = useNavigate();
  const handlerRef = useBackHandlerRef();

  useEffect(() => {
    const tg = getTelegramAppOrNull();
    if (!tg) return;

    const show = isSubPage(location.pathname);
    // pathname ni capture qilamiz — handleClick'da fresh qiymat bo'lsin
    const currentPath = location.pathname;

    const handleClick = () => {
      if (handlerRef.current) {
        // Sahifa o'z maxsus handlerini o'rnatgan
        handlerRef.current();
      } else {
        // Default: ota-sahifaga o'tish (navigate(-1) emas — Telegram WebView'da xavfsiz)
        navigate(parentPath(currentPath), { replace: false });
      }
    };

    if (show) {
      tg.BackButton.show();
      tg.BackButton.onClick(handleClick);
    } else {
      tg.BackButton.hide();
    }

    return () => {
      tg.BackButton.offClick(handleClick);
    };
  }, [location.pathname, navigate, handlerRef]);

  return null;
}
