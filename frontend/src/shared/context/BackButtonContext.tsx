/**
 * BackButtonContext — Telegram BackButton uchun global handler boshqaruvi.
 *
 * Arxitektura:
 *   BackButtonManager  — route chuqurligiga qarab show/hide + navigate(-1) default
 *   useBackButton(fn)  — sahifalar o'z maxsus handlerini o'rnatadi (kontekst orqali)
 *
 * Sahifa mount bo'lsa → handler o'rnatiladi.
 * Sahifa unmount bo'lsa → handler null qilinadi (BackButtonManager default navigate(-1) ishlatadi).
 */

import {
  createContext,
  useContext,
  useRef,
  type MutableRefObject,
  type ReactNode,
} from 'react';

type BackHandler = (() => void) | null;

/** Ref'ni to'g'ridan-to'g'ri kontekstga ulash — qayta render qilmasdan yangilaydi. */
const BackButtonContext = createContext<MutableRefObject<BackHandler>>({
  current: null,
});

export function BackButtonProvider({ children }: { children: ReactNode }) {
  const handlerRef = useRef<BackHandler>(null);
  return (
    <BackButtonContext.Provider value={handlerRef}>
      {children}
    </BackButtonContext.Provider>
  );
}

/** Joriy back handler ref'ini qaytaradi. */
export function useBackHandlerRef(): MutableRefObject<BackHandler> {
  return useContext(BackButtonContext);
}
