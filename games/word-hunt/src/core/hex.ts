/**
 * Bal peteği (flat-top hex) ızgara matematiği — saf fonksiyonlar, Phaser yok.
 * "odd-q" düzeni: tek sütunlar yarım hücre aşağı kaydırılır.
 */

export const COLS = 7;
export const ROWS = 8;
export const HEX_SIZE = 56;

export function index(col: number, row: number): number {
  return row * COLS + col;
}

export function colOf(i: number): number {
  return i % COLS;
}

export function rowOf(i: number): number {
  return Math.floor(i / COLS);
}

export function inBounds(col: number, row: number, rows: number = ROWS): boolean {
  return col >= 0 && col < COLS && row >= 0 && row < rows;
}

/**
 * Komşu hücreler (6 yön): sağ, sol, çaprazlar.
 * Çift/tek sütun kaydırması nedeniyle iki ayrı tablo gerekir.
 */
const EVEN: ReadonlyArray<readonly [number, number]> = [
  [1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0], [0, 1],
];
const ODD: ReadonlyArray<readonly [number, number]> = [
  [1, 1], [1, 0], [0, -1], [-1, 0], [-1, 1], [0, 1],
];

export function neighbors(i: number, rows: number = ROWS): number[] {
  const col = colOf(i);
  const row = rowOf(i);
  const dirs = col % 2 === 0 ? EVEN : ODD;
  const out: number[] = [];
  for (const [dc, dr] of dirs) {
    const c = col + dc;
    const r = row + dr;
    if (inBounds(c, r, rows)) out.push(index(c, r));
  }
  return out;
}

export function isAdjacent(a: number, b: number, rows: number = ROWS): boolean {
  return neighbors(a, rows).includes(b);
}

/** Izgaranın sol üst köşesine göre piksel merkezi. */
export function hexPos(i: number): { x: number; y: number } {
  const col = colOf(i);
  const row = rowOf(i);
  const s = HEX_SIZE;
  return {
    x: s + s * 1.5 * col,
    y: s + Math.sqrt(3) * s * (row + 0.5 * (col & 1)),
  };
}

export function boardSize(rows: number = ROWS): { w: number; h: number } {
  return {
    w: HEX_SIZE * 1.5 * (COLS - 1) + HEX_SIZE * 2,
    h: Math.sqrt(3) * HEX_SIZE * (rows + 0.5) + HEX_SIZE,
  };
}
