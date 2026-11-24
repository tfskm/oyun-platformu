/**
 * Deterministik rastgele sayı üreteci (mulberry32).
 *
 * NEDEN ÖNEMLİ: Sunucu bir "seed" verir, oyun bu seed ile AYNI tahtayı üretir.
 * İleride hile denetimi için sunucuda replay yapılabilir. Seed'i sonradan
 * eklemek oyunu yeniden yazmak demektir — bu yüzden ilk günden var.
 */

export type Rng = {
  next(): number;
  int(minInclusive: number, maxExclusive: number): number;
  pick<T>(arr: readonly T[]): T;
  shuffle<T>(arr: T[]): T[];
};

export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (min: number, max: number) => min + Math.floor(next() * Math.max(1, max - min));
  const pick = <T,>(arr: readonly T[]): T => arr[int(0, arr.length)];
  const shuffle = <T,>(arr: T[]): T[] => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = int(0, i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };
  return { next, int, pick, shuffle };
}

export function randomSeed(): number {
  try {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] >>> 0;
  } catch {
    return (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
  }
}
