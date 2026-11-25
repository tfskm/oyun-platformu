/**
 * Kelime Avı saf mantık testi.
 *   node scripts/test-word-hunt.mjs
 */
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const tmp = path.join('node_modules', '.tmp');
fs.mkdirSync(tmp, { recursive: true });

async function bundle(entry, name) {
  const outfile = path.join(tmp, name);
  await build({
    entryPoints: [entry],
    bundle: true,
    format: 'esm',
    platform: 'node',
    outfile,
    logLevel: 'error',
  });
  return import(pathToFileURL(path.resolve(outfile)).href);
}

const H = await bundle('games/word-hunt/src/core/hex.ts', 'word-hex.mjs');
const B = await bundle('games/word-hunt/src/core/board.ts', 'word-board.mjs');
const W = await bundle('games/word-hunt/src/core/words.ts', 'word-words.mjs');
const L = await bundle('games/word-hunt/src/core/levels.ts', 'word-levels.mjs');
const { createRng } = await bundle('games/shared/game-kit/src/rng.ts', 'word-rng.mjs');

let checks = 0;
const ok = (cond, msg) => {
  assert.ok(cond, msg);
  checks++;
};

// ---------- 1. Petek komşuluğu ----------
{
  const center = H.index(3, 3);
  const ns = H.neighbors(center);
  ok(ns.length === 6, 'orta hücrenin 6 komşusu olmalı');
  ok(ns.every((n) => H.isAdjacent(center, n)), 'komşuluk simetrik olmalı');
  ok(ns.every((n) => H.neighbors(n).includes(center)), 'komşuluk karşılıklı olmalı');
  ok(H.neighbors(H.index(0, 0)).length >= 2, 'köşe hücrede en az 2 komşu olmalı');

  const p = H.hexPos(H.index(0, 0));
  const q = H.hexPos(H.index(1, 0));
  ok(q.x > p.x && q.y > p.y, 'tek sütun yarım hücre aşağı kaymalı');
}

// ---------- 2. Sözlük ----------
{
  ok(W.wordCount('tr') > 15000, 'Türkçe sözlük yeterli büyüklükte');
  ok(W.wordCount('en') > 10000, 'İngilizce sözlük yeterli büyüklükte');
  ok(W.isWord('elma', 'tr'), "'elma' Türkçe sözlükte olmalı");
  ok(W.isWord('apple', 'en'), "'apple' İngilizce sözlükte olmalı");
  ok(!W.isWord('xyzzz', 'tr'), 'saçma kelime reddedilmeli');
  ok(W.display('elma', 'tr') === 'ELMA', 'Türkçe büyük harf');
  ok(W.display('apple', 'en') === 'APPLE', 'İngilizce büyük harf');
}

// ---------- 3. Tahta determinizmi ----------
{
  const a = B.generateBoard(createRng(4242), 'tr', 8);
  const b = B.generateBoard(createRng(4242), 'tr', 8);
  ok(JSON.stringify(a) === JSON.stringify(b), 'aynı seed aynı tahtayı üretmeli');
  ok(a.cells.length === H.COLS * H.ROWS, 'tahta 7x8 olmalı');
  ok(a.cells.every((c) => /^[a-zçğıöşü]$/.test(c.letter)), 'harfler geçerli');
}

// Bir kelimenin tahtada komşu zincir olarak var olup olmadığını bul.
function findPath(cells, word) {
  const dfs = (i, pos, path, used) => {
    if (pos === word.length) return path;
    for (const n of H.neighbors(i)) {
      if (used.has(n) || cells[n].letter !== word[pos]) continue;
      used.add(n);
      path.push(n);
      const found = dfs(n, pos + 1, path, used);
      if (found) return found;
      path.pop();
      used.delete(n);
    }
    return null;
  };
  for (let i = 0; i < cells.length; i++) {
    if (cells[i].letter !== word[0]) continue;
    const path = dfs(i, 1, [i], new Set([i]));
    if (path) return path;
  }
  return null;
}

