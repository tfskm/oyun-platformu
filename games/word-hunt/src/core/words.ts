/** Kelime sözlüğü: dil seçimine göre TR/EN setleri + türetilmiş uzun kelimeler. */

import { WORDS_TR } from '../data/words.tr.js';
import { WORDS_EN } from '../data/words.en.js';

export type WordLang = 'tr' | 'en';

const BASE: Record<WordLang, Set<string>> = {
  tr: new Set(WORDS_TR),
  en: new Set(WORDS_EN),
};

const BACK = 'aıou';
const FRONT = 'eiöü';
const HARD = 'fstkçşhp';

function lastVowelBack(w: string): boolean {
  for (let i = w.length - 1; i >= 0; i--) {
    if (BACK.includes(w[i])) return true;
    if (FRONT.includes(w[i])) return false;
  }
  return true;
}

/** Türkçe: çoğul, -lık, -sız, -cı ve çoğul+iyelik ekleriyle uzun kelimeler türetir. */
function deriveTr(root: string, out: Set<string>): void {
  if (root.length < 4 || /m[ae]k$/.test(root) || /l[ae]r$/.test(root)) return;
  const back = lastVowelBack(root);
  const hard = HARD.includes(root[root.length - 1]);
  const lar = back ? 'lar' : 'ler';
  out.add(root + lar);
  out.add(root + lar + (back ? 'ı' : 'i'));
  out.add(root + (back ? (/[ou]/.test(lastV(root)) ? 'luk' : 'lık') : /[öü]/.test(lastV(root)) ? 'lük' : 'lik'));
  out.add(root + (back ? (/[ou]/.test(lastV(root)) ? 'suz' : 'sız') : /[öü]/.test(lastV(root)) ? 'süz' : 'siz'));
  const c = hard ? 'ç' : 'c';
  out.add(root + c + (back ? (/[ou]/.test(lastV(root)) ? 'u' : 'ı') : /[öü]/.test(lastV(root)) ? 'ü' : 'i'));
}

function lastV(w: string): string {
  for (let i = w.length - 1; i >= 0; i--) if ((BACK + FRONT).includes(w[i])) return w[i];
  return 'a';
}

function deriveEn(root: string, out: Set<string>): void {
  if (root.length < 3) return;
  if (/(s|x|z|ch|sh)$/.test(root)) out.add(root + 'es');
  else if (/[^aeiou]y$/.test(root)) out.add(root.slice(0, -1) + 'ies');
  else out.add(root + 's');
}

const EXTENDED: Partial<Record<WordLang, Set<string>>> = {};

/** İlk ihtiyaçta kurulur: temel sözlük + türetilmiş biçimler (yalnızca kabul için; ekilmez). */
function setFor(lang: WordLang): Set<string> {
  let s = EXTENDED[lang];
  if (s) return s;
  s = new Set(BASE[lang]);
  const derived = new Set<string>();
  for (const w of BASE[lang]) (lang === 'tr' ? deriveTr : deriveEn)(w, derived);
  for (const w of derived) s.add(w);
  EXTENDED[lang] = s;
  return s;
}

// Ekmek için yalnızca elle derlenmiş temel listeden, uzunluğa göre dizin.
const BY_LEN: Record<WordLang, Map<number, string[]>> = { tr: new Map(), en: new Map() };
for (const lang of ['tr', 'en'] as WordLang[]) {
  for (const w of BASE[lang]) {
    if (w.length < 3) continue;
    const arr = BY_LEN[lang].get(w.length) ?? [];
    arr.push(w);
    BY_LEN[lang].set(w.length, arr);
  }
}

export function normalize(word: string, lang: WordLang): string {
  return word.toLocaleLowerCase(lang === 'tr' ? 'tr-TR' : 'en-US');
}

export function isWord(word: string, lang: WordLang): boolean {
  if (!word || word.length < 3) return false;
  return setFor(lang).has(normalize(word, lang));
}

export function wordCount(lang: WordLang): number {
  return BASE[lang].size;
}

/** Tahtaya gömmek için kelimeler (varsayılan 3-6 harf; seviye ilerledikçe 8'e kadar). */
export function plantWords(lang: WordLang, minLen = 3, maxLen = 6): readonly string[] {
  const out: string[] = [];
  for (let n = Math.max(3, minLen); n <= maxLen; n++) out.push(...(BY_LEN[lang].get(n) ?? []));
  return out;
}

/** Ekranda gösterim için dil+eşik uygun büyük harf. */
export function display(word: string, lang: WordLang): string {
  return word.toLocaleUpperCase(lang === 'tr' ? 'tr-TR' : 'en-US');
}
