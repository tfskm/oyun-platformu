/**
 * ÇOK DİLLİLİK (TR / EN) — tüm oyunlar için ortak katman.
 * ------------------------------------------------------------------
 * KURAL: Ekrana yazılan hiçbir metin koda gömülmez.
 *   const STRINGS: Dict = { 'menu.play': ['OYNA', 'PLAY'] };
 *   registerStrings(STRINGS);
 *   t('menu.play')            → 'OYNA' | 'PLAY'
 *   t('menu.target', { n: 5 }) → '{n}' yer tutucusu doldurulur
 *
 * Dil seçimi sırası:
 *   1. Adres çubuğu: ?lang=tr / ?lang=en  (test için)
 *   2. Kullanıcının seçimi (localStorage: tq_lang_v1)
 *   3. Verilen ipucu (Telegram kullanıcı dili)
 *   4. Tarayıcı dili (navigator.language)
 *   5. Türkçe
 *
 * Sayı biçimi de dile bağlıdır: fmtInt(3225) → '3.225' | '3,225'.
 */

import { readJson, writeJson } from './storage.js';

export type Lang = 'tr' | 'en';

/** [Türkçe, İngilizce] */
export type Entry = readonly [tr: string, en: string];
export type Dict = Record<string, Entry>;

export const LANGS: ReadonlyArray<{ id: Lang; label: string }> = [
  { id: 'tr', label: 'TR' },
  { id: 'en', label: 'EN' },
];

const LANG_KEY = 'lang_v1';

/**
 * Tüm oyunlarda ortak olan metinler. Oyun kendi metinlerini
 * `registerStrings()` ile ekler; aynı anahtar varsa oyun kazanır.
 */
export const COMMON: Dict = {
  // Rütbeler (profile.ts kullanır)
  'rank.rookie': ['Acemi', 'Rookie'],
  'rank.player': ['Oyuncu', 'Player'],
  'rank.master': ['Usta', 'Master'],
  'rank.legend': ['Efsane', 'Legend'],
  'rank.champion': ['Taskonomix Şampiyonu', 'Taskonomix Champion'],

  // Genel arayüz
  'common.level': ['Seviye', 'Level'],
  'common.levelOf': ['Seviye {level}  •  {title}', 'Level {level}  •  {title}'],
  'common.score': ['Puan', 'Score'],
  'common.best': ['Rekor', 'Best'],
  'common.target': ['Hedef', 'Target'],
  'common.moves': ['Hamle', 'Moves'],
  'common.movesLeft': ['HAMLE {n}', 'MOVES {n}'],
  'common.menu': ['Menü', 'Menu'],
  'common.retry': ['Tekrar', 'Retry'],
  'common.next': ['Sonraki', 'Next'],
  'common.play': ['Oyna', 'Play'],
  'common.loading': ['Yükleniyor…', 'Loading…'],
  'common.soundOn': ['Ses açık', 'Sound on'],
  'common.soundOff': ['Ses kapalı', 'Sound off'],
  'common.welcome': ['Hoş geldin, {name}', 'Welcome, {name}'],
  'common.combo': ['KOMBO x{n}', 'COMBO x{n}'],
  'common.xpEarned': ['Kazanılan XP', 'XP earned'],
  'common.language': ['Dil', 'Language'],
  'common.languageSwitch': ['Dili değiştir', 'Change language'],
  'common.time': ['Süre', 'Time'],
  'common.found': ['Bulunan', 'Found'],
  'common.words': ['kelime', 'words'],
  'common.word': ['Kelime', 'Word'],
  'common.tooShort': ['Çok kısa', 'Too short'],
  'common.notAWord': ['Geçerli kelime değil', 'Not a valid word'],
  'common.alreadyFound': ['Bu kelimeyi zaten buldun', 'Already found'],
  'common.great': ['Harika!', 'Great!'],
};

const strings: Dict = { ...COMMON };
const listeners = new Set<(lang: Lang) => void>();
let current: Lang = 'tr';
let ready = false;

function isLang(value: unknown): value is Lang {
  return value === 'tr' || value === 'en';
}

/** Bir dil kodunu desteklediğimiz dile çevirir; bilinmeyen → İngilizce. */
export function normalizeLang(code?: string | null): Lang | null {
  const c = (code ?? '').trim().toLowerCase();
  if (!c) return null;
  return c.startsWith('tr') ? 'tr' : 'en';
}

function fromUrl(): Lang | null {
  try {
    return normalizeLang(new URLSearchParams(location.search).get('lang'));
  } catch {
    return null;
  }
}

function fromNavigator(): Lang | null {
  const nav = typeof navigator !== 'undefined' ? navigator.language : '';
  if (!nav) return null;
  return nav.toLowerCase().startsWith('tr') ? 'tr' : 'en';
}

function applyDocumentLang(): void {
  try {
    if (typeof document !== 'undefined') document.documentElement.lang = current;
  } catch {
    /* yut */
  }
}

/**
 * Uygulama açılışında bir kez çağır. `hint` genelde Telegram kullanıcı dilidir.
 * Dönen değer o anki dil.
 */
export function initLang(hint?: string | null): Lang {
  ready = true;
  const chosen = fromUrl() ?? readJson<Lang | null>(LANG_KEY, null);
  current = isLang(chosen) ? chosen : normalizeLang(hint) ?? fromNavigator() ?? 'tr';
  applyDocumentLang();
  return current;
}

export function getLang(): Lang {
  if (!ready) initLang();
  return current;
}

export function setLang(next: Lang): Lang {
  if (!isLang(next)) return getLang();
  ready = true;
  if (next === current) {
    applyDocumentLang();
    return next;
  }
  current = next;
  writeJson(LANG_KEY, next);
  applyDocumentLang();
  listeners.forEach((fn) => {
    try {
      fn(next);
    } catch {
      /* dinleyici hatası oyunu durdurmasın */
    }
  });
  return next;
}

export function toggleLang(): Lang {
  return setLang(getLang() === 'tr' ? 'en' : 'tr');
}

/** Dil değişince arayüzü yeniden çizmek için. Dönen fonksiyon kaydı siler. */
export function onLangChange(fn: (lang: Lang) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Oyuna özel metinleri kaydeder. */
export function registerStrings(dict: Dict): void {
  Object.assign(strings, dict);
}

export function hasString(key: string): boolean {
  return key in strings;
}

function interpolate(text: string, vars?: Record<string, string | number>): string {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match
  );
}

/** Dile göre metin. Anahtar yoksa anahtarın kendisi döner (geliştirmede göze batar). */
export function t(key: string, vars?: Record<string, string | number>): string {
  const entry = strings[key];
  const text = entry ? entry[getLang() === 'tr' ? 0 : 1] : key;
  return interpolate(text, vars);
}

/** Sayı biçimi için yerel ayar: 'tr-TR' | 'en-US'. */
export function locale(): string {
  return getLang() === 'tr' ? 'tr-TR' : 'en-US';
}

export function fmtInt(n: number): string {
  return Math.round(Number(n) || 0).toLocaleString(locale());
}

/** Metni dile uygun büyük harfe çevirir (Türkçe i/İ kuralı korunur). */
export function upper(text: string): string {
  return text.toLocaleUpperCase(locale());
}
