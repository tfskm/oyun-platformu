
/** Seviye eğrisi ve puan kuralları */

export const MAX_LEVEL = 30;

export interface LevelDef {
  level: number;
  target: number;
  seconds: number;
  minLength: number;
  plantCount: number;
}

export const HINTS_PER_LEVEL = 3;

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

export const COMBO_WINDOW_MS = 7000;
export const BONUS_SECONDS = 2;
export const MAX_EXTRA_SECONDS = 40;

export const FEVER_MS = 8000;
export const GOLDEN_MS = 8000;
export const FRENZY_MS = 9000; // Sürpriz 2X / 3X fırtınası süresi

export function feverGain(length: number, bonusCells: number): number {
  return length * 8 + bonusCells * 10;
}

/** Çarpan: ateş +1, altın an +1, sürpriz fırtına (frenzy) +1 veya +2, hazine kelimesi +2 */
export function multiplierFor(fever: boolean, golden: boolean, frenzyMult: number, treasure: boolean): number {
  const fz = Math.max(0, frenzyMult - 1);
  return 1 + (fever ? 1 : 0) + (golden ? 1 : 0) + fz + (treasure ? 2 : 0);
}

export interface LengthReward {
  points: number;
  hints: number;
  freezeMs: number;
  fever: number;
  rainbowMs: number; // Peteklerin renk değiştirme süresi
}

export function lengthReward(length: number): LengthReward {
  if (length >= 8) return { points: 800, hints: 2, freezeMs: 6000, fever: 60, rainbowMs: 7000 };
  if (length === 7) return { points: 400, hints: 1, freezeMs: 4000, fever: 40, rainbowMs: 5000 };
  if (length === 6) return { points: 180, hints: 1, freezeMs: 2000, fever: 25, rainbowMs: 3500 };
  if (length === 5) return { points: 60, hints: 0, freezeMs: 0, fever: 15, rainbowMs: 0 };
  return { points: 0, hints: 0, freezeMs: 0, fever: 0, rainbowMs: 0 };
}

export function comboMilestone(combo: number): { seconds: number; points: number } | null {
  switch (combo) {
    case 3:
      return { seconds: 2, points: 60 };
    case 5:
      return { seconds: 3, points: 200 };
    case 8:
      return { seconds: 4, points: 500 };
    case 12:
      return { seconds: 6, points: 1200 };
    default:
      return null;
  }
}

export function chestValues(stars: number): number[] {
  const k = 1 + (Math.max(1, Math.min(3, stars)) - 1) * 0.25;
  return [15, 35, 75].map((v) => Math.round(v * k));
}

export function jokerCount(level: number): number {
  return level < 3 ? 0 : level < 15 ? 1 : 2;
}

export function bonusCount(level: number): number {
  return Math.min(5, 3 + Math.floor(level / 10));
}

/** Harflerde özel puan rozetleri: Tahtada 2-3 hücrede ekstra harf çarpanı veya ekstra puan */
export function letterSpecialCount(level: number): number {
  return Math.min(4, 2 + Math.floor(level / 8));
}

export function tierFor(length: number): 0 | 1 | 2 | 3 {
  return length >= 7 ? 3 : length >= 6 ? 2 : length >= 5 ? 1 : 0;
}

export function timeBonusFor(length: number, bonusCells: number): number {
  return (length >= 5 ? 1 : 0) + (length >= 7 ? 2 : 0) + bonusCells * BONUS_SECONDS;
}

export function scoreWord(
  length: number,
  combo: number,
  level: number,
  bonusCells = 0,
  letterBonusPoints = 0
): number {
  const base = length * length * 10 + letterBonusPoints;
  const bonus = 1 + Math.min(5, Math.max(0, combo - 1)) * 0.25;
  const cells = 1 + Math.max(0, bonusCells) * 0.5;
  return Math.round(base * bonus * cells * (1 + (level - 1) * 0.05));
}

export function starsFor(score: number, target: number): number {
  if (score >= target * 2) return 3;
  if (score >= target * 1.4) return 2;
  if (score >= target) return 1;
  return 0;
}

export function xpFor(level: number, score: number, stars: number): number {
  return Math.max(0, Math.min(180, 8 + level * 2 + stars * 8 + Math.floor(score / 600) * 4));
}
