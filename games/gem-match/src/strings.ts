/**
 * GEM MATCH metinleri — Türkçe / İngilizce.
 * Ekrana yazılan her metin burada olmalı; sahnelerde düz metin yazma.
 *
 * Yeni oyun: bu dosyayı kopyala, kendi anahtarlarını ekle.
 * Ortak metinler (rütbe, menü, ses, XP...) game-kit COMMON içinde gelir.
 */

import {
  registerStrings,
  type Dict,
} from '../../shared/game-kit/src/index.js';

export const STRINGS: Dict = {
  'menu.footer': ['Taskonomix Oyunları  •  v0.1', 'Taskonomix Games  •  v0.1'],
  'menu.tagline': ['EŞLEŞTİR  •  PATLAT  •  YÜKSEL', 'MATCH  •  BLAST  •  RISE'],
  'menu.levelLabel': ['BÖLÜM', 'LEVEL'],
  'menu.target': ['Hedef {score} puan  •  {moves} hamle', 'Target {score} pts  •  {moves} moves'],

  'game.levelLabel': ['BÖLÜM {n}', 'LEVEL {n}'],
  'game.sessionError': [
    'Oturum açılamadı.\nMenüye dönüp tekrar deneyin.',
    "Couldn't start a session.\nGo back to the menu and try again.",
  ],
  'game.shuffling': ['KARIŞTIRILIYOR', 'SHUFFLING'],
  'game.clear': ['BÖLÜM TAMAM', 'LEVEL CLEAR'],
  'game.fail': ['TEKRAR DENE', 'TRY AGAIN'],
};

// Modül yüklenir yüklenmez kaydet: sahneler t() çağırdığında sözlük hazır.
registerStrings(STRINGS);

export {
  fmtInt,
  getLang,
  initLang,
  locale,
  onLangChange,
  setLang,
  t,
  toggleLang,
  upper,
} from '../../shared/game-kit/src/i18n.js';
