/**
 * GEM MATCH — saf oyun mantığı.
 * ------------------------------------------------------------------
 * Bu dosyada Phaser YOK. Tahta, eşleşme, yer çekimi ve hamle kontrolü
 * tamamen saf fonksiyonlar. Neden?
 *   - Test edilebilir (tarayıcı olmadan node ile doğrulanabilir)
 *   - Deterministik: aynı seed + aynı hamleler = aynı sonuç
 *   - İleride sunucuda replay doğrulaması yapılabilir
 */

import type { Rng } from '../../../shared/game-kit/src/rng.js';

export const COLS = 8;
export const ROWS = 8;
export const CELL_COUNT = COLS * ROWS;

export type Special = 'row' | 'col' | 'bomb' | 'rainbow' | null;

export interface Cell {
  color: number;
  special: Special;
}

export type Grid = Array<Cell | null>;

export const idx = (r: number, c: number): number => r * COLS + c;
export const rowOf = (i: number): number => Math.floor(i / COLS);
export const colOf = (i: number): number => i % COLS;

export function cloneGrid(grid: Grid): Grid {
  return grid.map((c) => (c ? { ...c } : null));
}

/** Aynı satır/sütunda komşu mu? */
export function isAdjacent(a: number, b: number): boolean {
  const dr = Math.abs(rowOf(a) - rowOf(b));
  const dc = Math.abs(colOf(a) - colOf(b));
  return dr + dc === 1;
}

export function swapCells(grid: Grid, a: number, b: number): void {
  const tmp = grid[a];
  grid[a] = grid[b];
  grid[b] = tmp;
}

export interface Run {
  dir: 'h' | 'v';
  cells: number[];
}

export interface MatchGroup {
  cells: number[];
  /** Bu gruptan doğacak özel taş tipi. */
  special: Special;
  /** Özel taşın doğacağı hücre. */
  anchor: number;
}

/** Yatay ve dikey 3+ zincirleri bulur. */
export function findRuns(grid: Grid): Run[] {
  const runs: Run[] = [];

  for (let r = 0; r < ROWS; r++) {
    let start = 0;
    for (let c = 1; c <= COLS; c++) {
      const prev = grid[idx(r, c - 1)];
      const cur = c < COLS ? grid[idx(r, c)] : null;
      const same = !!prev && !!cur && prev.color === cur.color;
      if (!same) {
        if (c - start >= 3) {
          const cells: number[] = [];
          for (let k = start; k < c; k++) cells.push(idx(r, k));
          runs.push({ dir: 'h', cells });
        }
        start = c;
      }
    }
  }

  for (let c = 0; c < COLS; c++) {
    let start = 0;
    for (let r = 1; r <= ROWS; r++) {
      const prev = grid[idx(r - 1, c)];
      const cur = r < ROWS ? grid[idx(r, c)] : null;
      const same = !!prev && !!cur && prev.color === cur.color;
      if (!same) {
        if (r - start >= 3) {
          const cells: number[] = [];
          for (let k = start; k < r; k++) cells.push(idx(k, c));
          runs.push({ dir: 'v', cells });
        }
        start = r;
      }
    }
  }

  return runs;
}

/**
 * Zincirleri birleştirip (L / T şekilleri) her grup için özel taş kararı verir.
 * `preferred` verilirse özel taş o hücrede doğar (oyuncunun oynadığı taş).
 */
export function findMatches(grid: Grid, preferred: number[] = []): MatchGroup[] {
  const runs = findRuns(grid);
  if (!runs.length) return [];

  type Bucket = { cells: Set<number>; runs: Run[] };
  const buckets: Bucket[] = [];

  for (const run of runs) {
    let target = buckets.find((b) => run.cells.some((c) => b.cells.has(c)));
    if (!target) {
      target = { cells: new Set<number>(), runs: [] };
      buckets.push(target);
    }
    for (const c of run.cells) target.cells.add(c);
    target.runs.push(run);

    // Bu zincir iki grubu birleştirdiyse (L/T) hepsini tek gruba indir.
    for (const other of buckets) {
      if (other === target || other.cells.size === 0) continue;
      let overlaps = false;
      for (const c of other.cells) {
        if (target.cells.has(c)) { overlaps = true; break; }
      }
      if (overlaps) {
        for (const c of other.cells) target.cells.add(c);
        target.runs.push(...other.runs);
        other.cells.clear();
        other.runs.length = 0;
      }
    }
  }

  const groups: MatchGroup[] = [];
  for (const b of buckets) {
    if (b.cells.size < 3) continue;
    const maxH = Math.max(0, ...b.runs.filter((r) => r.dir === 'h').map((r) => r.cells.length));
    const maxV = Math.max(0, ...b.runs.filter((r) => r.dir === 'v').map((r) => r.cells.length));
    const hasH = maxH >= 3;
    const hasV = maxV >= 3;

    let special: Special = null;
    if (maxH >= 5 || maxV >= 5) special = 'rainbow';
    else if (hasH && hasV) special = 'bomb';
    else if (maxH === 4) special = 'row';
    else if (maxV === 4) special = 'col';

    const cells = [...b.cells];
    const pref = cells.find((c) => preferred.includes(c));
    let anchor = pref;
    if (anchor === undefined) {
      const longest = [...b.runs].sort((x, y) => y.cells.length - x.cells.length)[0];
      anchor = longest ? longest.cells[Math.floor(longest.cells.length / 2)] : cells[0];
    }

    groups.push({ cells, special, anchor });
  }

  return groups;
}

/**
 * Özel taşları tetikler: patlama alanını genişletir (zincirleme dahil).
 * `swapColor`: gökkuşağı taşının sildiği renk.
 */
