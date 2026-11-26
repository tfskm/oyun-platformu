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
const M = await bundle('games/word-hunt/src/core/meta.ts', 'word-meta.mjs');
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
  ok(L.timeBonusFor(3, 0) === 0 && L.timeBonusFor(5, 0) === 1 && L.timeBonusFor(7, 0) === 3, 'uzun kelime süre kazandırır');
  ok(L.timeBonusFor(4, 2) === 2 * L.BONUS_SECONDS, 'bonus petek süre kazandırır');
  ok(L.tierFor(4) === 0 && L.tierFor(5) === 1 && L.tierFor(6) === 2 && L.tierFor(7) === 3 && L.tierFor(12) === 3, 'övgü seviyeleri');
  ok(L.bonusCount(1) === 3 && L.bonusCount(30) === 5, 'bonus sayısı seviyeyle artar');
  ok(L.COMBO_WINDOW_MS > 0 && L.MAX_EXTRA_SECONDS > 0, 'kombo/süre sabitleri tanımlı');
}

// ---------- 9. Joker ----------
{
  const idx = [H.index(0, 0), H.index(1, 0), H.index(2, 0), H.index(3, 0)];
  ok(idx.every((c, i) => i === 0 || H.isAdjacent(idx[i - 1], c)), 'test yolu komşu olmalı');
  const cells = Array.from({ length: H.COLS * H.ROWS }, () => ({ letter: 'x' }));
  ['e', 'l', 'z', 'a'].forEach((l, i) => (cells[idx[i]].letter = l));
  const none = new Set();
  ok(!B.checkPathJoker(cells, idx, new Set(), 'tr', 3, none).ok, 'jokersiz geçersiz yol reddedilmeli');
  const r = B.checkPathJoker(cells, idx, new Set([idx[2]]), 'tr', 3, none);
  ok(r.ok && r.joker === true, 'joker eksik harfi tamamlamalı');
  const again = B.checkPathJoker(cells, idx, new Set([idx[2]]), 'tr', 3, new Set([r.word]));
  ok(!again.ok || again.word !== r.word, 'bulunan kelime joker ile tekrar kabul edilmemeli');
  ok(B.checkPathJoker(cells, idx.slice(0, 2), new Set([idx[0]]), 'tr', 3, none).reason === 'short', 'kısa yol short kalmalı');
  cells[idx[2]].letter = 'm';
  const real = B.checkPathJoker(cells, idx, new Set([idx[2]]), 'tr', 3, none);
  ok(real.ok && !real.joker, 'gerçek kelime joker harcamamalı');
}

// ---------- 10. Fırsatlar: çarpan, ateş, joker sayısı ----------
ok(L.multiplierFor(false, false, 1, false) === 1, 'çarpan 1');
ok(L.multiplierFor(true, true, 1, false) === 3 && L.multiplierFor(true, true, 3, false) === 5, 'çarpanlar toplanır');
ok(L.feverGain(5, 0) === 40 && L.feverGain(3, 1) === 34, 'ateş dolumu');
ok(L.jokerCount(1) === 0 && L.jokerCount(3) === 1 && L.jokerCount(15) === 2, 'joker sayısı seviyeye göre');
ok(L.FEVER_MS > 0 && L.GOLDEN_MS > 0, 'süre sabitleri');

