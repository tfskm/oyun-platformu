/** Kelime Avı görsel kimliği — bal peteği ve altın/kehribar tonları. */

export { HEX_SIZE } from './core/hex.js';

export const W = 720;
export const H = 1280;

export const PALETTE = {
  bg0: '#070b18',
  bg1: '#101a2e',
  panel: '#13203a',
  panelEdge: '#2a3c60',
  text: '#f2f6ff',
  textDim: '#93a7c9',
  accent: '#ffd166',
  accent2: '#ff9f43',
  success: '#37e6a6',
  danger: '#ff5d6c',
  hexText: '#eafffb',
  hexTextOn: '#4a2f00',
};

export const LAYOUT = {
  boardX: W / 2,
  boardTop: 240,
  hexSize: 56,
};

export const HEX_COLORS = {
  fill: 0x14213c,
  fillAlt: 0x172846,
  edge: 0x35507d,
  selectedFill: 0x5b4a1c,
  selectedEdge: 0xffd166,
};

/** Dünya temaları: arka plan degradesi, vurgu ve petek yüzey renkleri. */
export interface WorldTheme {
  bgTop: number;
  bgBottom: number;
  glowA: number;
  glowB: number;
  accent: string;
  face: { wall: number; wallDark: number; faceEdge: number; faceCenter: number; rimLight: number; rimDark: number };
}

export const WORLDS: WorldTheme[] = [
  { bgTop: 0x0f1b3a, bgBottom: 0x04060d, glowA: 0xffb347, glowB: 0x2dd4bf, accent: '#ffd166',
    face: { wall: 0x0e5964, wallDark: 0x04202a, faceEdge: 0x155064, faceCenter: 0x44bcbd, rimLight: 0xc4fff4, rimDark: 0x0a3140 } },
  { bgTop: 0x06264a, bgBottom: 0x020a1a, glowA: 0x38bdf8, glowB: 0x6366f1, accent: '#7dd3fc',
    face: { wall: 0x1d4f91, wallDark: 0x081a3a, faceEdge: 0x2563a8, faceCenter: 0x6fb7ff, rimLight: 0xdff1ff, rimDark: 0x12315f } },
  { bgTop: 0x0c2a1c, bgBottom: 0x030c08, glowA: 0x84cc16, glowB: 0x10b981, accent: '#bef264',
    face: { wall: 0x2f6b2f, wallDark: 0x0f2a12, faceEdge: 0x3a8a3a, faceCenter: 0x8fe08a, rimLight: 0xeaffd9, rimDark: 0x1b4a1d } },
  { bgTop: 0x3a1230, bgBottom: 0x0d0410, glowA: 0xfb7185, glowB: 0xfb923c, accent: '#fda4af',
    face: { wall: 0xa03a52, wallDark: 0x3a0f1e, faceEdge: 0xc2475f, faceCenter: 0xffa3a3, rimLight: 0xffe4e6, rimDark: 0x6e2036 } },
  { bgTop: 0x1e1245, bgBottom: 0x05030f, glowA: 0xa78bfa, glowB: 0xf0abfc, accent: '#c4b5fd',
    face: { wall: 0x4c37a6, wallDark: 0x170f40, faceEdge: 0x5b45c4, faceCenter: 0xb9a6ff, rimLight: 0xf0eaff, rimDark: 0x2e2075 } },
  { bgTop: 0x3a2a08, bgBottom: 0x0d0902, glowA: 0xfacc15, glowB: 0xfb923c, accent: '#fde68a',
    face: { wall: 0xa87a12, wallDark: 0x3a2704, faceEdge: 0xc79a1f, faceCenter: 0xffe49a, rimLight: 0xfffbea, rimDark: 0x7a560c } },
];
