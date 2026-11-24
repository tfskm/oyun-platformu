/** Seviye eğrisi ve puan kuralları — hepsi tek yerde. */

export const MAX_LEVEL = 30;

export interface LevelDef {
  level: number;
  target: number;
  seconds: number;
  minLength: number;
  plantCount: number;
}

export function levelDef(level: number): LevelDef {
  const lv = Math.max(1, Math.min(MAX_LEVEL, Math.floor(level)));
  return {
    level: lv,
    target: 400 + (lv - 1) * 180,
    seconds: Math.max(55, 100 - (lv - 1) * 2),
    minLength: lv <= 4 ? 3 : lv <= 12 ? 4 : 5,
    plantCount: Math.min(16, 7 + Math.floor(lv / 2)),
  };
}

export function scoreWord(length: number, combo: number, level: number): number {
  const base = length * length * 10;
  const bonus = 1 + Math.min(5, Math.max(0, combo - 1)) * 0.25;
  return Math.round(base * bonus * (1 + (level - 1) * 0.05));
}

export function starsFor(score: number, target: number): number {
  if (score >= target * 2) return 3;
  if (score >= target * 1.4) return 2;
  if (score >= target) return 1;
  return 0;
}

export function xpFor(level: number, score: number, stars: number): number {
  return Math.max(0, Math.min(150, 6 + level * 2 + stars * 7 + Math.floor(score / 700) * 3));
}
