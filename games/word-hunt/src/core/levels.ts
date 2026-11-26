/** Seviye eğrisi ve puan kuralları — hepsi tek yerde. */

export const MAX_LEVEL = 30;

export interface LevelDef {
  level: number;
  target: number;
  seconds: number;
  minLength: number;
  plantCount: number;
}

/** Bölüm başına ipucu hakkı. */
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

/** Kombo bu süre (ms) içinde yeni kelime bulunmazsa sıfırlanır. */
export const COMBO_WINDOW_MS = 7000;
/** Bonus petekten geçen kelime başına kazanılan süre (sn). */
export const BONUS_SECONDS = 2;
/** Süre en fazla bölüm süresinin bu kadar üstüne çıkabilir (sn). */
export const MAX_EXTRA_SECONDS = 30;

/** Ateş modu süresi (ms) ve doluma gereken ölçek. */
export const FEVER_MS = 8000;
/** Altın an süresi (ms): bu sürede puan +1 çarpan alır. */
export const GOLDEN_MS = 8000;

/** Ateş sayacına kelimeden gelen doluluk (0-100). */
export function feverGain(length: number, bonusCells: number): number {
  return length * 8 + bonusCells * 10;
}

/** Çarpan: ateş +1, altın an +1, hazine kelimesi +2 (en fazla x4). */
export function multiplierFor(fever: boolean, golden: boolean, treasure: boolean): number {
  return 1 + (fever ? 1 : 0) + (golden ? 1 : 0) + (treasure ? 2 : 0);
}

/** Uzun kelime ödül tablosu: 5 harften itibaren kademeli artar. */
export interface LengthReward {
  /** Doğrudan eklenen puan (çarpandan bağımsız). */
  points: number;
  /** Kazanılan ipucu hakkı. */
  hints: number;
  /** Zamanı dondurma süresi (ms). */
  freezeMs: number;
  /** Ateş sayacına ek doluluk. */
  fever: number;
}

export function lengthReward(length: number): LengthReward {
  if (length >= 8) return { points: 700, hints: 1, freezeMs: 5000, fever: 50 };
  if (length === 7) return { points: 300, hints: 1, freezeMs: 3000, fever: 35 };
  if (length === 6) return { points: 120, hints: 0, freezeMs: 0, fever: 20 };
  if (length === 5) return { points: 40, hints: 0, freezeMs: 0, fever: 10 };
  return { points: 0, hints: 0, freezeMs: 0, fever: 0 };
}

/** Kombo kilometre taşları: tam bu kombo sayısına ulaşınca bir kez verilir. */
export function comboMilestone(combo: number): { seconds: number; points: number } | null {
  switch (combo) {
    case 3:
      return { seconds: 1, points: 50 };
    case 5:
      return { seconds: 2, points: 150 };
    case 8:
      return { seconds: 3, points: 400 };
    case 12:
      return { seconds: 5, points: 1000 };
    default:
      return null;
  }
}

/** Sandık ödülü (XP): yıldız sayısı kadar büyür. */
export function chestValues(stars: number): number[] {
  const k = 1 + (Math.max(1, Math.min(3, stars)) - 1) * 0.25;
  return [10, 25, 60].map((v) => Math.round(v * k));
}

/** Tahtadaki joker sayısı: 3. bölümden itibaren 1, 15'ten itibaren 2. */
export function jokerCount(level: number): number {
  return level < 3 ? 0 : level < 15 ? 1 : 2;
}

/** Tahtadaki bonus petek sayısı. */
export function bonusCount(level: number): number {
  return Math.min(5, 3 + Math.floor(level / 10));
}

/** Kelime uzunluğuna göre övgü seviyesi: 0 iyi, 1 güzel, 2 harika, 3 efsane. */
export function tierFor(length: number): 0 | 1 | 2 | 3 {
  return length >= 7 ? 3 : length >= 6 ? 2 : length >= 5 ? 1 : 0;
}

/** Uzun kelime ve bonus petek süre kazandırır. */
export function timeBonusFor(length: number, bonusCells: number): number {
  return (length >= 5 ? 1 : 0) + (length >= 7 ? 1 : 0) + bonusCells * BONUS_SECONDS;
}

export function scoreWord(length: number, combo: number, level: number, bonusCells = 0): number {
  const base = length * length * 10;
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
  return Math.max(0, Math.min(150, 6 + level * 2 + stars * 7 + Math.floor(score / 700) * 3));
}
