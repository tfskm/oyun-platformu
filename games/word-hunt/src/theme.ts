
/** Kelime Avı görsel kimliği — Göz yormayan Zümrüt & Derin Safir Teması. */

export { HEX_SIZE } from './core/hex.js';

export const W = 720;
export const H = 1280;

export const PALETTE = {
  bg0: '#060d1a',
  bg1: '#0a1628',
  panel: '#0e1d35',
  panelEdge: '#1e355b',
  text: '#f0f9ff',
  textDim: '#7dd3fc',
  accent: '#38bdf8',       // Göz yormayan berrak gök mavisi
  accent2: '#2dd4bf',      // Zümrüt turkuaz
  success: '#34d399',      // Yumuşak yeşil
  danger: '#f87171',       // Yumuşak kırmızı
  hexText: '#f0fdfa',      // Net beyaz-turkuaz
  hexTextOn: '#042f2e',    // Seçilince koyu yeşil-lacivert kontrast
};

export const LAYOUT = {
  boardX: W / 2,
  boardTop: 240,
  hexSize: 56,
};

export const HEX_COLORS = {
  fill: 0x0c1e38,
  fillAlt: 0x0f2545,
  edge: 0x1e3a66,
  selectedFill: 0x0d9488,
  selectedEdge: 0x5eead4,
};

export interface WorldTheme {
  bgTop: number;
  bgBottom: number;
  glowA: number;
  glowB: number;
  accent: string;
  face: { wall: number; wallDark: number; faceEdge: number; faceCenter: number; rimLight: number; rimDark: number };
}

export const WORLDS: WorldTheme[] = [
  {
    bgTop: 0x081326,
    bgBottom: 0x03070f,
    glowA: 0x0284c7,
    glowB: 0x0d9488,
    accent: '#38bdf8',
    face: { wall: 0x0a4366, wallDark: 0x051d2f, faceEdge: 0x0f4c6e, faceCenter: 0x2289a6, rimLight: 0xa5f3fc, rimDark: 0x082b40 },
  },
];
