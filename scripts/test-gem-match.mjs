/**
 * Gem Match saf mantık testi.
 * Tarayıcı olmadan çalışır:  node scripts/test-gem-match.mjs
 *
 * Neyi doğruluyor?
 *  - Başlangıç tahtasında hazır eşleşme yok, en az bir hamle var
 *  - 3 / 4 / 5'li ve L şekli eşleşmeler doğru özel taşı üretiyor
 *  - Yer çekimi boşlukları doğru kapatıyor
 *  - 300 rastgele oyun simülasyonunda tahta bozulmuyor, sonsuz döngü yok
 *  - Aynı seed = aynı tahta (deterministik)
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

const B = await bundle('games/gem-match/src/core/board.ts', 'gem-board.mjs');
const K = await bundle('games/shared/game-kit/src/rng.ts', 'game-rng.mjs');

const { COLS, ROWS, idx } = B;
let checks = 0;
const ok = (cond, msg) => {
  assert.ok(cond, msg);
  checks++;
};

/** Kenar çizgili, kazara eşleşme üretmeyen dolu tahta. */
function plainGrid() {
  const g = new Array(COLS * ROWS).fill(null);
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      g[idx(r, c)] = { color: (r + c) % 2, special: null };
    }
  }
  return g;
}

// ---------- 1. Başlangıç tahtası ----------
{
  const rng = K.createRng(12345);
  const grid = B.createGrid(rng, 6);
  ok(grid.length === 64, 'tahta 64 hücre olmalı');
  ok(grid.every((c) => c && Number.isInteger(c.color)), 'tüm hücreler dolu olmalı');
  ok(B.findMatches(grid).length === 0, 'başlangıçta hazır eşleşme olmamalı');
  ok(B.findAnyMove(grid) !== null, 'başlangıçta en az bir hamle olmalı');
}

// ---------- 2. Determinizm ----------
{
  const a = B.createGrid(K.createRng(777), 6);
  const b = B.createGrid(K.createRng(777), 6);
  ok(JSON.stringify(a) === JSON.stringify(b), 'aynı seed aynı tahtayı üretmeli');
}

// ---------- 3. Eşleşme şekilleri ----------
{
  // Yatay 3
  const g = plainGrid();
  for (let c = 0; c < 3; c++) g[idx(0, c)].color = 4;
  let m = B.findMatches(g);
  ok(m.length === 1 && m[0].cells.length === 3, 'yatay 3 → tek grup');
  ok(m[0].special === null, 'yatay 3 özel taş üretmemeli');

  // Yatay 4 → satır patlatıcı
  const g4 = plainGrid();
  for (let c = 0; c < 4; c++) g4[idx(0, c)].color = 4;
  m = B.findMatches(g4);
  ok(m[0].special === 'row', 'yatay 4 → row');

  // Dikey 4 → sütun patlatıcı
  const gv = plainGrid();
  for (let r = 0; r < 4; r++) gv[idx(r, 0)].color = 5;
  m = B.findMatches(gv);
  ok(m[0].special === 'col', 'dikey 4 → col');

  // Yatay 5 → gökkuşağı
  const g5 = plainGrid();
  for (let c = 0; c < 5; c++) g5[idx(0, c)].color = 3;
  m = B.findMatches(g5);
  ok(m[0].special === 'rainbow', '5\'li → rainbow');

  // L şekli → bomba
  const gl = plainGrid();
  for (let c = 0; c < 3; c++) gl[idx(0, c)].color = 2;
  for (let r = 0; r < 3; r++) gl[idx(r, 0)].color = 2;
  m = B.findMatches(gl);
  ok(m.length === 1, 'L şekli tek grup olmalı');
  ok(m[0].cells.length === 5, 'L şekli 5 hücre kaplamalı');
  ok(m[0].special === 'bomb', 'L şekli → bomb');
}

// ---------- 4. Yer çekimi ----------
{
  const rng = K.createRng(99);
  const g = plainGrid();
  const top = g[idx(0, 0)];
  const bottom = g[idx(5, 0)];
  g[idx(6, 0)] = null;
  g[idx(7, 0)] = null;
  const res = B.collapseAndRefill(g, rng, 6);
  ok(g.every(Boolean), 'yer çekimi sonrası boşluk kalmamalı');
  ok(g[idx(7, 0)] === bottom, 'en alttaki taş en alta inmeli');
  ok(g[idx(2, 0)] === top, 'en üstteki taş tam 2 sıra inmeli');
  ok(res.spawned.length === 2, '2 yeni taş doğmalı');
}

// ---------- 5. Özel taş patlaması ----------
{
  const g = plainGrid();
  g[idx(3, 3)].special = 'row';
  const cleared = B.expandSpecials(g, [idx(3, 3)]);
  ok(cleared.size === COLS, 'satır patlatıcı tüm satırı silmeli');

  const g2 = plainGrid();
  g2[idx(3, 3)].special = 'bomb';
  const c2 = B.expandSpecials(g2, [idx(3, 3)]);
  ok(c2.size === 9, 'bomba 3x3 alan silmeli');
}

// ---------- 6. Rastgele oyun simülasyonu ----------
{
  const rng = K.createRng(2024);
  let moves = 0;
  let cascades = 0;

  for (let game = 0; game < 300; game++) {
    const grid = B.createGrid(rng, 6);
    let score = 0;

    for (let step = 0; step < 40; step++) {
      let move = B.findAnyMove(grid);
      if (!move) {
        // hamle yoksa tahta yenilenir (oyunda da aynı)
        const fresh = B.createGrid(rng, 6);
        for (let i = 0; i < 64; i++) grid[i] = fresh[i];
        move = B.findAnyMove(grid);
        if (!move) break;
      }
      const [a, b] = move;
      if (a !== b) {
        assert.ok(B.swapCreatesMatch(grid, a, b), 'seçilen hamle eşleşme üretmeli');
        B.swapCells(grid, a, b);
        moves++;
      }

      // zincirleme çözümleme
      let guard = 0;
      while (guard++ < 60) {
        const groups = B.findMatches(grid, [a, b]);
        if (!groups.length) break;
        cascades++;

        const toClear = new Set();
        for (const grp of groups) for (const c of grp.cells) toClear.add(c);

        const spawns = groups.filter((x) => x.special).map((x) => ({ at: x.anchor, special: x.special }));
        for (const s of spawns) toClear.delete(s.at);

        const cleared = B.expandSpecials(grid, toClear);
        for (const s of spawns) cleared.delete(s.at);
        score += B.clearScore(cleared.size, 1);

        for (const i of cleared) grid[i] = null;
        B.collapseAndRefill(grid, rng, 6);
        for (const s of spawns) {
          if (grid[s.at] && !grid[s.at].special) grid[s.at].special = s.special;
        }

        assert.ok(
          grid.every((c) => c && c.color >= 0 && c.color < 6),
          'çözümleme sonrası tahta tutarlı olmalı'
        );
      }
      assert.ok(guard < 60, 'zincirleme çözümleme sonsuz döngüye girmemeli');
    }
    assert.ok(score > 0, 'oyun boyunca puan üretilmeli');
  }

  console.log(`   → 300 oyun, ${moves} hamle, ${cascades} zincirleme çözümleme`);
}

console.log(`\n✅ Gem Match mantık testi geçti (${checks} kontrol)`);
