import Phaser from 'phaser';
import { H, LAYOUT, PALETTE, W } from '../theme.js';
import {
  bonusCount,
  COMBO_WINDOW_MS,
  HINTS_PER_LEVEL,
  levelDef,
  MAX_EXTRA_SECONDS,
  MAX_LEVEL,
  scoreWord,
  starsFor,
  tierFor,
  timeBonusFor,
  xpFor,
  type LevelDef,
} from '../core/levels.js';
import {
  boardSize,
  COLS,
  hexPos,
  HEX_SIZE,
  isAdjacent,
  ROWS,
} from '../core/hex.js';
import {
  checkPath,
  findHint,
  generateBoard,
  pickBonusCells,
  type Board,
  type CheckResult,
} from '../core/board.js';
import { display, type WordLang } from '../core/words.js';
import {
  createBridge,
  createRng,
  fmtInt,
  levelInfo,
  loadProfile,
  play,
  t,
  unlockAudio,
  upper,
  type GameBridge,
  type SessionInfo,
} from '../../../shared/game-kit/src/index.js';
import type { Rng } from '../../../shared/game-kit/src/rng.js';
import { haptic, setBackButton } from '../telegram.js';
import { getLang } from '../strings.js';

const FONT = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';

export class GameScene extends Phaser.Scene {
  private bridge!: GameBridge;
  private session!: SessionInfo;
  private rng!: Rng;
  private def!: LevelDef;
  private lang: WordLang = 'tr';

  private level = 1;
  private board: Board = [];
  private planted: string[] = [];
  private found = new Set<string>();
  private foundOrder: string[] = [];
  private combo = 0;
  private maxCombo = 0;
  private score = 0;
  private secondsLeft = 0;
  private startedAt = 0;

  private path: number[] = [];
  private originX = 0;
  private originY = 0;

  private ready = false;
  private ended = false;

  private hexViews: Phaser.GameObjects.Image[] = [];
  private hexGlows: Phaser.GameObjects.Image[] = [];
  private letterTexts: Phaser.GameObjects.Text[] = [];
  private hexOnFlags: boolean[] = [];
  private pathG!: Phaser.GameObjects.Graphics;
  private scoreText!: Phaser.GameObjects.Text;
  private timeText!: Phaser.GameObjects.Text;
  private foundText!: Phaser.GameObjects.Text;
  private wordText!: Phaser.GameObjects.Text;
  private feedbackText!: Phaser.GameObjects.Text;
  private bar!: Phaser.GameObjects.Graphics;
  private timerEvent?: Phaser.Time.TimerEvent;
  private hintsLeft = HINTS_PER_LEVEL;
  private hintCount = 0;
  private hintText!: Phaser.GameObjects.Text;
  private hintG!: Phaser.GameObjects.Graphics;

  // Evrim: bonus petekler, kombo süresi, efektler
  private bonus = new Set<number>();
  private bonusMarks: Phaser.GameObjects.Image[] = [];
  private comboText!: Phaser.GameObjects.Text;
  private comboG!: Phaser.GameObjects.Graphics;
  private starMarks: Phaser.GameObjects.Image[] = [];
  private burst!: Phaser.GameObjects.Particles.ParticleEmitter;
  private dangerFx!: Phaser.GameObjects.Rectangle;
  private starsLit = 0;
  private shownScore = -1;
  private lastWordAt = 0;

  constructor() {
    super('Game');
  }

  init(data: { level?: number }): void {
    this.level = Math.max(1, Number(data?.level) || 1);
    this.def = levelDef(this.level);
    this.score = 0;
    this.secondsLeft = this.def.seconds;
    this.combo = 0;
    this.maxCombo = 0;
    this.found = new Set();
    this.foundOrder = [];
    this.path = [];
    this.ready = false;
    this.ended = false;
    this.board = [];
    this.hexViews = [];
    this.hexGlows = [];
    this.letterTexts = [];
    this.hexOnFlags = [];
    this.hintsLeft = HINTS_PER_LEVEL;
    this.hintCount = 0;
    this.bonus = new Set();
    this.bonusMarks = [];
    this.starMarks = [];
    this.starsLit = 0;
    this.shownScore = -1;
    this.lastWordAt = 0;
  }

