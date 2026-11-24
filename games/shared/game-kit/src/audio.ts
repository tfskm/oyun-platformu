/**
 * Ses: dosya yok, Web Audio ile sentez.
 * ------------------------------------------------------------------
 * Neden? Telif derdi yok, indirme yok, paket şişmiyor. Telegram WebView'de
 * ses ancak kullanıcı etkileşiminden sonra açılabilir; bu yüzden AudioContext
 * ilk dokunuşta "unlock" edilir.
 */

import { readFlag, writeFlag } from './storage.js';

export type SfxName =
  | 'click'
  | 'select'
  | 'swap'
  | 'invalid'
  | 'match'
  | 'special'
  | 'fall'
  | 'win'
  | 'lose';

let ctx: AudioContext | null = null;
let muted = readFlag('audio_muted');

function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  return ctx;
}

export function unlockAudio(): void {
  const c = ac();
  if (c && c.state === 'suspended') c.resume().catch(() => {});
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(v: boolean): void {
  muted = v;
  writeFlag('audio_muted', v);
}

function tone(
  freq: number,
  duration: number,
  type: OscillatorType,
  gain: number,
  delay = 0,
  slideTo?: number
): void {
  const c = ac();
  if (!c) return;
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t0 + duration);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

/** combo arttıkça tizleşen eşleşme sesi. */
export function play(name: SfxName, combo = 1): void {
  if (muted) return;
  const c = ac();
  if (!c) return;
  if (c.state === 'suspended') c.resume().catch(() => {});

  switch (name) {
    case 'click':
      tone(520, 0.05, 'square', 0.04);
      break;
    case 'select':
      tone(660, 0.05, 'sine', 0.05);
      break;
    case 'swap':
      tone(440, 0.06, 'triangle', 0.05, 0, 620);
      break;
    case 'invalid':
      tone(180, 0.12, 'sawtooth', 0.04, 0, 120);
      break;
    case 'match': {
      const base = 523.25 * Math.pow(1.06, Math.min(10, combo - 1));
      tone(base, 0.12, 'triangle', 0.06);
      tone(base * 1.5, 0.1, 'sine', 0.03, 0.02);
      break;
    }
    case 'special':
      tone(880, 0.18, 'sine', 0.05, 0, 1760);
      tone(1320, 0.14, 'triangle', 0.03, 0.03);
      break;
    case 'fall':
      tone(220, 0.07, 'sine', 0.03, 0, 160);
      break;
    case 'win':
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, 0.22, 'triangle', 0.06, i * 0.1));
      break;
    case 'lose':
      [392, 329.63, 261.63].forEach((f, i) => tone(f, 0.24, 'sine', 0.05, i * 0.12));
      break;
  }
}
