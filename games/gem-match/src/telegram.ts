/**
 * TELEGRAM MINI APP KATMANI
 * ------------------------------------------------------------------
 * Oyun Telegram içinde açıldığında:
 *   - tam ekrana yayılır (expand)
 *   - dikey kaydırma kapanır (oyun tahtası kaymasın)
 *   - geri tuşu oyun içinde menüye döner
 *   - eşleşmelerde dokunsal geri bildirim (haptic) verilir
 *
 * Telegram dışında (tarayıcıda) açılırsa hepsi sessizce devre dışı kalır.
 */

type TgUser = {
  id?: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
};
type WebApp = any;

let backHandler: (() => void) | null = null;

export function tgApp(): WebApp | null {
  return (globalThis as any).Telegram?.WebApp ?? null;
}

export function isTelegram(): boolean {
  const w = tgApp();
  return !!w && !!w.initData;
}

export interface TgInfo {
  inTelegram: boolean;
  userName: string | null;
  /** Telegram kullanıcı dili (tr, en, tr-TR...) — dil seçimi için ipucu. */
  language: string | null;
}

export function initTelegram(): TgInfo {
  const w = tgApp();
  if (!w) return { inTelegram: false, userName: null, language: null };

  try {
    w.ready();
    w.expand();
    if (typeof w.disableVerticalSwipes === 'function') w.disableVerticalSwipes();
    if (typeof w.setHeaderColor === 'function') w.setHeaderColor('#05070f');
    if (typeof w.setBackgroundColor === 'function') w.setBackgroundColor('#05070f');
  } catch {
    /* eski Bot API sürümleri */
  }

  const u: TgUser | undefined = w.initDataUnsafe?.user;
  const userName = u
    ? [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || u.username || null
    : null;

  return {
    inTelegram: true,
    userName,
    language: u?.language_code ?? null,
  };
}

/** Geri tuşunu sahneye bağlar. null → gizle. */
export function setBackButton(handler: (() => void) | null): void {
  const w = tgApp();
  if (!w?.BackButton) return;
  try {
    if (backHandler) w.BackButton.offClick(backHandler);
    backHandler = handler;
    if (handler) {
      w.BackButton.onClick(handler);
      w.BackButton.show();
    } else {
      w.BackButton.hide();
    }
  } catch {
    /* yut */
  }
}

export type HapticKind = 'light' | 'medium' | 'heavy' | 'success' | 'error' | 'warning';

export function haptic(kind: HapticKind = 'light'): void {
  const h = tgApp()?.HapticFeedback;
  if (!h) return;
  try {
    if (kind === 'success' || kind === 'error' || kind === 'warning') h.notificationOccurred(kind);
    else h.impactOccurred(kind);
  } catch {
    /* yut */
  }
}

export function closeApp(): void {
  const w = tgApp();
  try {
    w?.close?.();
  } catch {
    /* yut */
  }
}
