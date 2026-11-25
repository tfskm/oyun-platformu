/** Bölüm yıldızları — yerel depolama (profil sunucusundan bağımsız). */

import { readJson, writeJson } from '../../shared/game-kit/src/index.js';

type StarMap = Record<string, number>;

export function getStars(): StarMap {
  return readJson<StarMap>('wh_stars_v1', {});
}

export function starsOf(level: number): number {
  return getStars()[String(level)] ?? 0;
}

export function saveStars(level: number, stars: number): void {
  const m = getStars();
  if ((m[String(level)] ?? 0) >= stars) return;
  m[String(level)] = stars;
  writeJson('wh_stars_v1', m);
}

export function totalStars(): number {
  return Object.values(getStars()).reduce((a, b) => a + b, 0);
}