// ---------- 11. Seri, günlük meydan okuma, rozetler ----------
{
  ok(M.dayKey(Date.UTC(2026, 10, 25, 12)) === '2026-11-25', 'dayKey biçimi');
  ok(M.dayDiff('2026-12-31', '2027-01-01') === 1, 'yıl sınırında gün farkı');
  const m = M.emptyMeta();
  let t = M.touchDay(m, '2026-11-24');
  ok(t.isNewDay && t.streak === 1, 'ilk gün seri 1');
  t = M.touchDay(m, '2026-11-24');
  ok(!t.isNewDay && m.streak === 1, 'aynı gün seri artmaz');
  t = M.touchDay(m, '2026-11-25');
  ok(t.streak === 2, 'ertesi gün seri artar');
  t = M.touchDay(m, '2026-11-28');
  ok(t.streak === 1 && m.bestStreak === 2, 'boşlukta seri 1e döner, rekor korunur');
  ok(M.activeStreak(m, '2026-11-29') === 1 && M.activeStreak(m, '2026-12-05') === 0, 'aktif seri hesabı');
  ok(M.streakBonusXp(1) === 8 && M.streakBonusXp(99) === 30, 'seri bonusu sınırlı');
  ok(M.dailySeed('2026-11-25') === M.dailySeed('2026-11-25'), 'günlük tohum deterministik');
  ok(M.dailySeed('2026-11-25') !== M.dailySeed('2026-11-26'), 'günlük tohum güne göre değişir');
  for (let d = 1; d <= 30; d++) {
    const lv = M.dailyLevel('2026-11-' + String(d).padStart(2, '0'));
    ok(lv >= 4 && lv <= 10, 'günlük bölüm 4-10 aralığında');
  }
  const m2 = M.emptyMeta();
  m2.stats.totalWords = 1;
  m2.stats.longestWord = 7;
  m2.bestStreak = 3;
  const ids = M.newAchievements(m2);
  ok(ids.includes('first_word') && ids.includes('long7') && ids.includes('streak3') && !ids.includes('wins5'), 'rozet şartları');
  m2.unlocked.push('first_word');
  ok(!M.newAchievements(m2).includes('first_word'), 'açılmış rozet tekrar gelmez');
  ok(M.dailyDone({ ...m2, dailyDay: '2026-11-25' }, '2026-11-25') && !M.dailyDone(m2, '2026-11-25'), 'günlük tamam kontrolü');
}

// ---------- 12. Uzun kelime ödülü, kombo kilometre taşı, sandık, görevler ----------
{
  const r = [3, 4, 5, 6, 7, 8, 11].map((n) => L.lengthReward(n));
  ok(r[0].points === 0 && r[1].points === 0, '3-4 harf ödülsüz');
  ok(r[2].points === 60 && r[3].points === 180, '5-6 harf puan ödülü');
  ok(r[4].hints === 1 && r[4].freezeMs === 4000, '7 harf ipucu ve dondurma');
  ok(r[5].hints === 2 && r[5].freezeMs === 6000 && r[6].points === r[5].points, '8+ harf en yüksek ödül');
  for (let n = 4; n < 10; n++) ok(L.lengthReward(n + 1).points >= L.lengthReward(n).points, 'ödül uzunlukla azalmamalı');

  ok(L.comboMilestone(1) === null && L.comboMilestone(4) === null, 'kilometre taşı yalnızca belirli komboda');
  ok(L.comboMilestone(3).seconds === 2 && L.comboMilestone(12).points === 1200, 'kilometre taşı değerleri');

  const c1 = L.chestValues(1);
  const c3 = L.chestValues(3);
  ok(c1.length === 3 && c3.length === 3, 'üç sandık');
  ok(c3.every((v, i) => v > c1[i]), 'yıldız arttıkça sandık büyür');
  ok(L.chestValues(0)[0] === c1[0] && L.chestValues(9)[0] === c3[0], 'yıldız sayısı 1-3 aralığına kırpılır');

  const meta = M.emptyMeta();
  const today = '2026-11-26';
  let done = M.addMissionProgress(meta, today, { words: 14, combo: 3, long: 1 });
  ok(done.length === 0, 'hedefe ulaşılmadıysa görev tamamlanmaz');
  done = M.addMissionProgress(meta, today, { words: 1, combo: 4, long: 1 });
  ok(done.includes('words') && done.includes('combo') && done.includes('long'), 'üç görev tamamlanır');
  ok(meta.missions.pendingXp === 15 + 15 + 25, 'bekleyen XP toplanır');
  ok(M.addMissionProgress(meta, today, { words: 5 }).length === 0, 'tamamlanan görev tekrar ödül vermez');
  ok(M.takePendingXp(meta) === 55 && meta.missions.pendingXp === 0, 'bekleyen XP bir kez alınır');
  M.addMissionProgress(meta, '2026-11-27', { words: 2 });
  ok(meta.missions.day === '2026-11-27' && meta.missions.words === 2 && meta.missions.done.length === 0, 'yeni günde görevler sıfırlanır');
  const m2 = M.emptyMeta();
  M.addMissionProgress(m2, today, { words: 15 });
  M.missionsFor(m2, '2026-11-27');
  ok(m2.missions.pendingXp === 15, 'gün değişince ödenmemiş XP korunur');
}

console.log(`\n✅ Kelime Avı mantık testi geçti (${checks} kontrol)`);
