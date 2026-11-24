/**
 * Güvenli yerel depolama yardımcıları.
 * localStorage erişilemezse (gizli mod, kısıtlı WebView) sessizce yutar.
 */

const NS = 'tq';

export function storageKey(key: string): string {
  return `${NS}_${key}`;
}

export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(storageKey(key));
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return (parsed ?? fallback) as T;
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(storageKey(key), JSON.stringify(value));
  } catch {
    /* kota dolu veya erişim yok — yut */
  }
}

export function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(storageKey(key)) === '1';
  } catch {
    return false;
  }
}

export function writeFlag(key: string, value: boolean): void {
  try {
    localStorage.setItem(storageKey(key), value ? '1' : '0');
  } catch {
    /* yut */
  }
}
