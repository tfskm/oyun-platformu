/** Kelime Avı metinleri — TR / EN. Tüm ekran metinleri burada. */

import { registerStrings, type Dict } from '../../shared/game-kit/src/index.js';

export const STRINGS: Dict = {
  'menu.footer': ['OYUN PLATFORMU  •  v0.1', 'GAME PLATFORM  •  v0.1'],
  'menu.tagline': ['PETEĞİN İÇİNDE KELİMELERİ BUL', 'FIND WORDS IN THE HONEYCOMB'],
  'menu.levelLabel': ['BÖLÜM', 'LEVEL'],
  'menu.target': ['Hedef {score} puan  •  {seconds} saniye', 'Target {score} pts  •  {seconds} seconds'],
  'menu.howto': ['Harfleri parmağınla birleştir', 'Connect letters with your finger'],

  'game.howto': ['KOMŞU HARFLERİ BİRLEŞTİR', 'CONNECT NEIGHBOURING LETTERS'],
  'game.timeUp': ['SÜRE BİTTİ', 'TIME IS UP'],
  'game.won': ['HEDEFE ULAŞTIN', 'TARGET REACHED'],
  'game.lost': ['YENİDEN DENE', 'TRY AGAIN'],
  'game.foundWords': ['BULUNAN KELİMELER', 'FOUND WORDS'],
  'game.noWords': ['Henüz kelime yok', 'No words yet'],
  'game.levelLabel': ['BÖLÜM {n}', 'LEVEL {n}'],
  'game.tier0': ['İyi!', 'Good!'],
  'game.tier1': ['GÜZEL!', 'NICE!'],
  'game.tier2': ['HARİKA!', 'GREAT!'],
  'game.tier3': ['EFSANE!', 'LEGENDARY!'],
  'game.bonusTime': ['+{n} sn', '+{n}s'],
  'game.hint': ['İPUCU', 'HINT'],
  'game.hintLeft': ['İPUCU {n}', 'HINT {n}'],
  'game.hintLength': ['{n} harfli bir kelime var', 'There is a {n}-letter word'],
  'game.hintNone': ['İpucu kalmadı', 'No hints left'],
  'game.hintEmpty': ['Gösterilecek ipucu yok', 'No hint available'],
  'game.minLength': ['En az {n} harf', 'At least {n} letters'],
};

registerStrings(STRINGS);

export {
  fmtInt,
  getLang,
  initLang,
  locale,
  setLang,
  t,
  toggleLang,
  upper,
} from '../../shared/game-kit/src/i18n.js';
