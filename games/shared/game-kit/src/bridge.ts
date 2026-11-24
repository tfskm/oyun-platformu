/**
 * KÖPRÜ — oyunun platformla tek temas noktası.
 * ------------------------------------------------------------------
 * İki mod:
 *   1) standalone  → her şey yerel. Oyun kendi alan adında tek başına çalışır.
 *   2) taskonomix  → iframe içinde, postMessage ile. Bilet + seed sunucudan gelir.
 *
 * GÜVENLİK: Telegram initData (ana kimlik bilgisi) iframe'e ASLA verilmez.
 * Oyuna sadece kısa ömürlü, tek kullanımlık bir bilet verilir.
 */

import { createRng, randomSeed } from './rng.js';
import { recordPlay } from './profile.js';
import type { FinishOutcome, GameBridge, GameId, GameResult, SessionInfo } from './types.js';

const CHILD_SOURCE = 'taskonomix-game';
const HOST_SOURCE = 'taskonomix-host';
const PROTOCOL_VERSION = 1;
const REPLY_TIMEOUT_MS = 12000;

interface Envelope {
  source: string;
  v: number;
  type: string;
  requestId?: string;
  gameId?: string;
  payload?: any;
}

function postToParent(msg: Envelope): void {
  try {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage(msg, '*');
    }
  } catch {
    /* yut */
  }
}

/** iframe içinde miyiz? */
export function isEmbedded(): boolean {
  try {
    if (window.parent === window) return false;
    const p = new URLSearchParams(window.location.search);
    return p.get('embed') === '1' || p.has('ticket');
  } catch {
    return false;
  }
}

class StandaloneBridge implements GameBridge {
  readonly mode = 'standalone' as const;
  private session: SessionInfo | null = null;

  constructor(readonly gameId: GameId) {}

  async start(): Promise<SessionInfo> {
    const params = new URLSearchParams(window.location.search);
    const level = Number(params.get('level') || 0);
    const seed = Number(params.get('seed') || 0) || randomSeed();
    // Seed'i bir kez tüketerek "gerçekten kullanıldığını" garanti et.
    createRng(seed).next();
    this.session = {
      sessionId: `local_${seed.toString(36)}_${Date.now().toString(36)}`,
      ticket: '',
      seed,
      config: Number.isFinite(level) && level > 0 ? { level } : {},
    };
    return this.session;
  }

  async finish(result: GameResult): Promise<FinishOutcome> {
    const out = recordPlay(this.gameId, result);
    return {
      accepted: true,
      xpGained: out.xpGained,
      message: out.leveledUp ? `Seviye ${out.level}!` : undefined,
    };
  }

  track(type: string, data?: Record<string, unknown>): void {
    // Standalone modda telemetri konsola düşer; ileride kendi ucuna gönderilir.
    if (import.meta.env?.DEV) console.debug(`[track] ${this.gameId}:${type}`, data ?? {});
  }

  exit(): void {
    // Bağımsız modda "çıkış" = menüye dön; yönlendirme yok.
  }
}

class TaskonomixBridge implements GameBridge {
  readonly mode = 'taskonomix' as const;
  private pending = new Map<string, { resolve: (v: any) => void; reject: (e: Error) => void; timer: number }>();
  private session: SessionInfo | null = null;

  constructor(readonly gameId: GameId) {
    window.addEventListener('message', this.onMessage);
    this.send('ready', { kitVersion: 1 });
  }

  private onMessage = (ev: MessageEvent) => {
    // En güçlü kontrol: mesaj gerçekten ebeveyn pencereden mi geliyor?
    if (window.parent && ev.source !== window.parent) return;
    const data = ev.data as Envelope | undefined;
    if (!data || data.source !== HOST_SOURCE || data.v !== PROTOCOL_VERSION) return;
    if (!data.requestId) return;
    const slot = this.pending.get(data.requestId);
    if (!slot) return;
    this.pending.delete(data.requestId);
    clearTimeout(slot.timer);
    if (data.type === 'error') slot.reject(new Error(data.payload?.message || 'HOST_ERROR'));
    else slot.resolve(data.payload);
  };

  private send(type: string, payload?: unknown, expectReply = false): Promise<any> | void {
    const requestId = expectReply
      ? `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
      : undefined;
    postToParent({
      source: CHILD_SOURCE,
      v: PROTOCOL_VERSION,
      type,
      requestId,
      gameId: this.gameId,
      payload,
    });
    if (!expectReply || !requestId) return;
    return new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => {
        this.pending.delete(requestId);
        reject(new Error('HOST_TIMEOUT'));
      }, REPLY_TIMEOUT_MS);
      this.pending.set(requestId, { resolve, reject, timer });
    });
  }

  async start(): Promise<SessionInfo> {
    const payload = await this.send('request-session', undefined, true);
    if (!payload || !payload.sessionId) throw new Error('SESSION_REJECTED');
    this.session = {
      sessionId: String(payload.sessionId),
      ticket: String(payload.ticket || ''),
      seed: Number(payload.seed) || randomSeed(),
      config: payload.config && typeof payload.config === 'object' ? payload.config : {},
    };
    return this.session;
  }

  async finish(result: GameResult): Promise<FinishOutcome> {
    if (!this.session) throw new Error('NO_SESSION');
    const payload = await this.send(
      'score',
      { ...result, sessionId: this.session.sessionId, ticket: this.session.ticket },
      true
    );
    return {
      accepted: !!payload?.accepted,
      xpGained: Number(payload?.xpGained) || 0,
      message: payload?.message,
    };
  }

  track(type: string, data?: Record<string, unknown>): void {
    this.send('event', { type, data, sessionId: this.session?.sessionId ?? null });
  }

  exit(): void {
    this.send('exit');
  }
}

export function createBridge(gameId: GameId): GameBridge {
  return isEmbedded() ? new TaskonomixBridge(gameId) : new StandaloneBridge(gameId);
}
