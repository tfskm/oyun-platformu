/**
 * Seviye eğrisi ve ödül kuralları.
 * NOT: Buradaki sayılar başlangıç değerleri. Gerçek kullanıcı verisiyle
 * dengelenecek. Hepsi tek yerde olduğu için ayar yapmak kolay.
 */

export interface LevelDef {
  level: number;
  moves: number;
  target: number;
  colors: number;
}

export const MAX_LEVEL = 40;

export function levelDef(level: number): LevelDef {
  const lv = Math.max(1, Math.min(MAX_LEVEL, Math.floor(level)));
  const moves = lv <= 3 ? 26 : lv <= 8 ? 24 : lv <= 15 ? 22 : 20;
  const target = Math.round(1500 + (lv - 1) * 350);
  const colors = lv <= 2 ? 5 : 6;
  return { level: lv, moves, target, colors };
}

export function starsFor(score: number, target: number): number {
  if (score >= target * 2) return 3;
  if (score >= target * 1.5) return 2;
  if (score >= target) return 1;
  return 0;
}

export function xpFor(level: number, score: number, stars: number): number {
  const base = 6 + level * 2 + stars * 7 + Math.floor(score / 1200) * 3;
  return Math.max(0, Math.min(150, base));
}
