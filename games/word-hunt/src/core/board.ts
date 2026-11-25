/**
 * Bal peteği tahta üretimi ve kelime kontrolü — saf mantık, Phaser yok.
 * Tüm rastgelelik verilen Rng üzerinden; aynı seed = aynı tahta.
 */

import type { Rng } from '../../../shared/game-kit/src/rng.js';
import { COLS, ROWS, index, isAdjacent } from './hex.js';
import { isWord, normalize, plantWords, type WordLang } from './words.js';

export interface Cell {
  /** Küçük harf; ekranda dile göre büyük gösterilir. */
  letter: string;
}

export type Board = Cell[];

export interface GeneratedBoard {
  cells: Board;
  /** Tahtaya bilinçli gömülen kelimeler (ipucu/test için). */
  planted: string[];
}

const POOLS: Record<WordLang, string> = {
  tr: 'aaaaaaaeeeeeeeeiiiiiiiooooooouuuuüübcçdğghjklmnöprsşttvyz',
  en: 'aaaaaaaeeeeeeeeiiiiiiiooooooouuubccddffgghjklmnpqrrsstttvwwxyzz',
};

/** Verilen kelime komşu hücre zinciri olarak tahtada var mı? */
function wordExists(cells: Board, word: string, rows: number): boolean {
  const walk = (i: number, pos: number, used: Set<number>): boolean => {
    if (pos === word.length) return true;
    for (const n of neighborsOf(i, rows)) {
      if (used.has(n) || cells[n].letter !== word[pos]) continue;
      used.add(n);
      if (walk(n, pos + 1, used)) return true;
      used.delete(n);
    }
    return false;
  };
  for (let i = 0; i < cells.length; i++) {
    if (cells[i].letter !== word[0]) continue;
    if (walk(i, 1, new Set([i]))) return true;
  }
  return false;
}

/**
 * Bir kelimeyi rastgele komşu zincirine yerleştirir.
 * Daha önce ekilen kelimeler bozuluyorsa değişikliği geri alır.
 */
function placeWord(cells: Board, word: string, rng: Rng, rows: number, planted: string[]): boolean {
  for (let attempt = 0; attempt < 32; attempt++) {
    const start = rng.int(0, COLS * rows);
    const path = [start];
    const used = new Set(path);

    for (let step = 1; step < word.length; step++) {
      const options = neighborsOf(path[path.length - 1], rows).filter((i) => !used.has(i));
      if (!options.length) break;
      const next = options[rng.int(0, options.length)];
      path.push(next);
      used.add(next);
    }

    if (path.length !== word.length) continue;

    const originals = path.map((i) => cells[i].letter);
    for (let k = 0; k < word.length; k++) cells[path[k]].letter = word[k];
    if (planted.every((p) => wordExists(cells, p, rows))) return true;
    for (let k = 0; k < path.length; k++) cells[path[k]].letter = originals[k];
  }
  return false;
}

function neighborsOf(i: number, rows: number): number[] {
  const col = i % COLS;
  const row = Math.floor(i / COLS);
  const even = [
    [1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0], [0, 1],
  ];
  const odd = [
    [1, 1], [1, 0], [0, -1], [-1, 0], [-1, 1], [0, 1],
  ];
  const dirs = col % 2 === 0 ? even : odd;
  const out: number[] = [];
  for (const [dc, dr] of dirs) {
    const c = col + dc;
    const r = row + dr;
    if (c >= 0 && c < COLS && r >= 0 && r < rows) out.push(index(c, r));
  }
  return out;
}

export function generateBoard(
  rng: Rng,
  lang: WordLang,
  plantCount: number,
  rows: number = ROWS
): GeneratedBoard {
  const pool = POOLS[lang];
  const cells: Board = [];
  for (let i = 0; i < COLS * rows; i++) {
    cells.push({ letter: pool[rng.int(0, pool.length)] });
  }

  const candidates = plantWords(lang);
  const planted: string[] = [];
  const shuffled = rng.shuffle([...candidates]).slice(0, plantCount * 3);
  for (const word of shuffled) {
    if (planted.length >= plantCount) break;
    if (placeWord(cells, word, rng, rows, planted)) planted.push(word);
  }

  return { cells, planted };
}

/**
 * Bonus petek seçimi — verilen Rng ile deterministik.
 * `taken` içindeki hücreler seçilmez.
 */
export function pickBonusCells(
  rng: Rng,
  count: number,
  total: number = COLS * ROWS,
  taken: ReadonlySet<number> = new Set()
): number[] {
  const free: number[] = [];
  for (let i = 0; i < total; i++) if (!taken.has(i)) free.push(i);
  rng.shuffle(free);
  return free.slice(0, Math.max(0, Math.min(count, free.length)));
}

/** Kelimenin tahtadaki ilk komşu zincirini (hücre indeksleri) döndürür; yoksa null. */
export function findWordPath(cells: Board, word: string, rows: number = ROWS): number[] | null {
  const walk = (i: number, pos: number, path: number[]): number[] | null => {
    if (pos === word.length) return path;
    for (const n of neighborsOf(i, rows)) {
      if (path.includes(n) || cells[n].letter !== word[pos]) continue;
      const hit = walk(n, pos + 1, [...path, n]);
      if (hit) return hit;
    }
    return null;
  };
  for (let i = 0; i < cells.length; i++) {
    if (cells[i].letter !== word[0]) continue;
    const hit = walk(i, 1, [i]);
    if (hit) return hit;
  }
  return null;
}

/**
 * İpucu: henüz bulunmamış ekilmiş kelimelerden en kısasının yolunu verir.
 * Rastgelelik yok; aynı tahta + aynı bulunanlar = aynı ipucu (deterministik).
 */
export function findHint(
  cells: Board,
  planted: readonly string[],
  found: ReadonlySet<string>,
  rows: number = ROWS
): { word: string; path: number[] } | null {
  const left = planted.filter((w) => !found.has(w)).sort((a, b) => a.length - b.length);
  for (const word of left) {
    const path = findWordPath(cells, word, rows);
    if (path) return { word, path };
  }
  return null;
}

export function wordFromPath(cells: Board, path: readonly number[]): string {
  return path.map((i) => cells[i]?.letter ?? '').join('');
}

export type CheckReason = 'short' | 'invalid' | 'duplicate' | 'ok';

export interface CheckResult {
  ok: boolean;
  reason: CheckReason;
  word: string;
}

export function checkPath(
  cells: Board,
  path: readonly number[],
  lang: WordLang,
  minLength: number,
  found: ReadonlySet<string>
): CheckResult {
  const raw = wordFromPath(cells, path);
  const word = normalize(raw, lang);

  if (path.length < minLength) return { ok: false, reason: 'short', word };
  if (path.length < 2) return { ok: false, reason: 'short', word };
  for (let i = 1; i < path.length; i++) {
    if (!isAdjacent(path[i - 1], path[i])) return { ok: false, reason: 'invalid', word };
  }
  if (found.has(word)) return { ok: false, reason: 'duplicate', word };
  if (!isWord(word, lang)) return { ok: false, reason: 'invalid', word };
  return { ok: true, reason: 'ok', word };
}
