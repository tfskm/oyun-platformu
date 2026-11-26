/**
 * Ses: dosya yok, Web Audio ile sentez.
 * ------------------------------------------------------------------
 * Neden? Telif derdi yok, indirme yok, paket şişmiyor. Telegram WebView'de
 * ses ancak kullanıcı etkileşiminden sonra açılabilir; bu yüzden AudioContext
 * ilk dokunuşta "unlock" edilir.
 *
 * Tüm sesler ortak bir ana hattan geçer: kompresör (patlamayı önler) +
 * hafif yankı (sesleri "cam gibi" parlak yapar).
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
  | 'lose'
  | 'word'
  | 'tick'
  | 'hint'
  | 'bonus'
  | 'star'
  | 'whoosh'
  | 'treasure'
  | 'fever'
  | 'badge'
  | 'freeze'
  | 'pop';

let ctx: AudioContext | null = null;
let bus: GainNode | null = null;
let muted = readFlag('audio_muted');
let noiseSeed = 0x2f6e2b1;

function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  return ctx;
}

/** Ortak ana hat: master → kompresör → hoparlör, yanında yankı kolu. */
function out(c: AudioContext): AudioNode {
  if (bus) return bus;
  const master = c.createGain();
  master.gain.value = 0.95;
  const comp = c.createDynamicsCompressor();
  comp.threshold.value = -20;
  comp.knee.value = 18;
  comp.ratio.value = 5;
  comp.attack.value = 0.003;
  comp.release.value = 0.18;
  master.connect(comp);
  comp.connect(c.destination);

  const delay = c.createDelay(0.6);
  delay.delayTime.value = 0.14;
  const feedback = c.createGain();
  feedback.gain.value = 0.3;
  const wet = c.createGain();
  wet.gain.value = 0.2;
  const tone = c.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = 3800;
  master.connect(delay);
  delay.connect(tone);
  tone.connect(feedback);
  feedback.connect(delay);
  tone.connect(wet);
  wet.connect(comp);

  bus = master;
  return master;
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
  osc.connect(g).connect(out(c));
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

/** Filtreli gürültü patlaması (whoosh). Deterministik: Math.random kullanmaz. */
function noise(duration: number, gain: number, fromHz: number, toHz: number, delay = 0): void {
  const c = ac();
  if (!c) return;
  const n = Math.max(1, Math.floor(c.sampleRate * duration));
  const buf = c.createBuffer(1, n, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < n; i++) {
    noiseSeed = (Math.imul(noiseSeed, 1664525) + 1013904223) >>> 0;
    data[i] = (noiseSeed / 2147483648 - 1) * (1 - i / n);
  }
  const t0 = c.currentTime + delay;
  const src = c.createBufferSource();
  src.buffer = buf;
  const filter = c.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.value = 0.9;
  filter.frequency.setValueAtTime(fromHz, t0);
  filter.frequency.exponentialRampToValueAtTime(Math.max(60, toHz), t0 + duration);
  const g = c.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  src.connect(filter).connect(g).connect(out(c));
  src.start(t0);
}

/** Pentatonik gam basamağı → frekans çarpanı (hep uyumlu duyulur). */
const PENTA = [0, 2, 4, 7, 9];
function step(n: number): number {
  const i = Math.max(0, Math.floor(n));
  return Math.pow(2, (PENTA[i % 5] + 12 * Math.floor(i / 5)) / 12);
}

/**
 * `combo` parametresi sese göre anlam taşır:
 *  match → kombo, select → yoldaki harf sayısı, word → kelime uzunluğu,
 *  star → kazanılan yıldız sırası (1-3).
 */
export function play(name: SfxName, combo = 1): void {
  if (muted) return;
  const c = ac();
  if (!c) return;
  if (c.state === 'suspended') c.resume().catch(() => {});

  switch (name) {
    case 'click':
      tone(520, 0.05, 'square', 0.04);
      tone(1040, 0.04, 'sine', 0.02, 0.01);
      break;
    case 'select': {
      // Her yeni harf bir basamak yükselir: parmağın altında melodi oluşur.
      const f = 660 * step(Math.min(14, combo - 1));
      tone(f, 0.08, 'sine', 0.05);
      tone(f * 2, 0.05, 'triangle', 0.015, 0.005);
      break;
    }
    case 'swap':
      tone(440, 0.06, 'triangle', 0.05, 0, 620);
      break;
    case 'invalid':
      tone(180, 0.14, 'sawtooth', 0.04, 0, 110);
      tone(150, 0.14, 'square', 0.02, 0.03, 90);
      break;
    case 'match': {
      const base = 523.25 * Math.pow(1.06, Math.min(10, combo - 1));
      tone(base, 0.12, 'triangle', 0.06);
      tone(base * 1.5, 0.1, 'sine', 0.03, 0.02);
      break;
    }
    case 'word': {
      // Kelime bulununca harf sayısı kadar nota yukarı çıkan arpej.
      const n = Math.max(3, Math.min(9, combo));
      for (let i = 0; i < n; i++) {
        const f = 523.25 * step(i);
        tone(f, 0.2, 'triangle', 0.055, i * 0.05);
        tone(f * 2, 0.14, 'sine', 0.02, i * 0.05 + 0.01);
      }
      const top = 523.25 * step(n) * 2;
      tone(top, 0.4, 'sine', 0.04, n * 0.05);
      noise(0.18, 0.02, 3000, 9000, 0);
      break;
    }
    case 'special':
      tone(880, 0.18, 'sine', 0.05, 0, 1760);
      tone(1320, 0.14, 'triangle', 0.03, 0.03);
      break;
    case 'fall':
      tone(220, 0.07, 'sine', 0.03, 0, 160);
      break;
    case 'tick':
      tone(1480, 0.035, 'square', 0.022);
      tone(740, 0.05, 'sine', 0.02, 0.01);
      break;
    case 'hint':
      tone(784, 0.14, 'sine', 0.05, 0, 1568);
      tone(1175, 0.22, 'triangle', 0.03, 0.07);
      noise(0.2, 0.015, 1200, 5000);
      break;
    case 'bonus':
      [1046.5, 1318.5, 1568, 2093].forEach((f, i) => tone(f, 0.28, 'sine', 0.035, i * 0.05));
      tone(523.25, 0.4, 'triangle', 0.04, 0.02);
      break;
    case 'star': {
      const f = 880 * step(Math.max(0, combo - 1) * 2);
      tone(f, 0.45, 'triangle', 0.06);
      tone(f * 2, 0.55, 'sine', 0.025, 0.02);
      tone(f * 3, 0.35, 'sine', 0.012, 0.04);
      break;
    }
    case 'treasure':
      [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568].forEach((f, i) => tone(f, 0.3, 'triangle', 0.06, i * 0.07));
      tone(2093, 0.8, 'sine', 0.04, 0.45);
      noise(0.6, 0.03, 2000, 9000, 0.3);
      break;
    case 'fever':
      tone(330, 0.5, 'sawtooth', 0.03, 0, 990);
      tone(660, 0.5, 'triangle', 0.04, 0.05, 1980);
      noise(0.5, 0.04, 300, 6000);
      break;
    case 'badge':
      [784, 988, 1175].forEach((f, i) => tone(f, 0.22, 'sine', 0.05, i * 0.08));
      tone(1568, 0.5, 'triangle', 0.03, 0.26);
      break;
    case 'freeze':
      [2637, 2093, 1568, 1046.5].forEach((f, i) => tone(f, 0.45, 'sine', 0.035, i * 0.05));
      noise(0.4, 0.02, 7000, 2500);
      break;
    case 'pop': {
      const f = 700 * step(Math.min(14, combo - 1));
      tone(f, 0.07, 'triangle', 0.05, 0, f * 0.5);
      break;
    }
    case 'whoosh':
      noise(0.28, 0.05, 400, 3200);
      break;
    case 'win':
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, 0.26, 'triangle', 0.06, i * 0.1));
      tone(1318.5, 0.6, 'sine', 0.04, 0.42);
      noise(0.5, 0.03, 800, 7000, 0.35);
      break;
    case 'lose':
      [392, 329.63, 261.63].forEach((f, i) => tone(f, 0.26, 'sine', 0.05, i * 0.12));
      tone(196, 0.5, 'triangle', 0.03, 0.36);
      break;
  }
}
