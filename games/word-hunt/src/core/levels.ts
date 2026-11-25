/** Seviye eğrisi ve puan kuralları — hepsi tek yerde. */

export const MAX_LEVEL = 60;
/** Her dünya 10 bölüm; 10'un katları patron bölümüdür. */
export const LEVELS_PER_WORLD = 10;
export const WORLD_COUNT = 6;

export interface LevelDef {
  level: number;
  target: number;
  seconds: number;
  minLength: number;
  plantCount: number;
  /** Ekilecek kelimelerin uzunluk aralığı. */
  plantMin: number;
  plantMax: number;
  /** Patron bölümü: daha yüksek hedef, ek süre. */
  boss: boolean;
  /** Görev: bu uzunlukta (veya daha uzun) bir kelime bul → süre + puan ödülü. */
  questLen: number;
  /** Dünya sırası 0..5 */
  world: number;
}

export function worldOf(level: number): number {
  return Math.min(WORLD_COUNT - 1, Math.floor((Math.max(1, level) - 1) / LEVELS_PER_WORLD));
}

export function isBoss(level: number): boolean {
  return level > 0 && level % LEVELS_PER_WORLD === 0;
}

/** Görev ödülü. */
export const QUEST_SECONDS = 5;
export function questScore(level: number): number {
  return 150 + level * 20;
}

/** Bölüm başına ipucu hakkı. */
export const HINTS_PER_LEVEL = 3;

export function levelDef(level: number): LevelDef {
  const lv = Math.max(1, Math.min(MAX_LEVEL, Math.floor(level)));
  const boss = isBoss(lv);
  const minLength = lv <= 4 ? 3 : lv <= 12 ? 4 : 5;
  const plantMax = lv < 5 ? 5 : lv < 15 ? 6 : lv < 30 ? 7 : 8;
  return {
    level: lv,
    target: 400 + (lv - 1) * 180 + (boss ? 90 : 0),
    seconds: Math.max(60, 100 - Math.floor((lv - 1) * 0.8)) + (boss ? 15 : 0),
    minLength,
    plantCount: Math.min(16, 7 + Math.floor(lv / 3)),
    plantMin: minLength,
    plantMax,
    boss,
    questLen: Math.min(9, minLength + 2 + (boss ? 1 : 0) + Math.floor(lv / 25)),
    world: worldOf(lv),
  };
}

/** Kombo bu süre (ms) içinde yeni kelime bulunmazsa sıfırlanır. */
export const COMBO_WINDOW_MS = 7000;
/** Bonus petekten geçen kelime başına kazanılan süre (sn). */
export const BONUS_SECONDS = 2;
/** Süre en fazla bölüm süresinin bu kadar üstüne çıkabilir (sn). */
export const MAX_EXTRA_SECONDS = 30;

/** Tahtadaki bonus petek sayısı. */
export function bonusCount(level: number): number {
  return Math.min(6, 3 + Math.floor(level / 12));
}

/** Kelime uzunluğuna göre övgü seviyesi: 0 iyi, 1 güzel, 2 harika, 3 efsane, 4 muhteşem (9+). */
export function tierFor(length: number): 0 | 1 | 2 | 3 | 4 {
  return length >= 9 ? 4 : length >= 7 ? 3 : length >= 6 ? 2 : length >= 5 ? 1 : 0;
}

/** Uzun kelime ve bonus petek süre kazandırır. */
export function timeBonusFor(length: number, bonusCells: number): number {
  return (length >= 5 ? 1 : 0) + (length >= 7 ? 1 : 0) + (length >= 9 ? 2 : 0) + bonusCells * BONUS_SECONDS;
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
