/**
 * GAME KIT — Ortak tipler
 * ------------------------------------------------------------------
 * Bu dosya TÜM oyunların (Gem Match, Space Runner, ...) ve ileride
 * Taskonomix entegrasyonunun konuştuğu tek sözleşmedir.
 *
 * Kural: Bir oyun Taskonomix'i TANIMAZ. Sadece GameBridge arayüzünü bilir.
 * Böylece oyun tek başına yayınlanabilir, Taskonomix'e sonradan bağlanır.
 */

export type GameId = 'gem-match' | 'space-runner' | (string & {});

/** Oyun oturumu: sunucu (veya standalone modda yerel) tarafından üretilir. */
export interface SessionInfo {
  sessionId: string;
  /** Taskonomix modunda imzalı bilet; standalone modda boş string. */
  ticket: string;
  /** Deterministik oyun için tohum. Aynı tohum = aynı tahta. */
  seed: number;
  /** Oyun başlangıç ayarları (ör. level, difficulty). */
  config: Record<string, unknown>;
}

/** Oyun bittiğinde gönderilen sonuç. */
export interface GameResult {
  score: number;
  durationMs: number;
  level?: number;
  /** Oyunun önerdiği XP. Taskonomix modunda sunucu bunu yeniden hesaplar. */
  xp: number;
  /** Oyun içi istatistikler (hamle sayısı, toplanan kristal, ...). */
  stats?: Record<string, number>;
  /** İleride replay doğrulaması için hamle/girdi özeti. */
  digest?: string;
  clientVersion?: string;
}

export interface FinishOutcome {
  accepted: boolean;
  xpGained: number;
  message?: string;
}

/**
 * Oyunun platformla tek temas noktası.
 * İki uygulaması var: StandaloneBridge (yerel) ve TaskonomixBridge (postMessage).
 */
export interface GameBridge {
  readonly mode: 'standalone' | 'taskonomix';
  readonly gameId: GameId;
  start(): Promise<SessionInfo>;
  finish(result: GameResult): Promise<FinishOutcome>;
  track(type: string, data?: Record<string, unknown>): void;
  exit(): void;
}

export const GAME_KIT_VERSION = '0.1.0';
