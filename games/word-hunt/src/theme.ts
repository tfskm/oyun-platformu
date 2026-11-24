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
};

export const LAYOUT = {
  boardX: W / 2,
  boardTop: 330,
  hexSize: 44,
};

export const HEX_COLORS = {
  fill: 0x14213c,
  fillAlt: 0x172846,
  edge: 0x35507d,
  selectedFill: 0x5b4a1c,
  selectedEdge: 0xffd166,
};