export function expandSpecials(
  grid: Grid,
  initial: Iterable<number>,
  swapColor?: number
): Set<number> {
  const out = new Set<number>(initial);
  const queue: number[] = [...out];
  const fired = new Set<number>();

  while (queue.length) {
    const i = queue.shift()!;
    const cell = grid[i];
    if (!cell || !cell.special || fired.has(i)) continue;
    fired.add(i);

    const add = (j: number) => {
      if (j < 0 || j >= CELL_COUNT) return;
      if (!grid[j]) return;
      if (!out.has(j)) {
        out.add(j);
        queue.push(j);
      } else if (grid[j]?.special && !fired.has(j)) {
        queue.push(j);
      }
    };

    const r = rowOf(i);
    const c = colOf(i);
    switch (cell.special) {
      case 'row':
        for (let k = 0; k < COLS; k++) add(idx(r, k));
        break;
      case 'col':
        for (let k = 0; k < ROWS; k++) add(idx(k, c));
        break;
      case 'bomb':
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const rr = r + dr;
            const cc = c + dc;
            if (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS) add(idx(rr, cc));
          }
        }
        break;
      case 'rainbow': {
        const targetColor = swapColor ?? cell.color;
        for (let k = 0; k < CELL_COUNT; k++) {
          if (grid[k] && grid[k]!.color === targetColor) add(k);
        }
        break;
      }
    }
  }

  return out;
}

/** Tahtada en az bir geçerli hamle var mı? */
export function findAnyMove(grid: Grid): [number, number] | null {
  // Gökkuşağı taşı varsa her zaman hamle vardır.
  for (let i = 0; i < CELL_COUNT; i++) {
    if (grid[i]?.special === 'rainbow') return [i, i];
  }
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const a = idx(r, c);
      if (c + 1 < COLS) {
        const b = idx(r, c + 1);
        swapCells(grid, a, b);
        const ok = findMatches(grid).length > 0;
        swapCells(grid, a, b);
        if (ok) return [a, b];
      }
      if (r + 1 < ROWS) {
        const b = idx(r + 1, c);
        swapCells(grid, a, b);
        const ok = findMatches(grid).length > 0;
        swapCells(grid, a, b);
        if (ok) return [a, b];
      }
    }
  }
  return null;
}

/** Takas geçerli mi? (en az bir eşleşme üretiyor mu) */
export function swapCreatesMatch(grid: Grid, a: number, b: number): boolean {
  const ca = grid[a];
  const cb = grid[b];
  if (!ca || !cb) return false;
  // Gökkuşağı her zaman patlar.
  if (ca.special === 'rainbow' || cb.special === 'rainbow') return true;
  swapCells(grid, a, b);
  const ok = findMatches(grid).length > 0;
  swapCells(grid, a, b);
  return ok;
}

/** Başlangıç tahtası: hazır eşleşme yok, en az bir hamle var. */
export function createGrid(rng: Rng, colors: number): Grid {
  for (let attempt = 0; attempt < 60; attempt++) {
    const grid: Grid = new Array(CELL_COUNT).fill(null);
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const banned = new Set<number>();
        const left1 = c >= 1 ? grid[idx(r, c - 1)] : null;
        const left2 = c >= 2 ? grid[idx(r, c - 2)] : null;
        if (left1 && left2 && left1.color === left2.color) banned.add(left1.color);
        const up1 = r >= 1 ? grid[idx(r - 1, c)] : null;
        const up2 = r >= 2 ? grid[idx(r - 2, c)] : null;
        if (up1 && up2 && up1.color === up2.color) banned.add(up1.color);
        const pool: number[] = [];
        for (let k = 0; k < colors; k++) if (!banned.has(k)) pool.push(k);
        grid[idx(r, c)] = { color: rng.pick(pool), special: null };
      }
    }
    if (findAnyMove(grid)) return grid;
  }
  // Aşırı düşük olasılık; son çare rastgele doldur.
  return Array.from({ length: CELL_COUNT }, () => ({
    color: rng.int(0, colors),
    special: null as Special,
  }));
}

export interface GravityResult {
  /** Mevcut taşların nereden nereye düştüğü. */
  moves: Array<{ to: number; from: number }>;
  /** Yukarıdan yeni doğan taşlar. */
  spawned: number[];
}

/**
 * Boşlukları kapatır ve üstten yeni taş üretir.
 * Girdi olarak null hücreler bekler (patlayan taşlar sahnede null yapılır).
 */
export function collapseAndRefill(
  grid: Grid,
  rng: Rng,
  colors: number
): GravityResult {
  const moves: Array<{ to: number; from: number }> = [];
  const spawned: number[] = [];

  for (let c = 0; c < COLS; c++) {
    let write = ROWS - 1;
    for (let r = ROWS - 1; r >= 0; r--) {
      const i = idx(r, c);
      const cell = grid[i];
      if (!cell) continue;
      const to = idx(write, c);
      if (to !== i) {
        grid[to] = cell;
        grid[i] = null;
        moves.push({ to, from: i });
      }
      write -= 1;
    }
    for (let r = write; r >= 0; r--) {
      const i = idx(r, c);
      grid[i] = { color: rng.int(0, colors), special: null };
      spawned.push(i);
    }
  }

  return { moves, spawned };
}

/** Patlayan taşlar için hızlı skor: her taş 10, combo çarpanı. */
export function clearScore(count: number, combo: number): number {
  const multiplier = 1 + (combo - 1) * 0.5;
  return Math.round(count * 10 * multiplier);
}
