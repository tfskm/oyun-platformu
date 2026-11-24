/** Gem Match görsel kimliği — tüm renkler tek yerde. */

export const W = 720;
export const H = 1280;

export const PALETTE = {
  bg0: '#070b18',
  bg1: '#0d1630',
  panel: '#111c3a',
  panelEdge: '#24365f',
  text: '#eaf2ff',
  textDim: '#8fa3c8',
  accent: '#3ee0ff',
  accent2: '#ff4fd8',
  gold: '#ffd166',
  danger: '#ff5d6c',
  success: '#37e6a6',
};

/** 6 taş rengi: hem renk hem şekil farkı (erişilebilirlik). */
export const GEMS = [
  { name: 'ruby', main: 0xff4d6d, dark: 0x9c1f38, light: 0xffb3c1, shape: 0 },
  { name: 'amber', main: 0xffb020, dark: 0xa65c00, light: 0xffe3a3, shape: 1 },
  { name: 'emerald', main: 0x2ee6a8, dark: 0x0f7d5b, light: 0xa9ffe4, shape: 2 },
  { name: 'sapphire', main: 0x4d9dff, dark: 0x1a4c9e, light: 0xbcd8ff, shape: 3 },
  { name: 'amethyst', main: 0xb46bff, dark: 0x5c2a9e, light: 0xe0c4ff, shape: 4 },
  { name: 'pearl', main: 0xeaf6ff, dark: 0x8aa4c4, light: 0xffffff, shape: 5 },
] as const;

export const LAYOUT = {
  boardX: 360,
  boardTop: 322,
  cell: 78,
  boardW: 78 * 8,
  gemRadius: 31,
};
