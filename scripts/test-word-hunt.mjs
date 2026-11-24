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

console.log(`\n✅ Kelime Avı mantık testi geçti (${checks} kontrol)`);
