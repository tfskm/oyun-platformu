import Phaser from 'phaser';
import { H, LAYOUT, PALETTE, W, GEMS } from '../theme.js';
import { levelDef, MAX_LEVEL, starsFor, xpFor, type LevelDef } from '../core/levels.js';
import {
  CELL_COUNT,
  COLS,
  ROWS,
  clearScore,
  collapseAndRefill,
  colOf,
  createGrid,
  expandSpecials,
  findAnyMove,
  findMatches,
  idx,
  isAdjacent,
  rowOf,
  swapCells,
  swapCreatesMatch,
  type Cell,
  type Grid,
  type Special,
} from '../core/board.js';
import {
  createBridge,
  createRng,
  levelInfo,
  loadProfile,
  play,
  unlockAudio,
  type GameBridge,
  type SessionInfo,
} from '../../../shared/game-kit/src/index.js';
import type { Rng } from '../../../shared/game-kit/src/rng.js';
import { haptic, setBackButton } from '../telegram.js';
import { fmtInt, t, upper } from '../strings.js';

const FONT = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';

interface GemView {
  container: Phaser.GameObjects.Container;
  sprite: Phaser.GameObjects.Image;
  icon: Phaser.GameObjects.Image | null;
  color: number;
}

export class GameScene extends Phaser.Scene {
  private bridge!: GameBridge;
  private session!: SessionInfo;
  private rng!: Rng;
  private def!: LevelDef;

  private level = 1;
  private grid: Grid = [];
  private gems: Array<GemView | null> = [];
  private emitters: Phaser.GameObjects.Particles.ParticleEmitter[] = [];

  private score = 0;
  private movesLeft = 0;
  private combo = 0;
  private maxCombo = 0;
  private startedAt = 0;

  private selected: number | null = null;
  private selectionRing!: Phaser.GameObjects.Image;
  private dragStart: { x: number; y: number } | null = null;

  private ready = false;
  private busy = false;
  private ended = false;

  private scoreText!: Phaser.GameObjects.Text;
  private movesText!: Phaser.GameObjects.Text;
  private bar!: Phaser.GameObjects.Graphics;
  private comboText!: Phaser.GameObjects.Text;

  constructor() {
    super('Game');
  }

  init(data: { level?: number }): void {
    this.level = Math.max(1, Number(data?.level) || 1);
    this.def = levelDef(this.level);
    this.score = 0;
    this.movesLeft = this.def.moves;
    this.combo = 0;
    this.maxCombo = 0;
    this.selected = null;
    this.busy = false;
    this.ended = false;
    this.ready = false;
    this.grid = [];
    this.gems = [];
  }

  create(): void {
    this.bridge = createBridge('gem-match');
    this.buildBackground();
    this.buildHud();
    this.buildBoardFrame();

    this.selectionRing = this.add
      .image(0, 0, 'ring')
      .setDisplaySize(LAYOUT.cell - 4, LAYOUT.cell - 4)
      .setTint(0x3ee0ff)
      .setAlpha(0)
      .setDepth(9);

    this.input.on('pointerdown', this.onDown, this);
    this.input.on('pointermove', this.onMove, this);
    this.input.on('pointerup', this.onUp, this);

    // Telegram geri tuşu: oyunu yarıda bırakıp menüye döner (kayıt altına alınır).
    setBackButton(() => this.leaveLevel());
    this.events.once('shutdown', () => setBackButton(null));

    const loading = this.add
      .text(W / 2, 640, t('common.loading'), {
        fontFamily: FONT,
        fontSize: '22px',
        color: PALETTE.textDim,
      })
      .setOrigin(0.5)
      .setDepth(120);

    void this.bridge
      .start()
      .then((s) => {
        this.session = s;
        this.rng = createRng(s.seed);
        loading.destroy();
        this.begin();
      })
      .catch(() => {
        loading.setText(t('game.sessionError')).setAlign('center');
      });
  }

  // ================= KURULUM =================