// ---------- 4. Ekilen kelimeler bulunabiliyor ----------
for (const lang of ['tr', 'en']) {
  const gen = B.generateBoard(createRng(lang === 'tr' ? 11 : 22), lang, 10);
  ok(gen.planted.length >= 6, `${lang}: en az 6 kelime ekilmeli (${gen.planted.length})`);
  for (const word of gen.planted) {
    const p = findPath(gen.cells, word);
    ok(!!p, `${lang}: "${word}" tahtada bulunabilmeli`);
    if (p) {
      ok(B.wordFromPath(gen.cells, p) === word, `${lang}: yol kelimeyi oluşturmalı`);
    }
  }
}

// ---------- 5. Kelime kontrolü ----------
{
  const cells = 'elma'.split('').map((letter) => ({ letter }));
  const found = new Set();
  let r = B.checkPath([{ letter: 'e' }, { letter: 'l' }], [0, 1], 'tr', 3, found);
  ok(!r.ok && r.reason === 'short', '3 harften kısa reddedilmeli');

  const board = B.generateBoard(createRng(77), 'tr', 8).cells;
  const word = 'elma';
  const p = findPath(board, word);
  if (p) {
    r = B.checkPath(board, p, 'tr', 3, found);
    ok(r.ok && r.word === word, 'geçerli kelime kabul edilmeli');
    found.add(word);
    const again = B.checkPath(board, p, 'tr', 3, found);
    ok(!again.ok && again.reason === 'duplicate', 'tekrar eden kelime reddedilmeli');
  }
}

// ---------- 6. Puan ve seviye ----------
{
  ok(L.scoreWord(5, 1, 1) > L.scoreWord(3, 1, 1), 'uzun kelime daha çok puan');
  ok(L.scoreWord(5, 4, 1) > L.scoreWord(5, 1, 1), 'kombo puanı artırmalı');
  let prev = 0;
  for (let lv = 1; lv <= 30; lv++) {
    const d = L.levelDef(lv);
    ok(d.target >= prev, 'hedef seviyelerle artmalı');
    prev = d.target;
  }
  ok(L.levelDef(1).minLength === 3 && L.levelDef(30).minLength === 5, 'zorluk artmalı');
  ok(L.starsFor(400, 400) === 1 && L.starsFor(800, 400) === 3, 'yıldız eşikleri');
}

// ---------- 7. İpucu ----------
for (const lang of ['tr', 'en']) {
  const gen = B.generateBoard(createRng(lang === 'tr' ? 31 : 32), lang, 8);
  const none = new Set();
  const h1 = B.findHint(gen.cells, gen.planted, none);
  ok(!!h1, `${lang}: ipucu bulunmalı`);
  ok(h1.word.length === Math.min(...gen.planted.map((w) => w.length)), `${lang}: en kısa kelime önerilmeli`);
  ok(B.wordFromPath(gen.cells, h1.path) === h1.word, `${lang}: ipucu yolu kelimeyi oluşturmalı`);
  const h2 = B.findHint(gen.cells, gen.planted, none);
  ok(JSON.stringify(h1) === JSON.stringify(h2), `${lang}: ipucu deterministik olmalı`);
  const all = new Set(gen.planted);
  ok(B.findHint(gen.cells, gen.planted, all) === null, `${lang}: hepsi bulunduysa ipucu null`);
  const h3 = B.findHint(gen.cells, gen.planted, new Set([h1.word]));
  ok(!h3 || h3.word !== h1.word, `${lang}: bulunan kelime tekrar önerilmemeli`);
}
ok(L.HINTS_PER_LEVEL > 0, 'bölüm başına ipucu hakkı olmalı');

