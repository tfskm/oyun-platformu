/** Kelime sözlüğü: dil seçimine göre TR/EN setleri. */

import { WORDS_TR } from '../data/words.tr.js';
import { WORDS_EN } from '../data/words.en.js';

export type WordLang = 'tr' | 'en';

const SETS: Record<WordLang, Set<string>> = {
  tr: new Set(WORDS_TR),
  en: new Set(WORDS_EN),
};

const SHORT: Record<WordLang, string[]> = {
  tr: WORDS_TR.filter((w) => w.length >= 3 && w.length <= 6) as string[],
  en: WORDS_EN.filter((w) => w.length >= 3 && w.length <= 6) as string[],
};

export function normalize(word: string, lang: WordLang): string {
  return word.toLocaleLowerCase(lang === 'tr' ? 'tr-TR' : 'en-US');
}

export function isWord(word: string, lang: WordLang): boolean {
  if (!word || word.length < 3) return false;
  return SETS[lang].has(normalize(word, lang));
}

export function wordCount(lang: WordLang): number {
  return SETS[lang].size;
}

/** Tahtaya gömmek için kısa kelimeler (3-6 harf). */
export function plantWords(lang: WordLang): readonly string[] {
  return SHORT[lang];
}

/** Ekranda gösterim için dil+eşik uygun büyük harf. */
export function display(word: string, lang: WordLang): string {
  return word.toLocaleUpperCase(lang === 'tr' ? 'tr-TR' : 'en-US');
}