  private buildBackground(): void {
    const g = this.add.graphics();
    g.fillGradientStyle(0x0a1226, 0x0a1226, 0x05070f, 0x05070f, 1);
    g.fillRect(0, 0, W, H);
    this.add
      .image(W / 2, 380, 'dot')
      .setDisplaySize(1000, 1000)
      .setAlpha(0.05)
      .setTint(0x3ee0ff)
      .setBlendMode(Phaser.BlendModes.ADD);
  }

  private buildHud(): void {
    const panel = this.add.graphics();
    panel.fillStyle(0x0d1730, 0.95);
    panel.fillRoundedRect(28, 40, W - 56, 232, 26);
    panel.lineStyle(2, 0x1d2c50, 1);
    panel.strokeRoundedRect(28, 40, W - 56, 232, 26);

    this.add
      .text(56, 66, upper(t('game.levelLabel', { n: this.def.level })), {
        fontFamily: FONT,
        fontSize: '18px',
        color: PALETTE.textDim,
        fontStyle: 'bold',
      })
      .setLetterSpacing(2)
      .setDepth(100);

    this.movesText = this.add
      .text(W - 56, 62, '', {
        fontFamily: FONT,
        fontSize: '30px',
        color: PALETTE.text,
        fontStyle: 'bold',
      })
      .setOrigin(1, 0)
      .setDepth(100);

    this.scoreText = this.add
      .text(W / 2, 138, '0', {
        fontFamily: FONT,
        fontSize: '64px',
        color: PALETTE.gold,
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(100);

    this.bar = this.add.graphics().setDepth(100);

    this.comboText = this.add
      .text(W / 2, 232, '', {
        fontFamily: FONT,
        fontSize: '22px',
        color: PALETTE.accent,
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(100)
      .setAlpha(0);

    this.updateHud();
  }

  private buildBoardFrame(): void {
    const w = COLS * LAYOUT.cell;
    const h = ROWS * LAYOUT.cell;
    const x = LAYOUT.boardX - w / 2;
    const g = this.add.graphics().setDepth(1);
    g.fillStyle(0x0b1428, 1);
    g.fillRoundedRect(x - 12, LAYOUT.boardTop - 12, w + 24, h + 24, 22);
    g.lineStyle(2, 0x1d2c50, 1);
    g.strokeRoundedRect(x - 12, LAYOUT.boardTop - 12, w + 24, h + 24, 22);

    // Hücre dokusu
    g.fillStyle(0x101d38, 0.55);
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if ((r + c) % 2 === 0) continue;
        g.fillRoundedRect(
          x + c * LAYOUT.cell + 3,
          LAYOUT.boardTop + r * LAYOUT.cell + 3,
          LAYOUT.cell - 6,
          LAYOUT.cell - 6,
          10
        );
      }
    }
  }

  private begin(): void {
    this.grid = createGrid(this.rng, this.def.colors);
    this.buildGemViews();
    this.startedAt = Date.now();
    this.ready = true;
    this.bridge.track('level_start', { level: this.level });
  }

  private buildGemViews(): void {
    for (let i = 0; i < CELL_COUNT; i++) {
      const cell = this.grid[i];
      if (!cell) continue;
      const view = this.makeGem(i, cell);
      view.container.setAlpha(0);
      this.tweens.add({
        targets: view.container,
        alpha: 1,
        duration: 240,
        delay: rowOf(i) * 28 + colOf(i) * 12,
      });
    }
  }

  private makeGem(i: number, cell: Cell, startY?: number): GemView {
    const p = this.posOf(i);
    const sprite = this.add.image(0, 0, `gem${cell.color}`).setDisplaySize(62, 62);
    const container = this.add.container(p.x, startY ?? p.y, [sprite]);
    container.setSize(LAYOUT.cell, LAYOUT.cell);
    container.setDepth(10);

    const view: GemView = { container, sprite, icon: null, color: cell.color };
    if (cell.special) this.attachIconTo(view, cell.special);
    if (startY === undefined) {
      container.setScale(0.2);
      this.tweens.add({ targets: container, scale: 1, duration: 220, ease: 'Back.easeOut' });
    }
    this.gems[i] = view;
    return view;
  }

  private attachIconTo(view: GemView, special: Special): void {
    if (!special) return;
    if (view.icon) view.icon.destroy();
    const key =
      special === 'row' ? 'sp_row' : special === 'col' ? 'sp_col' : special === 'bomb' ? 'sp_bomb' : 'sp_rainbow';
    view.icon = this.add.image(0, 0, key).setDisplaySize(46, 46).setAlpha(0.92);
    view.container.add(view.icon);
    this.tweens.add({
      targets: view.icon,
      scale: { from: 0.85, to: 1 },
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private attachIcon(i: number, special: Special): void {
    const view = this.gems[i];
    if (view) this.attachIconTo(view, special);
  }

  private posOf(i: number): { x: number; y: number } {
    const r = rowOf(i);
    const c = colOf(i);
    const left = LAYOUT.boardX - (COLS * LAYOUT.cell) / 2;
    return {
      x: left + LAYOUT.cell / 2 + c * LAYOUT.cell,
      y: LAYOUT.boardTop + LAYOUT.cell / 2 + r * LAYOUT.cell,
    };
  }

  // ================= GİRDİ =================

  private pointerCell(pointer: Phaser.Input.Pointer): number {
    const left = LAYOUT.boardX - (COLS * LAYOUT.cell) / 2;
    const top = LAYOUT.boardTop;
    const c = Math.floor((pointer.x - left) / LAYOUT.cell);
    const r = Math.floor((pointer.y - top) / LAYOUT.cell);
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return -1;
    return idx(r, c);
  }

  private onDown(pointer: Phaser.Input.Pointer): void {
    unlockAudio();
    if (!this.ready || this.busy || this.ended) return;
    const cell = this.pointerCell(pointer);
    if (cell < 0) {
      this.clearSelection();
      return;
    }
    this.dragStart = { x: pointer.x, y: pointer.y };
    if (this.selected === null) {
      this.select(cell);
      return;
    }
    if (this.selected === cell) {
      this.clearSelection();
      return;
    }
    if (isAdjacent(this.selected, cell)) {
      const from = this.selected;
      this.dragStart = null;
      void this.trySwap(from, cell);
      return;
    }
    this.select(cell);
  }

  private onMove(pointer: Phaser.Input.Pointer): void {
    if (!this.ready || this.busy || this.ended) return;
    if (!pointer.isDown || this.selected === null || !this.dragStart) return;

    const dx = pointer.x - this.dragStart.x;
    const dy = pointer.y - this.dragStart.y;
    if (Math.hypot(dx, dy) < 18) return;

    const from = this.selected;
    let to = -1;
    if (Math.abs(dx) > Math.abs(dy)) {
      const c = colOf(from) + (dx > 0 ? 1 : -1);
      if (c >= 0 && c < COLS) to = idx(rowOf(from), c);
    } else {
      const r = rowOf(from) + (dy > 0 ? 1 : -1);
      if (r >= 0 && r < ROWS) to = idx(r, colOf(from));
    }
    this.dragStart = null;
    if (to >= 0) void this.trySwap(from, to);
  }

  private onUp(): void {
    this.dragStart = null;
  }

  private select(i: number): void {
    this.selected = i;
    const p = this.posOf(i);
    this.selectionRing.setPosition(p.x, p.y).setAlpha(0.9).setScale(0.9);
    this.tweens.add({
      targets: this.selectionRing,
      scale: 1.05,
      alpha: 0.55,
      duration: 620,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    const view = this.gems[i];
    if (view) {
      this.tweens.add({ targets: view.container, scale: 1.12, duration: 110 });
    }
    play('select');
  }

  private clearSelection(): void {
    if (this.selected !== null) {
      const view = this.gems[this.selected];
      if (view) this.tweens.add({ targets: view.container, scale: 1, duration: 110 });
    }
    this.selected = null;
    this.tweens.killTweensOf(this.selectionRing);
    this.selectionRing.setAlpha(0);
  }

  // ================= HAMLE =================

  private async trySwap(a: number, b: number): Promise<void> {
    if (this.busy || this.ended || !this.ready) return;
    const ca = this.grid[a];
    const cb = this.grid[b];
    if (!ca || !cb) return;

    this.busy = true;
    this.clearSelection();

    const va = this.gems[a];
    const vb = this.gems[b];
    if (!va || !vb) {
      this.busy = false;
      return;
    }

    const pa = this.posOf(a);
    const pb = this.posOf(b);
    this.tweens.add({ targets: va.container, x: pb.x, y: pb.y, duration: 130, ease: 'Quad.easeOut' });
    this.tweens.add({ targets: vb.container, x: pa.x, y: pa.y, duration: 130, ease: 'Quad.easeOut' });
    play('swap');
    await this.wait(140);

    if (!swapCreatesMatch(this.grid, a, b)) {
      play('invalid');
      this.tweens.add({ targets: va.container, x: pa.x, y: pa.y, duration: 130 });
      this.tweens.add({ targets: vb.container, x: pb.x, y: pb.y, duration: 130 });
      await this.wait(150);
      this.busy = false;
      return;
    }

    const swapColor = ca.special === 'rainbow' ? cb.color : ca.color;

    swapCells(this.grid, a, b);
    this.gems[a] = vb;
    this.gems[b] = va;

    this.movesLeft = Math.max(0, this.movesLeft - 1);
    this.updateHud();

    await this.resolve([a, b], swapColor);
    await this.ensurePlayable();

    this.busy = false;
    this.checkEnd();
  }

  private async resolve(preferred: number[], swapColor?: number): Promise<void> {
    let guard = 0;
    let pref = preferred;
    let color = swapColor;

    while (guard++ < 40) {
      const groups = findMatches(this.grid, pref);
      if (!groups.length) break;

      this.combo += 1;
      this.maxCombo = Math.max(this.maxCombo, this.combo);

      const toClear = new Set<number>();
      for (const g of groups) for (const c of g.cells) toClear.add(c);

      // Gökkuşağı takası: taş eşleşmese de patlamalı.
      for (const p of pref) {
        if (this.grid[p]?.special === 'rainbow') toClear.add(p);
      }

      const spawns: Array<{ at: number; special: Special }> = [];
      for (const g of groups) {
        if (g.special) spawns.push({ at: g.anchor, special: g.special });
      }
      for (const s of spawns) toClear.delete(s.at);

      const cleared = expandSpecials(this.grid, toClear, color);
      for (const s of spawns) cleared.delete(s.at);
      if (!cleared.size && !spawns.length) break;

      const gained = clearScore(cleared.size, this.combo) + spawns.length * 40;
      this.score += gained;
      this.updateHud();
      this.showCombo(this.combo);

      await this.clearCells(cleared, this.combo);

      for (const s of spawns) {
        const cell = this.grid[s.at];
        if (cell && !cell.special) {
          cell.special = s.special;
          this.attachIcon(s.at, s.special);
          play('special');
          this.burst(this.posOf(s.at), 0xffd166, 10);
        }
      }

      await this.applyGravity();
      pref = [];
      color = undefined;
    }
    this.combo = 0;
  }

  private async clearCells(cells: Set<number>, combo: number): Promise<void> {
    if (!cells.size) return;
    play('match', combo);
    haptic(combo > 1 || cells.size >= 5 ? 'medium' : 'light');
    if (combo > 1 || cells.size >= 5) {
      this.cameras.main.shake(110, 0.0035);
    }

    for (const i of cells) {
      const view = this.gems[i];
      const cell = this.grid[i];
      if (!view || !cell) continue;
      const p = this.posOf(i);
      this.burst(p, GEMS[cell.color].main, combo > 1 ? 7 : 4);

      this.tweens.add({
        targets: view.container,
        scale: 0,
        angle: Phaser.Math.Between(-70, 70),
        alpha: 0.2,
        duration: 190,
        ease: 'Quad.easeIn',
        onComplete: () => view.container.destroy(),
      });
      this.grid[i] = null;
      this.gems[i] = null;
    }

    await this.wait(200);
  }

  private async applyGravity(): Promise<void> {
    const { moves, spawned } = collapseAndRefill(this.grid, this.rng, this.def.colors);

    for (const m of moves) {
      this.gems[m.to] = this.gems[m.from];
      this.gems[m.from] = null;
    }

    const duration = 250;
    for (const m of moves) {
      const view = this.gems[m.to];
      if (!view) continue;
      const p = this.posOf(m.to);
      this.tweens.add({
        targets: view.container,
        x: p.x,
        y: p.y,
        duration,
        ease: 'Bounce.easeOut',
      });
    }

    for (const i of spawned) {
      const cell = this.grid[i];
      if (!cell) continue;
      const p = this.posOf(i);
      const view = this.makeGem(i, cell, p.y - LAYOUT.cell * 2.2);
      this.tweens.add({
        targets: view.container,
        y: p.y,
        duration: duration + 60,
        ease: 'Bounce.easeOut',
      });
    }

    if (moves.length || spawned.length) play('fall');
    await this.wait(duration + 90);
  }

  private async ensurePlayable(): Promise<void> {
    if (findAnyMove(this.grid)) return;
    this.centerText(t('game.shuffling'));
    for (let i = 0; i < CELL_COUNT; i++) {
      this.gems[i]?.container.destroy();
      this.gems[i] = null;
    }
    this.grid = createGrid(this.rng, this.def.colors);
    this.buildGemViews();
    await this.wait(420);
  }

  // ================= GÖRSEL GERİ BİLDİRİM =================

  private burst(p: { x: number; y: number }, tint: number, count: number): void {
    const emitter = this.emitters.find((e) => (e as any)._tintValue === tint);
    if (emitter) {
      emitter.emitParticleAt(p.x, p.y, count);
    } else {
      const e = this.add.particles(0, 0, 'spark', {
        speed: { min: 60, max: 240 },
        angle: { min: 0, max: 360 },
        scale: { start: 0.85, end: 0 },
        lifespan: { min: 260, max: 560 },
        quantity: 1,
        tint,
        blendMode: 'ADD',
        emitting: false,
      });
      (e as any)._tintValue = tint;
      e.setDepth(60);
      this.emitters.push(e);
      e.emitParticleAt(p.x, p.y, count);
    }

    const ring = this.add
      .image(p.x, p.y, 'ring')
      .setDisplaySize(40, 40)
      .setTint(tint)
      .setAlpha(0.7)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(55);
    this.tweens.add({
      targets: ring,
      displayWidth: 96,
      displayHeight: 96,
      alpha: 0,
      duration: 320,
      onComplete: () => ring.destroy(),
    });
  }

  private floatText(x: number, y: number, text: string, color: string): void {
    const t = this.add
      .text(x, y, text, { fontFamily: FONT, fontSize: '24px', color, fontStyle: 'bold' })
      .setOrigin(0.5)
      .setDepth(70);
    this.tweens.add({
      targets: t,
      y: y - 56,
      alpha: 0,
      duration: 620,
      ease: 'Quad.easeOut',
      onComplete: () => t.destroy(),
    });
  }

  private showCombo(combo: number): void {
    if (combo <= 1) return;
    this.comboText.setText(t('common.combo', { n: combo })).setAlpha(1).setScale(1.25);
    this.tweens.add({ targets: this.comboText, scale: 1, duration: 260, ease: 'Back.easeOut' });
    this.tweens.add({ targets: this.comboText, alpha: 0, delay: 520, duration: 320 });
  }

  private centerText(text: string): void {
    const t = this.add
      .text(W / 2, 620, text, { fontFamily: FONT, fontSize: '30px', color: PALETTE.accent, fontStyle: 'bold' })
      .setOrigin(0.5)
      .setDepth(120)
      .setAlpha(0);
    this.tweens.add({ targets: t, alpha: 1, y: 600, duration: 220, yoyo: true, hold: 420, onComplete: () => t.destroy() });
  }

  private updateHud(): void {
    this.scoreText?.setText(fmtInt(this.score));
    this.movesText?.setText(t('common.movesLeft', { n: this.movesLeft }));
    if (this.scoreText) {
      this.tweens.add({ targets: this.scoreText, scale: { from: 1.12, to: 1 }, duration: 180 });
    }
    this.drawBar();
  }

  private drawBar(): void {
    if (!this.bar) return;
    const w = 480;
    const x = W / 2 - w / 2;
    const y = 196;
    const pct = Math.max(0, Math.min(1, this.score / this.def.target));
    this.bar.clear();
    this.bar.fillStyle(0x16213f, 1);
    this.bar.fillRoundedRect(x, y, w, 14, 7);
    if (pct > 0) {
      this.bar.fillStyle(pct >= 1 ? 0x37e6a6 : 0x3ee0ff, 1);
      this.bar.fillRoundedRect(x, y, Math.max(14, w * pct), 14, 7);
    }
    this.bar.lineStyle(1, 0x2a3d68, 1);
    this.bar.strokeRoundedRect(x, y, w, 14, 7);
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => {
      this.time.delayedCall(ms, () => resolve());
    });
  }

  /** Oyundan menüye dönüş — yarıda bırakma verisi de kaydedilir. */
  private leaveLevel(): void {
    if (this.ready && !this.ended) {
      this.bridge.track('quit', {
        level: this.level,
        score: this.score,
        movesLeft: this.movesLeft,
        progress: Math.min(1, this.score / this.def.target),
      });
    }
    this.ended = true;
    setBackButton(null);
    this.scene.start('Menu');
  }

  // ================= BİTİŞ =================

  private checkEnd(): void {
    if (this.ended) return;
    if (this.movesLeft > 0) return;
    void this.endGame();
  }

  private async endGame(): Promise<void> {
    if (this.ended) return;
    this.ended = true;
    this.busy = true;
    this.clearSelection();

    const won = this.score >= this.def.target;
    const stars = starsFor(this.score, this.def.target);
    const xp = xpFor(this.level, this.score, stars);
    play(won ? 'win' : 'lose');
    haptic(won ? 'success' : 'error');
    this.cameras.main.flash(won ? 220 : 160, won ? 255 : 120, won ? 220 : 40, won ? 150 : 40);

    let xpGained = xp;
    try {
      const outcome = await this.bridge.finish({
        score: this.score,
        durationMs: Date.now() - this.startedAt,
        level: won ? this.level : Math.max(0, this.level - 1),
        xp,
        stats: {
          stars,
          movesUsed: this.def.moves - this.movesLeft,
          maxCombo: this.maxCombo,
          target: this.def.target,
        },
        clientVersion: '0.1.0',
      });
      xpGained = outcome.xpGained;
    } catch {
      /* bağlantı yoksa yerel sonuç gösterilir */
    }

    this.bridge.track('level_end', {
      level: this.level,
      score: this.score,
      won,
      stars,
      maxCombo: this.maxCombo,
    });

    this.showResult(won, stars, xpGained);
  }

  private showResult(won: boolean, stars: number, xpGained: number): void {
    const profile = loadProfile();
    const info = levelInfo(profile.xp);
    const best = profile.games['gem-match']?.bestScore ?? this.score;

    const layer = this.add.container(0, 0).setDepth(200);
    const dim = this.add
      .rectangle(0, 0, W, H, 0x03060d, 0.82)
      .setOrigin(0)
      .setInteractive();
    layer.add(dim);

    const panelY = 380;
    const panel = this.add.graphics();
    panel.fillStyle(0x0e1930, 1);
    panel.fillRoundedRect(70, panelY, W - 140, 520, 30);
    panel.lineStyle(2, won ? 0x2f7a5f : 0x4a2130, 1);
    panel.strokeRoundedRect(70, panelY, W - 140, 520, 30);
    layer.add(panel);

    const title = this.add
      .text(W / 2, panelY + 58, upper(won ? t('game.clear') : t('game.fail')), {
        fontFamily: FONT,
        fontSize: '38px',
        color: won ? PALETTE.success : PALETTE.danger,
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    layer.add(title);

    // Yıldızlar
    for (let i = 0; i < 3; i++) {
      const x = W / 2 + (i - 1) * 96;
      const earned = i < stars;
      const star = this.add
        .image(x, panelY + 152, 'gem2')
        .setDisplaySize(earned ? 78 : 62, earned ? 78 : 62)
        .setTint(earned ? 0xffd166 : 0x24365f)
        .setAlpha(earned ? 1 : 0.5);
      layer.add(star);
      if (earned) {
        star.setScale(0);
        this.tweens.add({
          targets: star,
          scale: 1,
          duration: 380,
          delay: 220 + i * 160,
          ease: 'Back.easeOut',
        });
      }
    }

    const lines: Array<[string, string, string]> = [
      [upper(t('common.score')), fmtInt(this.score), PALETTE.text],
      [upper(t('common.target')), fmtInt(this.def.target), PALETTE.textDim],
      [upper(t('common.best')), fmtInt(best), PALETTE.gold],
      [upper(t('common.xpEarned')), `+${xpGained}`, PALETTE.accent],
    ];
    lines.forEach(([label, value, color], i) => {
      const y = panelY + 232 + i * 46;
      layer.add(
        this.add
          .text(110, y, label, { fontFamily: FONT, fontSize: '19px', color: PALETTE.textDim, fontStyle: 'bold' })
          .setOrigin(0, 0.5)
      );
      layer.add(
        this.add
          .text(W - 110, y, value, { fontFamily: FONT, fontSize: '24px', color, fontStyle: 'bold' })
          .setOrigin(1, 0.5)
      );
    });

    const buttons: Array<{ label: string; primary?: boolean; action: () => void }> = [
      { label: upper(t('common.menu')), action: () => this.scene.start('Menu') },
      { label: upper(t('common.retry')), action: () => this.scene.restart({ level: this.level }) },
    ];
    if (won && this.level < MAX_LEVEL) {
      buttons.push({
        label: upper(t('common.next')),
        primary: true,
        action: () => this.scene.restart({ level: this.level + 1 }),
      });
    } else {
      buttons[1].primary = true;
    }

    const totalW = W - 200;
    const gap = 14;
    const bw = (totalW - gap * (buttons.length - 1)) / buttons.length;
    buttons.forEach((b, i) => {
      const bx = 100 + i * (bw + gap) + bw / 2;
      const by = panelY + 452;
      const g = this.add.graphics();
      g.fillStyle(b.primary ? 0x1ec8ea : 0x18243f, 1);
      g.fillRoundedRect(bx - bw / 2, by - 30, bw, 60, 18);
      if (b.primary) {
        g.fillStyle(0x3ee0ff, 1);
        g.fillRoundedRect(bx - bw / 2, by - 32, bw, 56, 18);
      }
      layer.add(g);

      const label = this.add
        .text(bx, by - 4, b.label, {
          fontFamily: FONT,
          fontSize: '21px',
          color: b.primary ? '#04222b' : PALETTE.text,
          fontStyle: 'bold',
        })
        .setOrigin(0.5);
      layer.add(label);

      const zone = this.add
        .zone(bx, by, bw, 60)
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => {
        unlockAudio();
        play('click');
        b.action();
      });
      layer.add(zone);
    });

    layer.add(
      this.add
        .text(W / 2, panelY + 505, t('common.levelOf', { level: info.level, title: info.title }), {
          fontFamily: FONT,
          fontSize: '16px',
          color: PALETTE.textDim,
        })
        .setOrigin(0.5)
    );

    layer.setAlpha(0);
    this.tweens.add({ targets: layer, alpha: 1, duration: 260 });
  }
}