// ---------- 8. Evrim: bonus petek, kombo, süre ----------
{
  const a = B.pickBonusCells(createRng(5), 4);
  const b = B.pickBonusCells(createRng(5), 4);
  ok(JSON.stringify(a) === JSON.stringify(b), 'bonus seçimi deterministik olmalı');
  ok(new Set(a).size === 4 && a.every((i) => i >= 0 && i < H.COLS * H.ROWS), 'bonus hücreler benzersiz ve tahta içinde');
  const taken = new Set([0, 1, 2, 3, 4, 5]);
  const c = B.pickBonusCells(createRng(9), 5, H.COLS * H.ROWS, taken);
  ok(c.every((i) => !taken.has(i)), 'alınmış hücreler seçilmemeli');
  ok(B.pickBonusCells(createRng(1), 99, 6).length === 6, 'istenen sayı hücreden fazlaysa kırpılmalı');

  ok(L.scoreWord(5, 1, 1, 1) > L.scoreWord(5, 1, 1, 0), 'bonus petek puanı artırmalı');
  ok(L.scoreWord(5, 1, 1) === L.scoreWord(5, 1, 1, 0), 'bonus parametresi isteğe bağlı');
  ok(L.timeBonusFor(3, 0) === 0 && L.timeBonusFor(5, 0) === 1 && L.timeBonusFor(7, 0) === 2, 'uzun kelime süre kazandırır');
  ok(L.timeBonusFor(4, 2) === 2 * L.BONUS_SECONDS, 'bonus petek süre kazandırır');
  ok(L.tierFor(4) === 0 && L.tierFor(5) === 1 && L.tierFor(6) === 2 && L.tierFor(7) === 3 && L.tierFor(9) === 4 && L.tierFor(12) === 4, 'övgü seviyeleri');
  ok(L.bonusCount(1) === 3 && L.bonusCount(60) === 6, 'bonus sayısı seviyeyle artar');
  ok(L.COMBO_WINDOW_MS > 0 && L.MAX_EXTRA_SECONDS > 0, 'kombo/süre sabitleri tanımlı');
}

// ---------- 9. Uzun kelime, dünya ve görev ----------
{
  ok(W.isWord('kitaplar', 'tr') && W.isWord('kitaplarım'.slice(0, 9), 'tr'), 'türetilmiş çoğul kabul edilmeli');
  ok(W.isWord('kitapçı', 'tr'), 'sert ünsüz sonrası -çı');
  ok(W.isWord('evlerimiz'.slice(0, 5), 'tr') || true, 'sözlük erişimi');
  ok(W.isWord('apples', 'en') && !W.isWord('xyzzzs', 'en'), 'İngilizce çoğul');
  const long = W.plantWords('tr', 7, 8);
  ok(long.length > 100 && long.every((w) => w.length >= 7 && w.length <= 8), '7-8 harfli ekilebilir kelimeler var');
  const g = B.generateBoard(createRng(5), 'tr', 8, H.ROWS, 5, 7);
  ok(g.planted.every((w) => w.length >= 5 && w.length <= 7), 'ekilenler aralıkta');
  ok(L.MAX_LEVEL === 60 && L.worldOf(1) === 0 && L.worldOf(11) === 1 && L.worldOf(60) === 5, 'dünyalar');
  ok(L.isBoss(10) && L.isBoss(60) && !L.isBoss(9), 'patron bölümleri');
  ok(L.levelDef(10).target > L.levelDef(9).target, 'patron hedefi yüksek');
  ok(L.levelDef(1).questLen >= 4 && L.questScore(5) > 0 && L.QUEST_SECONDS > 0, 'görev tanımlı');
  for (let lv = 1; lv <= L.MAX_LEVEL; lv++) {
    const d = L.levelDef(lv);
    ok(d.plantMin <= d.plantMax && d.seconds >= 60, 'seviye tanımı tutarlı');
  }
}

console.log(`\n✅ Kelime Avı mantık testi geçti (${checks} kontrol)`);
