/**
 * Oyuncuyu geri getiren katman: günlük seri, günlük meydan okuma, rozetler.
 * Saf fonksiyonlar + güvenli yerel depolama. Phaser yok, Math.random yok.
 */

import { readJson, writeJson } from '../../../shared/game-kit/src/storage.js';

export const DAILY_BONUS_XP = 40;

export interface MetaStats {
  plays: number;
  wins: number;
  totalWords: number;
  longestWord: number;
  bestCombo: number;
  fevers: number;
  treasures: number;
  jokerWords: number;
}

export type MissionId = 'words' | 'combo' | 'long';

export interface MissionState {
  day: string;
  words: number;
  combo: number;
  long: number;
  done: string[];
  /** Kazanılmış ama henüz oyun sonunda ödenmemiş XP. */
  pendingXp: number;
}

export const MISSIONS: ReadonlyArray<{ id: MissionId; goal: number; xp: number }> = [
  { id: 'words', goal: 15, xp: 15 },
  { id: 'combo', goal: 4, xp: 15 },
  { id: 'long', goal: 2, xp: 25 },
];

export function emptyMissions(day = ''): MissionState {
  return { day, words: 0, combo: 0, long: 0, done: [], pendingXp: 0 };
}

export interface Meta {
  version: 1;
  /** Son oynanan gün (YYYY-MM-DD, yerel saat). */
  lastDay: string;
  streak: number;
  bestStreak: number;
  /** Günlük meydan okumanın tamamlandığı son gün. */
  dailyDay: string;
  dailyScore: number;
  stats: MetaStats;
  unlocked: string[];
  missions: MissionState;
}

const META_KEY = 'wh_meta_v1';

const EMPTY_STATS: MetaStats = {
  plays: 0,
  wins: 0,
  totalWords: 0,
  longestWord: 0,
  bestCombo: 0,
  fevers: 0,
  treasures: 0,
  jokerWords: 0,
};

export function emptyMeta(): Meta {
  return {
    version: 1,
    lastDay: '',
    streak: 0,
    bestStreak: 0,
    dailyDay: '',
    dailyScore: 0,
    stats: { ...EMPTY_STATS },
    unlocked: [],
    missions: emptyMissions(),
  };
}

export function loadMeta(): Meta {
  const raw = readJson<Partial<Meta>>(META_KEY, {});
  const base = emptyMeta();
  return {
    ...base,
    ...raw,
    stats: { ...base.stats, ...(raw.stats ?? {}) },
    unlocked: Array.isArray(raw.unlocked) ? raw.unlocked : [],
    missions: {
      ...base.missions,
      ...(raw.missions ?? {}),
      done: Array.isArray(raw.missions?.done) ? raw.missions!.done : [],
    },
  };
}

export function saveMeta(m: Meta): void {
  writeJson(META_KEY, m);
}

// ---------- Günler ----------

export function dayKey(ms: number): string {
  const d = new Date(ms);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function dayNumber(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return Math.floor(Date.UTC(y, (m || 1) - 1, d || 1) / 86400000);
}

/** b − a gün olarak. */
export function dayDiff(a: string, b: string): number {
  return dayNumber(b) - dayNumber(a);
}

/** Bugün hâlâ geçerli olan seri: bugün veya dün oynandıysa sürer, yoksa 0. */
export function activeStreak(meta: Meta, today: string): number {
  if (!meta.lastDay) return 0;
  const diff = dayDiff(meta.lastDay, today);
  return diff === 0 || diff === 1 ? meta.streak : 0;
}

/**
 * Bugünü oynandı olarak işler. Yeni günse seri artar (aradaki boşluk
 * 1 günden büyükse 1'den başlar). Meta'yı yerinde günceller.
 */
export function touchDay(meta: Meta, today: string): { isNewDay: boolean; streak: number } {
  if (meta.lastDay === today) return { isNewDay: false, streak: meta.streak };
  const diff = meta.lastDay ? dayDiff(meta.lastDay, today) : Infinity;
  meta.streak = diff === 1 ? meta.streak + 1 : 1;
  meta.bestStreak = Math.max(meta.bestStreak, meta.streak);
  meta.lastDay = today;
  return { isNewDay: true, streak: meta.streak };
}

/** Günün ilk oyununda verilen seri bonusu (XP). */
export function streakBonusXp(streak: number): number {
  return Math.min(30, 5 + Math.max(1, streak) * 3);
}

export function dailyDone(meta: Meta, today: string): boolean {
  return meta.dailyDay === today;
}

/** Tarihten uint32 tohum (FNV-1a): herkes aynı gün aynı tahtayı oynar. */
export function dailySeed(day: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < day.length; i++) {
    h ^= day.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Günlük meydan okuma bölümü: haftanın gününe göre 4-10 arası. */
export function dailyLevel(day: string): number {
  return 4 + (((dayNumber(day) % 7) + 7) % 7);
}

// ---------- Rozetler ----------

export interface Achievement {
  id: string;
  check: (m: Meta) => boolean;
}

export const ACHIEVEMENTS: readonly Achievement[] = [
  { id: 'first_word', check: (m) => m.stats.totalWords >= 1 },
  { id: 'words100', check: (m) => m.stats.totalWords >= 100 },
  { id: 'long7', check: (m) => m.stats.longestWord >= 7 },
  { id: 'combo5', check: (m) => m.stats.bestCombo >= 5 },
  { id: 'fever1', check: (m) => m.stats.fevers >= 1 },
  { id: 'treasure1', check: (m) => m.stats.treasures >= 1 },
  { id: 'joker1', check: (m) => m.stats.jokerWords >= 1 },
  { id: 'wins5', check: (m) => m.stats.wins >= 5 },
  { id: 'streak3', check: (m) => m.bestStreak >= 3 },
  { id: 'daily1', check: (m) => m.dailyDay !== '' },
];

/** Henüz açılmamış ama şartı sağlanmış rozetler (meta'yı değiştirmez). */
export function newAchievements(meta: Meta): string[] {
  return ACHIEVEMENTS.filter((a) => !meta.unlocked.includes(a.id) && a.check(meta)).map((a) => a.id);
}

// ---------- Günlük görevler ----------

/** Bugünün görev durumu; gün değiştiyse sayaçlar sıfırlanır (bekleyen XP korunur). */
export function missionsFor(meta: Meta, today: string): MissionState {
  if (meta.missions.day !== today) {
    meta.missions = { ...emptyMissions(today), pendingXp: meta.missions.pendingXp };
  }
  return meta.missions;
}

/** İlerlemeyi işler; bu çağrıda yeni tamamlanan görev kimliklerini döndürür. */
export function addMissionProgress(
  meta: Meta,
  today: string,
  p: { words?: number; combo?: number; long?: number }
): MissionId[] {
  const m = missionsFor(meta, today);
  m.words += p.words ?? 0;
  m.long += p.long ?? 0;
  m.combo = Math.max(m.combo, p.combo ?? 0);
  const completed: MissionId[] = [];
  for (const d of MISSIONS) {
    if (!m.done.includes(d.id) && m[d.id] >= d.goal) {
      m.done.push(d.id);
      m.pendingXp += d.xp;
      completed.push(d.id);
    }
  }
  return completed;
}

/** Bekleyen görev XP'sini alır ve sıfırlar. */
export function takePendingXp(meta: Meta): number {
  const x = meta.missions.pendingXp;
  meta.missions.pendingXp = 0;
  return x;
}