  create(): void {
    this.lang = getLang();
    this.bridge = createBridge('word-hunt');
    this.buildBackground();
    this.buildHud();
    this.buildBoard();
    this.buildFx();

    this.input.on('pointerdown', this.onDown, this);
    this.input.on('pointermove', this.onMove, this);
    this.input.on('pointerup', this.onUp, this);

    setBackButton(() => this.leaveLevel());
    this.events.once('shutdown', () => {
      setBackButton(null);
      this.timerEvent?.remove();
    });

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
    g.fillGradientStyle(0x0f1b3a, 0x0f1b3a, 0x04060d, 0x04060d, 1);
    g.fillRect(0, 0, W, H);

    this.add
      .image(W / 2, 640, 'dot')
      .setDisplaySize(1100, 1100)
      .setAlpha(0.14)
      .setTint(0xffb347)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.add
      .image(110, 1190, 'dot')
      .setDisplaySize(720, 720)
      .setAlpha(0.1)
      .setTint(0x2dd4bf)
      .setBlendMode(Phaser.BlendModes.ADD);

    // Yavaşça süzülen derinlik petekleri (görsel rastgelelik de seed'li).
    const vr = createRng(0xbee5);
    for (let i = 0; i < 14; i++) {
      const x = vr.next() * W;
      const y = vr.next() * H;
      const hex = this.add
        .image(x, y, 'hex')
        .setScale(0.35 + vr.next() * 0.8)
        .setAlpha(0.05 + vr.next() * 0.07)
        .setTint(0x4a7bd6)
        .setAngle(vr.int(0, 60));
      this.tweens.add({
        targets: hex,
        y: y - 160 - vr.next() * 200,
        angle: hex.angle + 40,
        alpha: 0.02,
        duration: 14000 + vr.int(0, 12000),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    // Son 10 saniyede kenarlarda kırmızı nabız.
    this.dangerFx = this.add.rectangle(0, 0, W, H, 0xff1744, 1).setOrigin(0).setDepth(90).setAlpha(0);
  }

  private buildFx(): void {
    this.burst = this.add
      .particles(0, 0, 'spark', {
        lifespan: { min: 380, max: 840 },
        speed: { min: 90, max: 360 },
        angle: { min: 0, max: 360 },
        scale: { start: 0.9, end: 0 },
        alpha: { start: 1, end: 0 },
        gravityY: 380,
        tint: [0xffd166, 0xff9f43, 0xfff3c4, 0x7dffe0],
        blendMode: Phaser.BlendModes.ADD,
        emitting: false,
      })
      .setDepth(250);
  }

  private buildHud(): void {
    const panel = this.add.graphics();
    panel.fillStyle(0x000000, 0.3);
    panel.fillRoundedRect(30, 48, W - 56, 184, 28);
    panel.fillStyle(0x14223f, 0.94);
    panel.fillRoundedRect(28, 40, W - 56, 184, 28);
    panel.fillStyle(0xffffff, 0.05);
    panel.fillRoundedRect(28, 40, W - 56, 72, { tl: 28, tr: 28, bl: 0, br: 0 });
    panel.lineStyle(2, 0x34507f, 1);
    panel.strokeRoundedRect(28, 40, W - 56, 184, 28);
    panel.lineStyle(1.5, 0xffd166, 0.18);
    panel.strokeRoundedRect(31, 43, W - 62, 178, 25);

    this.add
      .text(56, 66, upper(t('game.levelLabel', { n: this.def.level })), {
        fontFamily: FONT,
        fontSize: '18px',
        color: PALETTE.textDim,
        fontStyle: 'bold',
      })
      .setLetterSpacing(2)
      .setDepth(100);

    this.timeText = this.add
      .text(W - 56, 62, '', {
        fontFamily: FONT,
        fontSize: '28px',
        color: PALETTE.text,
        fontStyle: 'bold',
      })
      .setOrigin(1, 0)
      .setDepth(100);

    this.scoreText = this.add
      .text(W / 2, 118, '0', {
        fontFamily: FONT,
        fontSize: '58px',
        color: PALETTE.accent,
        fontStyle: 'bold',
        stroke: '#5a3a00',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(100);

    // Kombo rozeti + sönme çubuğu (update() içinde çizilir)
    this.comboText = this.add
      .text(56, 98, '', {
        fontFamily: FONT,
        fontSize: '22px',
        color: PALETTE.accent2,
        fontStyle: 'bold',
      })
      .setDepth(100);
    this.comboG = this.add.graphics().setDepth(100);

    this.bar = this.add.graphics().setDepth(100);
    // Yıldız işaretleri: hedef (1★), %140 (2★), %200 (3★). Çubuk 0 → 2×hedef.
    this.starMarks = [0.5, 0.7, 1].map((f) =>
      this.add
        .image(W / 2 - 240 + 480 * f, 175, 'star5')
        .setDisplaySize(24, 24)
        .setTint(0x24365f)
        .setDepth(102)
    );

    this.foundText = this.add
      .text(W / 2, 198, '', {
        fontFamily: FONT,
        fontSize: '17px',
        color: PALETTE.textDim,
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(100);

    this.updateHud();
  }

  private buildBoard(): void {
    const size = boardSize();
    this.originX = LAYOUT.boardX - size.w / 2;
    this.originY = LAYOUT.boardTop;

    const frame = this.add.graphics();
    frame.fillStyle(0xffd166, 0.035);
    frame.fillRoundedRect(this.originX - 28, this.originY - 28, size.w + 56, size.h + 56, 34);
    frame.fillStyle(0x0a1226, 0.88);
    frame.fillRoundedRect(this.originX - 16, this.originY - 16, size.w + 32, size.h + 32, 24);
    frame.lineStyle(2, 0x6a552e, 0.9);
    frame.strokeRoundedRect(this.originX - 16, this.originY - 16, size.w + 32, size.h + 32, 24);

    // İp peteklerin ÜSTÜNDE, harflerin altında kalsın ki seçim yolu görünsün.
    this.pathG = this.add.graphics().setDepth(9);

    this.wordText = this.add
      .text(W / 2, 1160, '', {
        fontFamily: FONT,
        fontSize: '46px',
        color: PALETTE.accent,
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(30);

    this.feedbackText = this.add
      .text(W / 2, 1210, t('game.minLength', { n: this.def.minLength }), {
        fontFamily: FONT,
        fontSize: '18px',
        color: PALETTE.textDim,
      })
      .setOrigin(0.5)
      .setDepth(30);

    this.hintG = this.add.graphics().setDepth(8);
    this.buildHintButton();
  }

  // ================= İPUCU =================

  private buildHintButton(): void {
    const x = W - 96;
    const y = 1160;
    const g = this.add.graphics().setDepth(30);
    g.fillStyle(0x18243f, 1);
    g.fillRoundedRect(x - 72, y - 30, 144, 60, 18);
    g.lineStyle(2, 0xffd166, 0.9);
    g.strokeRoundedRect(x - 72, y - 30, 144, 60, 18);

    this.hintText = this.add
      .text(x, y - 2, '', {
        fontFamily: FONT,
        fontSize: '20px',
        color: PALETTE.accent,
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(31);
    this.refreshHintLabel();

    const zone = this.add.zone(x, y, 144, 60).setOrigin(0.5).setDepth(32).setInteractive({ useHandCursor: true });
    zone.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
      ev?.stopPropagation?.();
      unlockAudio();
      this.useHint();
    });
  }

  private refreshHintLabel(): void {
    this.hintText?.setText(upper(t('game.hintLeft', { n: this.hintsLeft })));
    this.hintText?.setAlpha(this.hintsLeft > 0 ? 1 : 0.4);
  }

  private useHint(): void {
    if (!this.ready || this.ended) return;
    if (this.hintsLeft <= 0) {
      this.feedbackText.setText(t('game.hintNone')).setColor(PALETTE.danger);
      play('invalid');
      return;
    }
    const hint = findHint(this.board, this.planted, this.found);
    if (!hint) {
      this.feedbackText.setText(t('game.hintEmpty')).setColor(PALETTE.textDim);
      return;
    }
    this.hintsLeft -= 1;
    this.hintCount += 1;
    this.refreshHintLabel();
    play('hint');
    haptic('light');
    this.bridge.track('hint_used', { level: this.level, length: hint.word.length });

    // Sadece ilk iki hücreyi ve yönü göster; kelimeyi tamamen verme.
    const shown = hint.path.slice(0, 2);
    this.hintG.clear();
    this.hintG.lineStyle(6, 0xffd166, 0.95);
    this.hintG.beginPath();
    shown.forEach((i, k) => {
      const p = this.posOf(i);
      if (k === 0) this.hintG.moveTo(this.originX + p.x, this.originY + p.y);
      else this.hintG.lineTo(this.originX + p.x, this.originY + p.y);
    });
    this.hintG.strokePath();
    this.hintG.setAlpha(1);
    this.tweens.add({ targets: this.hintG, alpha: 0, duration: 400, delay: 1800 });
    this.feedbackText
      .setText(t('game.hintLength', { n: hint.word.length }))
      .setColor(PALETTE.accent);
  }

  private begin(): void {
    const gen = generateBoard(this.rng, this.lang, this.def.plantCount);
    this.board = gen.cells;
    this.planted = gen.planted;
    // Bonus petekler tahtadan SONRA seçilir: aynı seed → aynı tahta + aynı bonuslar.
    this.bonus = new Set(pickBonusCells(this.rng, bonusCount(this.level)));
    play('whoosh');

    for (let i = 0; i < COLS * ROWS; i++) {
      const p = this.posOf(i);
      const x = this.originX + p.x;
      const y = this.originY + p.y;

      const glow = this.add
        .image(x, y, 'dot')
        .setDisplaySize(HEX_SIZE * 2.9, HEX_SIZE * 2.9)
        .setTint(0xffd166)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(0)
        .setDepth(4);

      const img = this.add
        .image(x, y, this.bonus.has(i) ? 'hexBonus' : 'hex')
        .setDisplaySize(HEX_SIZE * 2 + 28, HEX_SIZE * 2 + 28)
        .setDepth(6)
        .setAlpha(0)
        .setScale(0.35);

      const letter = this.add
        .text(x, y - 3, display(this.board[i].letter, this.lang), {
          fontFamily: FONT,
          fontSize: '38px',
          color: PALETTE.hexText,
          fontStyle: 'bold',
          stroke: '#04202a',
          strokeThickness: 3,
        })
        .setOrigin(0.5)
        .setDepth(10)
        .setAlpha(0);

      const mark = this.add
        .image(x + HEX_SIZE * 0.5, y - HEX_SIZE * 0.58, 'star5')
        .setDisplaySize(22, 22)
        .setTint(0xf6dcff)
        .setDepth(12)
        .setAlpha(0);

      this.hexGlows.push(glow);
      this.hexViews.push(img);
      this.letterTexts.push(letter);
      this.bonusMarks.push(mark);
      this.hexOnFlags.push(false);

      const delay = (i % COLS) * 22 + Math.floor(i / COLS) * 26;
      this.tweens.add({ targets: img, alpha: 1, scale: 1, duration: 420, ease: 'Back.easeOut', delay });
      this.tweens.add({ targets: letter, alpha: 1, duration: 280, delay: delay + 120 });
    }
    for (const i of this.bonus) this.setBonus(i, true, 700);

    this.startedAt = Date.now();
    this.lastWordAt = this.time.now;
    this.ready = true;
    this.bridge.track('level_start', { level: this.level, lang: this.lang });

    this.timerEvent = this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        if (this.ended) return;
        this.secondsLeft = Math.max(0, this.secondsLeft - 1);
        this.updateHud();
        if (this.secondsLeft > 0 && this.secondsLeft <= 10) this.dangerPulse();
        if (this.secondsLeft === 0) void this.endGame();
      },
    });
  }

  private posOf(i: number): { x: number; y: number } {
    return hexPos(i);
  }

  // ================= GİRDİ =================

  private cellAt(x: number, y: number): number {
    let best = -1;
    let bestDist = (HEX_SIZE * 0.94) ** 2;
    for (let i = 0; i < this.board.length; i++) {
      const p = this.posOf(i);
      const dx = this.originX + p.x - x;
      const dy = this.originY + p.y - y;
      const d = dx * dx + dy * dy;
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    return best;
  }

  private onDown(pointer: Phaser.Input.Pointer): void {
    unlockAudio();
    if (!this.ready || this.ended) return;
    const cell = this.cellAt(pointer.x, pointer.y);
    if (cell < 0) return;
    this.path = [cell];
    this.refreshPath();
    play('select', this.path.length);
  }

  private onMove(pointer: Phaser.Input.Pointer): void {
    if (!this.ready || this.ended || !pointer.isDown || this.path.length === 0) return;
    const cell = this.cellAt(pointer.x, pointer.y);
    if (cell < 0) return;
    const last = this.path[this.path.length - 1];
    if (cell === last) return;

    if (this.path.length >= 2 && cell === this.path[this.path.length - 2]) {
      this.path.pop();
      this.refreshPath();
      return;
    }
    if (this.path.includes(cell)) return;
    if (!isAdjacent(last, cell)) return;

    this.path.push(cell);
    this.refreshPath();
    play('select', this.path.length);
  }

  private onUp(): void {
    if (!this.ready || this.ended || this.path.length === 0) return;
    const result = checkPath(this.board, this.path, this.lang, this.def.minLength, this.found);
    if (result.ok) this.acceptWord(result);
    else this.rejectWord(result);
    this.clearPath();
  }

  private acceptWord(result: CheckResult): void {
    const cells = [...this.path];
    const bonusUsed = cells.filter((i) => this.bonus.has(i));
    const len = result.word.length;

    this.found.add(result.word);
    this.foundOrder.push(result.word);
    this.combo += 1;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.lastWordAt = this.time.now;

    const gained = scoreWord(len, this.combo, this.level, bonusUsed.length);
    this.score += gained;

    const extra = timeBonusFor(len, bonusUsed.length);
    if (extra > 0) {
      this.secondsLeft = Math.min(this.def.seconds + MAX_EXTRA_SECONDS, this.secondsLeft + extra);
    }
    const tier = tierFor(len);

    let cx = 0;
    let cy = 0;
    for (const i of cells) {
      const p = this.posOf(i);
      cx += this.originX + p.x;
      cy += this.originY + p.y;
    }
    cx /= cells.length;
    cy /= cells.length;

    this.wordText.setText(display(result.word, this.lang));
    this.feedbackText
      .setText(`+${fmtInt(gained)}  ${t(`game.tier${tier}`)}`)
      .setColor(PALETTE.success);

    play('word', len);
    if (this.combo >= 3) play('match', this.combo);
    haptic(tier >= 2 || this.combo >= 3 ? 'success' : 'light');

    this.flashPath(cells);
    this.burst.emitParticleAt(cx, cy, 14 + len * 4);
    this.popup(cx, cy - 24, `+${fmtInt(gained)}`, tier >= 2 ? '#ffd166' : '#37e6a6', 34 + tier * 8);
    if (extra > 0) {
      this.popup(W - 120, 108, upper(t('game.bonusTime', { n: extra })), '#7dffe0', 26);
    }

    // Bonus petekler kullanılınca yeni yerlere taşınır.
    if (bonusUsed.length) {
      play('bonus');
      for (const i of bonusUsed) {
        this.bonus.delete(i);
        this.setBonus(i, false);
      }
      const taken = new Set<number>([...this.bonus, ...cells]);
      for (const i of pickBonusCells(this.rng, bonusUsed.length, COLS * ROWS, taken)) {
        this.bonus.add(i);
        this.setBonus(i, true);
      }
    }

    if (tier >= 2) this.cameras.main.shake(130, 0.003 + tier * 0.001);
    if (tier >= 3) {
      this.cameras.main.flash(180, 255, 215, 120);
      this.burst.emitParticleAt(W / 2, 640, 60);
      play('whoosh');
    }
    this.updateHud();

    this.bridge.track('word_found', {
      level: this.level,
      word: result.word,
      length: len,
      points: gained,
      combo: this.combo,
      bonus: bonusUsed.length,
      extraSeconds: extra,
    });

    const list = this.foundOrder.slice(-4).map((w) => display(w, this.lang)).join('  ·  ');
    this.time.delayedCall(900, () => {
      if (this.ended) return;
      this.feedbackText.setText(list).setColor(PALETTE.textDim);
      this.wordText.setText('');
    });
  }

  private rejectWord(result: CheckResult): void {
    const msg =
      result.reason === 'short'
        ? t('common.tooShort')
        : result.reason === 'duplicate'
          ? t('common.alreadyFound')
          : t('common.notAWord');
    this.feedbackText.setText(msg).setColor(PALETTE.danger);
    play('invalid');
    haptic('error');
    this.cameras.main.shake(90, 0.0025);
    // Geçersiz kelime komboyu bozar; kısa/tekrar denemeler bozmaz.
    if (result.reason === 'invalid' && this.combo > 0) {
      this.combo = 0;
      this.updateHud();
    }
  }

  // ================= EFEKTLER =================

  private ring(x: number, y: number, color: number): void {
    const r = this.add
      .image(x, y, 'ring')
      .setTint(color)
      .setAlpha(0.9)
      .setScale(0.5)
      .setDepth(20)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: r,
      scale: 1.7,
      alpha: 0,
      duration: 380,
      ease: 'Cubic.easeOut',
      onComplete: () => r.destroy(),
    });
  }

  private popup(x: number, y: number, text: string, color: string, size: number): void {
    const tx = this.add
      .text(x, y, text, {
        fontFamily: FONT,
        fontSize: `${size}px`,
        color,
        fontStyle: 'bold',
        stroke: '#05070f',
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(80);
    this.tweens.add({
      targets: tx,
      y: y - 80,
      alpha: 0,
      scale: 1.2,
      duration: 900,
      ease: 'Cubic.easeOut',
      onComplete: () => tx.destroy(),
    });
  }

  /** Bulunan kelimenin yolu altın renkte parlayıp söner. */
  private flashPath(cells: number[]): void {
    const g = this.add.graphics().setDepth(9);
    g.lineStyle(12, 0xffd166, 0.95);
    g.beginPath();
    cells.forEach((i, k) => {
      const p = this.posOf(i);
      const x = this.originX + p.x;
      const y = this.originY + p.y;
      if (k === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    });
    g.strokePath();
    this.tweens.add({ targets: g, alpha: 0, duration: 420, onComplete: () => g.destroy() });
  }

  /** Bonus peteğin mor dokusunu ve nabız atan yıldızını açar/kapatır. */
  private setBonus(i: number, on: boolean, delay = 0): void {
    const mark = this.bonusMarks[i];
    const img = this.hexViews[i];
    if (!mark || !img) return;
    this.tweens.killTweensOf(mark);
    if (!this.hexOnFlags[i]) img.setTexture(on ? 'hexBonus' : 'hex');
    if (on) {
      mark.setAlpha(0).setScale(22 / 64);
      this.tweens.add({
        targets: mark,
        scale: 0.46,
        alpha: { from: 0.55, to: 1 },
        duration: 700,
        yoyo: true,
        repeat: -1,
        delay,
        ease: 'Sine.easeInOut',
      });
    } else {
      mark.setAlpha(0);
    }
  }

  private dangerPulse(): void {
    play('tick');
    this.tweens.add({ targets: this.timeText, scale: { from: 1.3, to: 1 }, duration: 280 });
    this.dangerFx.setAlpha(0.2);
    this.tweens.add({ targets: this.dangerFx, alpha: 0, duration: 700 });
  }

  private celebrate(): void {
    const spots: Array<[number, number]> = [
      [W * 0.25, 520],
      [W * 0.75, 520],
      [W / 2, 420],
    ];
    spots.forEach(([x, y], k) =>
      this.time.delayedCall(k * 180, () => {
        this.burst.emitParticleAt(x, y, 48);
        this.ring(x, y, 0xffd166);
      })
    );
  }

  /** Kombo çubuğu her karede yavaşça söner; süre dolunca kombo biter. */
  update(): void {
    if (!this.comboG) return;
    this.comboG.clear();
    if (this.combo <= 0 || this.ended) return;
    const left = 1 - (this.time.now - this.lastWordAt) / COMBO_WINDOW_MS;
    if (left <= 0) {
      this.combo = 0;
      this.updateHud();
      return;
    }
    this.comboG.fillStyle(0x24365f, 1);
    this.comboG.fillRoundedRect(56, 130, 150, 6, 3);
    this.comboG.fillStyle(left < 0.3 ? 0xff5d6c : 0xff9f43, 1);
    this.comboG.fillRoundedRect(56, 130, Math.max(6, 150 * left), 6, 3);
  }

  private clearPath(): void {
    this.path = [];
    this.refreshPath();
  }

  private refreshPath(): void {
    this.pathG.clear();
    if (this.path.length >= 2) {
      // Tek renk, net kırmızı ip — seçilen peteklerin üstünde, harflerin altında.
      this.pathG.lineStyle(7, 0xff1744, 1);
      this.pathG.beginPath();
      const first = this.posOf(this.path[0]);
      this.pathG.moveTo(this.originX + first.x, this.originY + first.y);
      for (let k = 1; k < this.path.length; k++) {
        const p = this.posOf(this.path[k]);
        this.pathG.lineTo(this.originX + p.x, this.originY + p.y);
      }
      this.pathG.strokePath();
      // Bağlantı noktaları da kırmızı olsun ki yön daha net görünsün.
      this.pathG.fillStyle(0xff1744, 1);
      for (const i of this.path) {
        const p = this.posOf(i);
        this.pathG.fillCircle(this.originX + p.x, this.originY + p.y, 5);
      }
    }

    for (let i = 0; i < this.hexViews.length; i++) {
      const on = this.path.includes(i);
      if (on === !!this.hexOnFlags[i]) continue;
      this.hexOnFlags[i] = on;

      const p = this.posOf(i);
      const baseX = this.originX + p.x;
      const baseY = this.originY + p.y;
      const img = this.hexViews[i];
      const letter = this.letterTexts[i];
      const glow = this.hexGlows[i];

      this.tweens.killTweensOf([img, letter, glow]);

      if (on) {
        img.setTexture('hexOn');
        this.ring(baseX, baseY, 0xffd166);
        img.setPosition(baseX, baseY + 7).setScale(0.86);
        this.tweens.add({
          targets: img,
          y: baseY,
          scale: 1,
          duration: 230,
          ease: 'Back.easeOut',
        });
        this.tweens.add({ targets: glow, alpha: 0.8, duration: 170 });
        // Harf seçilince yükselip büyür.
        letter.setColor(PALETTE.hexTextOn).setScale(0.92).setY(baseY + 3);
        this.tweens.add({
          targets: letter,
          y: baseY - 12,
          scale: 1.3,
          duration: 240,
          ease: 'Back.easeOut',
        });
      } else {
        img.setTexture(this.bonus.has(i) ? 'hexBonus' : 'hex');
        this.tweens.add({
          targets: img,
          y: baseY,
          scale: 1,
          duration: 180,
          ease: 'Sine.easeOut',
        });
        this.tweens.add({ targets: glow, alpha: 0, duration: 140 });
        letter.setColor(PALETTE.hexText).setScale(1).setY(baseY - 3);
        this.tweens.add({
          targets: letter,
          y: baseY - 3,
          scale: 1,
          duration: 150,
          ease: 'Sine.easeOut',
        });
      }
    }

    const w = this.path.map((i) => this.board[i].letter).join('');
    this.wordText.setText(w ? display(w, this.lang) : '');
  }

  private updateHud(): void {
    if (this.scoreText && this.score !== this.shownScore) {
      this.shownScore = this.score;
      this.scoreText.setText(fmtInt(this.score));
      this.tweens.add({ targets: this.scoreText, scale: { from: 1.14, to: 1 }, duration: 200 });
    }
    this.timeText?.setText(`${upper(t('common.time'))} ${this.secondsLeft}`);
    this.timeText?.setColor(this.secondsLeft <= 10 ? PALETTE.danger : PALETTE.text);
    this.foundText?.setText(
      `${t('common.found')} ${this.found.size} ${t('common.words')}  •  ${t('game.minLength', { n: this.def.minLength })}`
    );
    this.comboText?.setText(this.combo >= 2 ? upper(t('common.combo', { n: this.combo })) : '');
    if (!this.bar) return;

    const w = 480;
    const x = W / 2 - w / 2;
    const y = 168;
    // Çubuk 0 → 2×hedef; yıldız işaretleri 1×, 1.4×, 2× noktalarında.
    const pct = Math.max(0, Math.min(1, this.score / (this.def.target * 2)));
    this.bar.clear();
    this.bar.fillStyle(0x0c1530, 1);
    this.bar.fillRoundedRect(x, y, w, 14, 7);
    if (pct > 0) {
      const fw = Math.max(14, w * pct);
      this.bar.fillStyle(pct >= 0.5 ? 0x37e6a6 : 0xffb347, 1);
      this.bar.fillRoundedRect(x, y, fw, 14, 7);
      this.bar.fillStyle(0xffffff, 0.28);
      this.bar.fillRoundedRect(x + 3, y + 2, Math.max(8, fw - 6), 4, 2);
    }
    this.bar.lineStyle(1, 0x34507f, 1);
    this.bar.strokeRoundedRect(x, y, w, 14, 7);

    const stars = starsFor(this.score, this.def.target);
    this.starMarks.forEach((m, k) => m.setTint(k < stars ? 0xffd166 : 0x24365f));
    if (stars > this.starsLit) {
      this.starsLit = stars;
      const m = this.starMarks[stars - 1];
      if (m && this.burst) {
        play('star', stars);
        this.burst.emitParticleAt(m.x, m.y, 18);
        this.tweens.add({ targets: m, scale: { from: 0.9, to: 24 / 64 }, duration: 420, ease: 'Back.easeOut' });
      }
    }
  }

  private leaveLevel(): void {
    if (this.ready && !this.ended) {
      this.bridge.track('quit', {
        level: this.level,
        score: this.score,
        found: this.found.size,
        secondsLeft: this.secondsLeft,
      });
    }
    this.ended = true;
    this.timerEvent?.remove();
    setBackButton(null);
    this.scene.start('Menu');
  }

  // ================= BİTİŞ =================

  private async endGame(): Promise<void> {
    if (this.ended) return;
    this.ended = true;
    this.timerEvent?.remove();
    this.clearPath();
    this.bridge.track('level_start_end', { level: this.level });

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
          found: this.found.size,
          maxCombo: this.maxCombo,
          hints: this.hintCount,
          target: this.def.target,
        },
        clientVersion: '0.1.0',
      });
      xpGained = outcome.xpGained;
    } catch {
      /* bağlantı yoksa yerel sonuç */
    }

    this.showResult(won, stars, xpGained);
  }

  private showResult(won: boolean, stars: number, xpGained: number): void {
    const profile = loadProfile();
    const info = levelInfo(profile.xp);
    const best = profile.games['word-hunt']?.bestScore ?? this.score;

    const layer = this.add.container(0, 0).setDepth(200);
    const dim = this.add
      .rectangle(0, 0, W, H, 0x03060d, 0.84)
      .setOrigin(0)
      .setInteractive();
    layer.add(dim);

    const panelY = 380;
    const panel = this.add.graphics();
    panel.fillStyle(0x101b30, 1);
    panel.fillRoundedRect(70, panelY, W - 140, 520, 30);
    panel.lineStyle(2, won ? 0x2f7a5f : 0x4a2130, 1);
    panel.strokeRoundedRect(70, panelY, W - 140, 520, 30);
    layer.add(panel);

    const title = this.add
      .text(W / 2, panelY + 58, upper(won ? t('game.won') : t('game.lost')), {
        fontFamily: FONT,
        fontSize: '36px',
        color: won ? PALETTE.success : PALETTE.danger,
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    layer.add(title);

    for (let i = 0; i < 3; i++) {
      const x = W / 2 + (i - 1) * 96;
      const earned = i < stars;
      const star = this.add
        .image(x, panelY + 152, 'star5')
        .setDisplaySize(earned ? 72 : 56, earned ? 72 : 56)
        .setTint(earned ? 0xffd166 : 0x24365f)
        .setAlpha(earned ? 1 : 0.5);
      layer.add(star);
      if (earned) {
        star.setScale(0);
        this.tweens.add({
          targets: star,
          scale: 72 / 64,
          duration: 380,
          delay: 220 + i * 160,
          ease: 'Back.easeOut',
        });
      }
    }

    const lines: Array<[string, string, string]> = [
      [upper(t('common.score')), fmtInt(this.score), PALETTE.text],
      [upper(t('common.target')), fmtInt(this.def.target), PALETTE.textDim],
      [upper(t('common.best')), fmtInt(best), PALETTE.accent],
      [upper(t('common.found')), `${this.found.size} ${t('common.words')}`, PALETTE.textDim],
      [upper(t('common.xpEarned')), `+${xpGained}`, PALETTE.success],
    ];
    lines.forEach(([label, value, color], i) => {
      const y = panelY + 224 + i * 44;
      layer.add(
        this.add
          .text(110, y, label, {
            fontFamily: FONT,
            fontSize: '18px',
            color: PALETTE.textDim,
            fontStyle: 'bold',
          })
          .setOrigin(0, 0.5)
      );
      layer.add(
        this.add
          .text(W - 110, y, value, {
            fontFamily: FONT,
            fontSize: '22px',
            color,
            fontStyle: 'bold',
          })
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
      const by = panelY + 470;
      const g = this.add.graphics();
      g.fillStyle(b.primary ? 0xe8a93c : 0x18243f, 1);
      g.fillRoundedRect(bx - bw / 2, by - 30, bw, 60, 18);
      if (b.primary) {
        g.fillStyle(0xffd166, 1);
        g.fillRoundedRect(bx - bw / 2, by - 32, bw, 56, 18);
      }
      layer.add(g);
      layer.add(
        this.add
          .text(bx, by - 4, b.label, {
            fontFamily: FONT,
            fontSize: '21px',
            color: b.primary ? '#3a2500' : PALETTE.text,
            fontStyle: 'bold',
          })
          .setOrigin(0.5)
      );
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
    if (won) this.celebrate();
  }
}
