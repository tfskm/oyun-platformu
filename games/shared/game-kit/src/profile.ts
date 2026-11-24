/**
 * Oyuncu profili (standalone mod).
 * ------------------------------------------------------------------
 * Oyun kendi başına yayınlandığında XP/seviye/rekor burada tutulur.
 * Taskonomix modunda bu katman sunucuya devredilir; oyun kodu değişmez.
 */

import { readJson, writeJson } from './storage.js';
import { t } from './i18n.js';
import type { GameId, GameResult } from './types.js';

export interface GameStats {
  plays: number;
  bestScore: number;
  bestLevel: number;
  totalScore: number;
  lastPlayedAt: number;
}

export interface Profile {
  version: 1;
  xp: number;
  games: Record<string, GameStats>;
  achievements: string[];
  updatedAt: number;
}

const PROFILE_KEY = 'profile_v1';

const EMPTY: Profile = { version: 1, xp: 0, games: {}, achievements: [], updatedAt: 0 };

/** Rütbe adları i18n sözlüğünde tutulur; burada sadece eşikler var. */
export const TITLES: ReadonlyArray<{ level: number; key: string }> = [
  { level: 30, key: 'rank.champion' },
  { level: 20, key: 'rank.legend' },
  { level: 10, key: 'rank.master' },
  { level: 5, key: 'rank.player' },
  { level: 1, key: 'rank.rookie' },
];

/** Seviye eğrisi: 1→2 = 250 XP, 2→3 = 500, 3→4 = 750 ... */
export function levelInfo(xp: number): {
  level: number;
  title: string;
  xpIntoLevel: number;
  xpForNext: number;
  progress: number;
} {
  let level = 1;
  let need = 250;
  let acc = 0;
  while (xp >= acc + need && level < 99) {
    acc += need;
    level += 1;
    need = 250 * level;
  }
  const into = Math.max(0, xp - acc);
  return {
    level,
    title: titleFor(level),
    xpIntoLevel: into,
    xpForNext: need,
    progress: Math.max(0, Math.min(1, into / need)),
  };
}

export function titleFor(level: number): string {
  return t(TITLES.find((item) => level >= item.level)?.key ?? 'rank.rookie');
}

export function loadProfile(): Profile {
  const p = readJson<Profile>(PROFILE_KEY, { ...EMPTY });
  return {
    ...EMPTY,
    ...p,
    games: p.games && typeof p.games === 'object' ? p.games : {},
    achievements: Array.isArray(p.achievements) ? p.achievements : [],
  };
}

export function saveProfile(p: Profile): void {
  writeJson(PROFILE_KEY, { ...p, updatedAt: Date.now() });
}

export interface RecordOutcome {
  xpGained: number;
  totalXp: number;
  level: number;
  leveledUp: boolean;
  newBest: boolean;
  bestScore: number;
  unlocked: string[];
}

/** Bir oyun sonucunu profile işler; XP'yi ve rekoru günceller. */
export function recordPlay(gameId: GameId, result: GameResult): RecordOutcome {
  const p = loadProfile();
  const prev = p.games[gameId] ?? { plays: 0, bestScore: 0, bestLevel: 0, totalScore: 0, lastPlayedAt: 0 };
  const before = levelInfo(p.xp).level;

  const newBest = result.score > prev.bestScore;
  p.games[gameId] = {
    plays: prev.plays + 1,
    bestScore: Math.max(prev.bestScore, result.score),
    bestLevel: Math.max(prev.bestLevel, result.level ?? 0),
    totalScore: prev.totalScore + result.score,
    lastPlayedAt: Date.now(),
  };

  const xpGained = Math.max(0, Math.round(result.xp || 0));
  p.xp += xpGained;

  const unlocked: string[] = [];
  const unlock = (id: string) => {
    if (!p.achievements.includes(id)) {
      p.achievements.push(id);
      unlocked.push(id);
    }
  };
  unlock('first_play');
  if (p.games[gameId].bestScore >= 1000) unlock('score_1000');
  if (p.games[gameId].bestScore >= 5000) unlock('score_5000');
  if (p.games[gameId].bestLevel >= 5) unlock('level_5');
  if (p.games[gameId].plays >= 10) unlock('plays_10');

  saveProfile(p);
  const after = levelInfo(p.xp).level;

  return {
    xpGained,
    totalXp: p.xp,
    level: after,
    leveledUp: after > before,
    newBest,
    bestScore: p.games[gameId].bestScore,
    unlocked,
  };
}
