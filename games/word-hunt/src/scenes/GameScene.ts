
import Phaser from 'phaser';
import { H, LAYOUT, PALETTE, W } from '../theme.js';
import {
  bonusCount,
  chestValues,
  COMBO_WINDOW_MS,
  comboMilestone,
  FEVER_MS,
  feverGain,
  GOLDEN_MS,
  FRENZY_MS,
  jokerCount,
  letterSpecialCount,
  lengthReward,
  multiplierFor,
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
  checkPathJoker,
  findHint,
  generateBoard,
  pickBonusCells,
  type Board,
  type CheckResult,
} from '../core/board.js';
import { display, type WordLang } from '../core/words.js';
import { addButton } from '../ui.js';
import {
  addMissionProgress,
  DAILY_BONUS_XP,
  dailyDone,
  dailyLevel,
  dailySeed,
  dayKey,
  loadMeta,
  newAchievements,
  saveMeta,
  streakBonusXp,
  takePendingXp,
  touchDay,
  type Meta,
} from '../core/meta.js';
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
  private hexShadows: Phaser.GameObjects.Image[] = [];
  private confetti!: Phaser.GameObjects.Particles.ParticleEmitter;
  private freezeUntil = 0;
  private feverTinted = false;
  private shownTimeColor = '';
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

  // Evrim & Bonuslar
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

  // Fırsatlar: Joker, Ateş, Altın An, Hazine
  private jokers = new Set<number>();
  private treasure = '';
  private treasureText!: Phaser.GameObjects.Text;
  private modeText!: Phaser.GameObjects.Text;
  private feverG!: Phaser.GameObjects.Graphics;
  private modeFx!: Phaser.GameObjects.Graphics;
  private feverMeter = 0;
  private feverUntil = 0;
  private goldenUntil = 0;
  private goldenFired = new Set<number>();
  private shownMode = '';
  private meta!: Meta;
  private daily = false;
  private resultNote = '';
  private toastQueue: string[] = [];
  private toasting = false;

  // Gelişmiş Özellikler
  private frenzyUntil = 0;
  private frenzyMult = 1;
  private rainbowUntil = 0;
  private letterSpecial = new Map<number, { type: 'x2' | '+50'; text: Phaser.GameObjects.Text }>();
  private mascotBee?: Phaser.GameObjects.Image;
  private mascotCell = -1;
  private mascotTimer?: Phaser.Time.TimerEvent;

  constructor() {
    super('Game');
  }

  init(data: { level?: number; daily?: boolean }): void {
    this.daily = !!data?.daily;
    this.level = this.daily ? dailyLevel(dayKey(Date.now())) : Math.max(1, Number(data?.level) || 1);
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
    this.hexShadows = [];
    this.freezeUntil = 0;
    this.feverTinted = false;
    this.shownTimeColor = '';
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
    this.jokers = new Set();
    this.treasure = '';
    this.feverMeter = 0;
    this.feverUntil = 0;
    this.goldenUntil = 0;
    this.goldenFired = new Set();
    this.shownMode = '';
    this.resultNote = '';
    this.toastQueue = [];
    this.toasting = false;

    this.frenzyUntil = 0;
    this.frenzyMult = 1;
    this.rainbowUntil = 0;
    this.letterSpecial = new Map();
    this.mascotCell = -1;
  }

  create(): void {
    this.lang = getLang();
    this.meta = loadMeta();
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
      this.mascotTimer?.remove();
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
        this.rng = createRng(this.daily ? dailySeed(dayKey(Date.now())) : s.seed);
        loading.destroy();
        this.begin();
      })
      .catch(() => {
        loading.setText(t('game.sessionError')).setAlign('center');
      });
  }

  // ================= KURULUM (Göz yormayan berrak derin mavi & safir arka plan) =================

  private buildBackground(): void {
    const g = this.add.graphics();
    g.fillGradientStyle(0x0a1628, 0x0a1628, 0x040812, 0x040812, 1);
    g.fillRect(0, 0, W, H);

    this.add
      .image(W / 2, 640, 'dot')
      .setDisplaySize(1100, 1100)
      .setAlpha(0.08)
      .setTint(0x0ea5e9)
      .setBlendMode(Phaser.BlendModes.ADD);

    this.add
      .image(110, 1190, 'dot')
      .setDisplaySize(720, 720)
      .setAlpha(0.08)
      .setTint(0x14b8a6)
      .setBlendMode(Phaser.BlendModes.ADD);

    const vr = createRng(0xbee5);
    for (let i = 0; i < 12; i++) {
      const x = vr.next() * W;
      const y = vr.next() * H;
      const hex = this.add
        .image(x, y, 'hex')
        .setScale(0.35 + vr.next() * 0.75)
        .setAlpha(0.04 + vr.next() * 0.05)
        .setTint(0x0284c7)
        .setAngle(vr.int(0, 60));
      this.tweens.add({
        targets: hex,
        y: y - 140 - vr.next() * 180,
        angle: hex.angle + 30,
        alpha: 0.02,
        duration: 16000 + vr.int(0, 12000),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    this.dangerFx = this.add.rectangle(0, 0, W, H, 0xf87171, 1).setOrigin(0).setDepth(90).setAlpha(0);
  }

  private buildFx(): void {
    this.burst = this.add
      .particles(0, 0, 'spark', {
        lifespan: { min: 380, max: 800 },
        speed: { min: 80, max: 320 },
        angle: { min: 0, max: 360 },
        scale: { start: 0.9, end: 0 },
        alpha: { start: 1, end: 0 },
        gravityY: 360,
        tint: [0x38bdf8, 0x2dd4bf, 0xa5f3fc, 0x67e8f9],
        blendMode: Phaser.BlendModes.ADD,
        emitting: false,
      })
      .setDepth(250);

    this.confetti = this.add
      .particles(0, 0, 'star5', {
        lifespan: { min: 800, max: 1500 },
        speed: { min: 140, max: 540 },
        angle: { min: -150, max: -30 },
        gravityY: 700,
        scale: { start: 0.22, end: 0.05 },
        rotate: { min: 0, max: 360 },
        alpha: { start: 1, end: 0 },
        tint: [0x38bdf8, 0x2dd4bf, 0x818cf8, 0xf472b6, 0x34d399, 0xffffff],
        emitting: false,
      })
      .setDepth(251);

    this.treasureText = this.add
      .text(W / 2, 1252, '', {
        fontFamily: FONT,
        fontSize: '17px',
        color: PALETTE.accent2,
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(30)
      .setLetterSpacing(2);
    this.modeFx = this.add.graphics().setDepth(91);
  }

  private buildHud(): void {
    const panel = this.add.graphics();
    panel.fillStyle(0x000000, 0.35);
    panel.fillRoundedRect(30, 48, W - 56, 184, 28);
    panel.fillStyle(0x0e1d35, 0.96);
    panel.fillRoundedRect(28, 40, W - 56, 184, 28);
    panel.fillStyle(0xffffff, 0.04);
    panel.fillRoundedRect(28, 40, W - 56, 72, { tl: 28, tr: 28, bl: 0, br: 0 });
    panel.lineStyle(2, 0x1e355b, 1);
    panel.strokeRoundedRect(28, 40, W - 56, 184, 28);
    panel.lineStyle(1.5, 0x38bdf8, 0.22);
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
        fontSize: '56px',
        color: PALETTE.text,
        fontStyle: 'bold',
        stroke: '#041c33',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(100);

    this.comboText = this.add
      .text(56, 98, '', {
        fontFamily: FONT,
        fontSize: '22px',
        color: PALETTE.accent2,
        fontStyle: 'bold',
      })
      .setDepth(100);

    this.comboG = this.add.graphics().setDepth(100);
    this.modeText = this.add
      .text(W - 56, 100, '', {
        fontFamily: FONT,
        fontSize: '20px',
        color: PALETTE.textDim,
        fontStyle: 'bold',
      })
      .setOrigin(1, 0)
      .setDepth(100);
    this.feverG = this.add.graphics().setDepth(100);

    this.bar = this.add.graphics().setDepth(100);
    this.starMarks = [0.5, 0.7, 1].map((f) =>
      this.add
        .image(W / 2 - 240 + 480 * f, 175, 'star5')
        .setDisplaySize(24, 24)
        .setTint(0x1a2e4c)
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
    frame.fillStyle(0x0e223d, 0.05);
    frame.fillRoundedRect(this.originX - 28, this.originY - 28, size.w + 56, size.h + 56, 34);
    frame.fillStyle(0x091426, 0.92);
    frame.fillRoundedRect(this.originX - 16, this.originY - 16, size.w + 32, size.h + 32, 24);
    frame.lineStyle(2, 0x1e3a66, 0.9);
    frame.strokeRoundedRect(this.originX - 16, this.originY - 16, size.w + 32, size.h + 32, 24);

    this.pathG = this.add.graphics().setDepth(9);

    const maskG = this.make.graphics({ x: 0, y: 0 }, false);
    maskG.fillStyle(0xffffff, 1);
    maskG.fillRoundedRect(this.originX - 16, this.originY - 16, size.w + 32, size.h + 32, 24);
    const sweep = this.add
      .image(this.originX - 120, this.originY + size.h / 2, 'dot')
      .setDisplaySize(90, size.h + 220)
      .setAngle(18)
      .setTint(0x38bdf8)
      .setAlpha(0.12)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(11);
    sweep.setMask(maskG.createGeometryMask());
    this.tweens.add({
      targets: sweep,
      x: this.originX + size.w + 140,
      duration: 1800,
      ease: 'Sine.easeInOut',
      repeat: -1,
      repeatDelay: 4600,
    });

    this.wordText = this.add
      .text(W / 2, 1156, '', {
        fontFamily: FONT,
        fontSize: '46px',
        color: PALETTE.accent2,
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(30);

    this.feedbackText = this.add
      .text(W / 2, 1206, t('game.minLength', { n: this.def.minLength }), {
        fontFamily: FONT,
        fontSize: '18px',
        color: PALETTE.textDim,
      })
      .setOrigin(0.5)
      .setDepth(30);

    this.hintG = this.add.graphics().setDepth(8);
    this.buildBottomControls();
  }

  // ================= ALT KONTROLLER (İpucu + Kurallar/Özellikler Butonu) =================

  private buildBottomControls(): void {
    // Sol: "Detaylar & Kurallar" Butonu (Kibar, yer kaplamayan, gözü yormayan)
    const ruleBtn = addButton(
      this,
      130,
      1166,
      190,
      60,
      '⚙ ÖZELLİKLER',
      { fontSize: 17, border: 0x1e3a66, labelColor: PALETTE.textDim },
      () => this.showGuideModal()
    );
    ruleBtn.container.setDepth(30);

    // Sağ: "Kopya / İpucu" Butonu (Öncelikle en uzun kelimeye odaklanır)
    const btn = addButton(
      this,
      W - 130,
      1166,
      190,
      60,
      '',
      { fontSize: 18, border: 0x2dd4bf, labelColor: PALETTE.accent2 },
      () => this.useHint()
    );
    btn.container.setDepth(30);
    this.hintText = btn.label;
    this.refreshHintLabel();
  }

  private refreshHintLabel(): void {
    this.hintText?.setText(upper(t('game.hintLeft', { n: this.hintsLeft })));
    this.hintText?.setAlpha(this.hintsLeft > 0 ? 1 : 0.4);
  }

  // Detaylar & Kurallar Açıklama Modalı
  private showGuideModal(): void {
    play('click');
    const layer = this.add.container(0, 0).setDepth(300);
    const dim = this.add.rectangle(0, 0, W, H, 0x030712, 0.88).setOrigin(0).setInteractive();
    layer.add(dim);

    const boxY = 310;
    const boxW = W - 70;
    const boxH = 680;
    const bg = this.add.graphics();
    bg.fillStyle(0x0c192e, 0.98);
    bg.fillRoundedRect(35, boxY, boxW, boxH, 26);
    bg.lineStyle(1.5, 0x38bdf8, 0.8);
    bg.strokeRoundedRect(35, boxY, boxW, boxH, 26);
    layer.add(bg);

    const title = this.add
      .text(W / 2, boxY + 44, upper(t('guide.title')), {
        fontFamily: FONT,
        fontSize: '26px',
        color: PALETTE.accent,
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    layer.add(title);

    const tips = [
      t('guide.beeDesc'),
      t('guide.comboDesc'),
      t('guide.frenzyDesc'),
      t('guide.longWordsDesc'),
    ];

    tips.forEach((text, i) => {
      const y = boxY + 98 + i * 118;
      const tObj = this.add.text(65, y, text, {
        fontFamily: FONT,
        fontSize: '17px',
        color: PALETTE.text,
        wordWrap: { width: boxW - 60 },
        lineSpacing: 6,
      });
      layer.add(tObj);
    });

    addButton(this, W / 2, boxY + boxH - 52, 240, 52, upper(t('guide.close')), { primary: true, fontSize: 18 }, () => {
      play('click');
      layer.destroy();
    }, layer);
  }

  // İpucu Kullanımı: Öncelikle ekilen UZUN KELİMELERİ önceliklendirir!
  private useHint(): void {
    if (!this.ready || this.ended) return;
    if (this.hintsLeft <= 0) {
      this.feedbackText.setText(t('game.hintNone')).setColor(PALETTE.danger);
      play('invalid');
      return;
    }

    // Uzun kelime ipucu mantığı: Ekilen kelimelerden bulunmamış en uzun olanı ara
    const unFoundPlanted = [...this.planted].filter((w) => !this.found.has(w)).sort((a, b) => b.length - a.length);
    let hint = findHint(this.board, unFoundPlanted.length > 0 ? unFoundPlanted : this.planted, this.found);

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

    // İlk 2 hücreyi ve yolu yumuşak turkuaz çizgisiyle göster
    const shown = hint.path.slice(0, 2);
    this.hintG.clear();
    this.hintG.lineStyle(6, 0x2dd4bf, 0.95);
    this.hintG.beginPath();
    shown.forEach((i, k) => {
      const p = this.posOf(i);
      if (k === 0) this.hintG.moveTo(this.originX + p.x, this.originY + p.y);
      else this.hintG.lineTo(this.originX + p.x, this.originY + p.y);
    });
    this.hintG.strokePath();
    this.hintG.setAlpha(1);
    this.tweens.add({ targets: this.hintG, alpha: 0, duration: 400, delay: 2000 });
    this.feedbackText
      .setText(t('game.hintLength', { n: hint.word.length }))
      .setColor(PALETTE.accent2);
  }

  private begin(): void {
    const gen = generateBoard(this.rng, this.lang, this.def.plantCount);
    this.board = gen.cells;
    this.planted = gen.planted;
    this.bonus = new Set(pickBonusCells(this.rng, bonusCount(this.level)));
    this.jokers = new Set(pickBonusCells(this.rng, jokerCount(this.level), COLS * ROWS, this.bonus));

    const specialCells = pickBonusCells(this.rng, letterSpecialCount(this.level), COLS * ROWS, new Set([...this.bonus, ...this.jokers]));
    this.treasure = [...this.planted].filter((w) => w.length >= 5).sort((a, b) => b.length - a.length)[0] ?? '';
    play('whoosh');

    for (let i = 0; i < COLS * ROWS; i++) {
      const p = this.posOf(i);
      const x = this.originX + p.x;
      const y = this.originY + p.y;

      const glow = this.add
        .image(x, y, 'dot')
        .setDisplaySize(HEX_SIZE * 2.9, HEX_SIZE * 2.9)
        .setTint(0x38bdf8)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(0)
        .setDepth(4);

      const shadow = this.add
        .image(x, y + 9, 'dot')
        .setDisplaySize(HEX_SIZE * 1.95, HEX_SIZE * 1.1)
        .setTint(0x000000)
        .setAlpha(0)
        .setDepth(5);

      const img = this.add
        .image(x, y, this.baseTex(i))
        .setDisplaySize(HEX_SIZE * 2 + 28, HEX_SIZE * 2 + 28)
        .setDepth(6)
        .setAlpha(0)
        .setScale(0.35);

      const letter = this.add
        .text(x, y - 3, this.jokers.has(i) ? '★' : display(this.board[i].letter, this.lang), {
          fontFamily: FONT,
          fontSize: '38px',
          color: PALETTE.hexText,
          fontStyle: 'bold',
          stroke: '#041728',
          strokeThickness: 3,
        })
        .setOrigin(0.5)
        .setDepth(10)
        .setAlpha(0);

      const mark = this.add
        .image(x + HEX_SIZE * 0.5, y - HEX_SIZE * 0.58, 'star5')
        .setDisplaySize(22, 22)
        .setTint(0xe0e7ff)
        .setDepth(12)
        .setAlpha(0);

      this.hexGlows.push(glow);
      this.hexShadows.push(shadow);
      this.hexViews.push(img);
      this.letterTexts.push(letter);
      this.bonusMarks.push(mark);
      this.hexOnFlags.push(false);

      if (specialCells.includes(i)) {
        const type = (i % 2 === 0) ? 'x2' : '+50';
        const sText = this.add
          .text(x - HEX_SIZE * 0.45, y - HEX_SIZE * 0.55, type, {
            fontFamily: FONT,
            fontSize: '14px',
            color: '#38bdf8',
            fontStyle: 'bold',
            stroke: '#030d1a',
            strokeThickness: 3,
          })
          .setOrigin(0.5)
          .setDepth(13);
        this.letterSpecial.set(i, { type, text: sText });
      }

      const delay = (i % COLS) * 22 + Math.floor(i / COLS) * 26;
      this.tweens.add({ targets: img, alpha: 1, scale: 1, duration: 420, ease: 'Back.easeOut', delay });
      this.tweens.add({ targets: letter, alpha: 1, duration: 280, delay: delay + 120 });
      this.tweens.add({ targets: shadow, alpha: 0.3, duration: 400, delay: delay + 60 });
    }

    for (const i of this.bonus) this.setBonus(i, true, 700);
    this.refreshTreasure();

    // Maskot Karakter: Bal Arısı (Sürekli gezip kafa karıştırmaz, sabit bekler, arada belirir)
    this.setupMascot();

    this.startedAt = Date.now();
    this.lastWordAt = this.time.now;
    this.ready = true;
    this.bridge.track('level_start', { level: this.level, lang: this.lang });

    this.timerEvent = this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        if (this.ended) return;
        if (this.time.now < this.freezeUntil) return;
        this.secondsLeft = Math.max(0, this.secondsLeft - 1);
        this.updateHud();
        this.maybeGoldenOrFrenzy();
        if (this.secondsLeft > 0 && this.secondsLeft <= 10) this.dangerPulse();
        if (this.secondsLeft === 0) void this.endGame();
      },
    });
  }

  private posOf(i: number): { x: number; y: number } {
    return hexPos(i);
  }

  // ================= BAL ARISI MASKOTU (Tek Bir Karede Sabit Belirir, Kafa Karıştırmaz) =================

  private setupMascot(): void {
    // Başlangıçta tahtada tek bir hücre seçilir ve orada sevimli şekilde bekler
    this.mascotCell = this.rng.int(0, COLS * ROWS);
    const p = this.posOf(this.mascotCell);

    this.mascotBee = this.add
      .image(this.originX + p.x, this.originY + p.y, 'mascotBee')
      .setDisplaySize(50, 50)
      .setDepth(35)
      .setAlpha(0)
      .setInteractive({ useHandCursor: true });

    this.mascotBee.on('pointerdown', () => this.catchMascot());

    // Arı hemen değil, 8 saniye sonra tatlı bir şekilde belirir (Fade In)
    this.time.delayedCall(8000, () => {
      if (this.mascotBee && !this.ended) {
        this.tweens.add({ targets: this.mascotBee, alpha: 1, scale: { from: 0.2, to: 50 / 64 }, duration: 500, ease: 'Back.easeOut' });
      }
    });

    // Sadece arada bir (20 saniyede bir) hücre değiştirir; sürekli uçup dikkat dağıtmaz!
    this.mascotTimer = this.time.addEvent({
      delay: 20000,
      loop: true,
      callback: () => this.relocateMascotCalmly(),
    });
  }

  private relocateMascotCalmly(): void {
    if (!this.mascotBee || this.ended) return;
    // Yavaşça kaybolur ve başka bir petekte belirir
    this.tweens.add({
      targets: this.mascotBee,
      alpha: 0,
      scale: 0.2,
      duration: 400,
      onComplete: () => {
        if (this.ended || !this.mascotBee) return;
        this.mascotCell = this.rng.int(0, COLS * ROWS);
        const p = this.posOf(this.mascotCell);
        this.mascotBee.setPosition(this.originX + p.x, this.originY + p.y);
        this.tweens.add({ targets: this.mascotBee, alpha: 1, scale: 50 / 64, duration: 400, ease: 'Back.easeOut' });
      },
    });
  }

  private catchMascot(): void {
    if (!this.mascotBee || this.ended || this.mascotBee.alpha < 0.5) return;
    play('treasure');
    haptic('success');
    const x = this.mascotBee.x;
    const y = this.mascotBee.y;

    this.score += 150;
    this.secondsLeft = Math.min(this.def.seconds + MAX_EXTRA_SECONDS, this.secondsLeft + 3);
    this.popup(x, y - 40, t('game.mascotCaught'), '#2dd4bf', 26);
    this.burst.emitParticleAt(x, y, 28);
    this.shockwave(x, y, 0x2dd4bf);

    // Alındıktan sonra kaybolur ve bir süre sonra yeni yere geçer
    this.mascotBee.setAlpha(0);
    this.time.delayedCall(12000, () => this.relocateMascotCalmly());
    this.updateHud();
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
    const result = checkPathJoker(this.board, this.path, this.jokers, this.lang, this.def.minLength, this.found);
    if (result.ok) this.acceptWord(result);
    else this.rejectWord(result);
    this.clearPath();
  }

  private acceptWord(result: CheckResult): void {
    const cells = [...this.path];
    const bonusUsed = cells.filter((i) => this.bonus.has(i));
    const jokerCells = cells.filter((i) => this.jokers.has(i));
    const len = result.word.length;
    const now = this.time.now;

    this.found.add(result.word);
    this.foundOrder.push(result.word);
    this.combo += 1;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.lastWordAt = now;

    let letterBonusPts = 0;
    let hasSpecialLetter = false;
    for (const c of cells) {
      if (this.letterSpecial.has(c)) {
        hasSpecialLetter = true;
        const sp = this.letterSpecial.get(c)!;
        if (sp.type === '+50') letterBonusPts += 50;
        else if (sp.type === 'x2') letterBonusPts += len * 15;
      }
    }

    if (this.mascotCell >= 0 && cells.includes(this.mascotCell)) {
      this.catchMascot();
    }

    const isTreasure = this.treasure !== '' && result.word === this.treasure;
    const fever = now < this.feverUntil;
    const golden = now < this.goldenUntil;
    const frenzyActive = now < this.frenzyUntil;
    const mult = multiplierFor(fever, golden, frenzyActive ? this.frenzyMult : 1, isTreasure);
    const reward = lengthReward(len);

    const gained = scoreWord(len, this.combo, this.level, bonusUsed.length, letterBonusPts) * mult + reward.points;
    this.score += gained;

    const extra = timeBonusFor(len, bonusUsed.length) + (isTreasure ? 5 : 0) + (fever ? 1 : 0);
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
    this.popCells(cells, tier);
    this.burst.emitParticleAt(cx, cy, 14 + len * 4);
    this.popup(cx, cy - 24, `+${fmtInt(gained)}`, tier >= 2 || mult > 1 ? '#38bdf8' : '#2dd4bf', 34 + tier * 8);
    if (mult > 1) this.popup(cx, cy + 22, `x${mult}`, '#818cf8', 30);
    if (hasSpecialLetter) this.popup(cx, cy + 54, t('game.letterBonus'), '#2dd4bf', 22);

    if (extra > 0) {
      this.popup(W - 120, 108, upper(t('game.bonusTime', { n: extra })), '#38bdf8', 26);
    }

    if (reward.rainbowMs > 0) {
      this.rainbowUntil = now + reward.rainbowMs;
      this.banner(t('game.rainbowPetal'), '#2dd4bf');
      play('fever');
    }

    if (bonusUsed.length) {
      play('bonus');
      for (const i of bonusUsed) {
        this.bonus.delete(i);
        this.setBonus(i, false);
      }
      const taken = new Set<number>([...this.bonus, ...this.jokers, ...cells]);
      for (const i of pickBonusCells(this.rng, bonusUsed.length, COLS * ROWS, taken)) {
        this.bonus.add(i);
        this.setBonus(i, true);
      }
    }

    if (result.joker && jokerCells.length) {
      play('bonus');
      this.popup(cx, cy + 62, t('game.joker'), '#ff8fc7', 30);
      for (const i of jokerCells) {
        this.jokers.delete(i);
        this.setJoker(i, false);
      }
      const taken = new Set<number>([...this.bonus, ...this.jokers, ...cells]);
      for (const i of pickBonusCells(this.rng, jokerCells.length, COLS * ROWS, taken)) {
        this.jokers.add(i);
        this.setJoker(i, true);
      }
    }

    if (isTreasure) {
      play('treasure');
      this.banner(t('game.treasureFound'), '#38bdf8');
      this.cameras.main.flash(240, 14, 165, 233);
      this.burst.emitParticleAt(W / 2, 640, 90);
      this.meta.stats.treasures += 1;
    }

    if (len >= 6) {
      this.popup(cx, cy - 74, upper(t('game.longReward')), '#2dd4bf', 24);
      this.confetti.emitParticleAt(cx, cy, 32 + len * 6);
      this.shockwave(cx, cy, 0x2dd4bf);
      if (reward.hints > 0) {
        this.hintsLeft = Math.min(9, this.hintsLeft + reward.hints);
        this.refreshHintLabel();
        this.popup(cx, cy - 104, t('game.hintGain', { n: reward.hints }), '#38bdf8', 24);
      }
      if (reward.freezeMs > 0) {
        this.freezeUntil = Math.max(this.freezeUntil, now) + reward.freezeMs;
        play('freeze');
        this.banner(t('game.frozen'), '#7dd3fc');
      }
    }

    const milestone = comboMilestone(this.combo);
    if (milestone) {
      this.score += milestone.points;
      this.secondsLeft = Math.min(this.def.seconds + MAX_EXTRA_SECONDS, this.secondsLeft + milestone.seconds);
      this.popup(
        W / 2,
        330,
        `${t('game.comboMilestone', { n: this.combo })}  ${t('game.bonusTime', { n: milestone.seconds })}`,
        '#818cf8',
        38
      );
      this.confetti.emitParticleAt(W / 2, 360, 30);
      play('star', 3);
    }

    if (!fever) {
      this.feverMeter = Math.min(100, this.feverMeter + feverGain(len, bonusUsed.length) + reward.fever);
      if (this.feverMeter >= 100) this.startFever();
    }

    if (tier >= 2) this.cameras.main.shake(130, 0.003 + tier * 0.001);
    if (tier >= 3) {
      this.cameras.main.flash(180, 56, 189, 248);
      this.burst.emitParticleAt(W / 2, 640, 60);
      play('whoosh');
    }

    const st = this.meta.stats;
    st.totalWords += 1;
    st.longestWord = Math.max(st.longestWord, len);
    st.bestCombo = Math.max(st.bestCombo, this.maxCombo);
    if (result.joker) st.jokerWords += 1;

    const missionsDone = addMissionProgress(this.meta, dayKey(Date.now()), {
      words: 1,
      long: len >= 6 ? 1 : 0,
      combo: this.combo,
    });
    for (const id of missionsDone) this.toastQueue.push(`mis:${id}`);
    this.checkBadges();

    this.updateHud();

    this.bridge.track('word_found', {
      level: this.level,
      word: result.word,
      length: len,
      points: gained,
      combo: this.combo,
      bonus: bonusUsed.length,
      extraSeconds: extra,
      mult,
      joker: !!result.joker,
      treasure: isTreasure,
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
    if (result.reason === 'invalid' && this.combo > 0) {
      this.combo = 0;
      this.updateHud();
    }
  }

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
        stroke: '#040d1a',
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

  private flashPath(cells: number[]): void {
    const g = this.add.graphics().setDepth(9);
    g.lineStyle(12, 0x2dd4bf, 0.95);
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

  private setBonus(i: number, on: boolean, delay = 0): void {
    const mark = this.bonusMarks[i];
    const img = this.hexViews[i];
    if (!mark || !img) return;
    this.tweens.killTweensOf(mark);
    if (!this.hexOnFlags[i]) img.setTexture(this.baseTex(i));
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
        this.ring(x, y, 0x38bdf8);
      })
    );
  }

  update(): void {
    if (!this.comboG) return;
    const now = this.time.now;
    const feverOn = now < this.feverUntil;
    const goldenOn = now < this.goldenUntil;
    const frenzyOn = now < this.frenzyUntil;
    const rainbowOn = now < this.rainbowUntil;
    const frozen = now < this.freezeUntil;

    for (let i = 0; i < this.hexViews.length; i++) {
      const img = this.hexViews[i];
      if (this.hexOnFlags[i]) continue;
      if (rainbowOn) {
        img.setTexture('hexRainbow');
      } else if (frenzyOn) {
        img.setTexture('hexFrenzy');
      } else {
        img.setTexture(this.baseTex(i));
      }
    }

    if (feverOn !== this.feverTinted) {
      this.feverTinted = feverOn;
      for (const img of this.hexViews) {
        if (feverOn) img.setTint(0xbae6fd);
        else img.clearTint();
      }
    }

    const timeColor = frozen ? '#7dd3fc' : this.secondsLeft <= 10 ? PALETTE.danger : PALETTE.text;
    if (timeColor !== this.shownTimeColor) {
      this.shownTimeColor = timeColor;
      this.timeText?.setColor(timeColor);
    }

    if (this.feverUntil > 0 && !feverOn) {
      this.feverUntil = 0;
      this.feverMeter = 0;
    }
    if (feverOn) this.feverMeter = Math.max(0, (100 * (this.feverUntil - now)) / FEVER_MS);

    this.feverG.clear();
    this.feverG.fillStyle(0x132a4a, 1);
    this.feverG.fillRoundedRect(W - 206, 130, 150, 6, 3);
    if (this.feverMeter > 0) {
      this.feverG.fillStyle(feverOn ? 0x38bdf8 : 0x2dd4bf, 1);
      this.feverG.fillRoundedRect(W - 206, 130, Math.max(6, 1.5 * this.feverMeter), 6, 3);
    }

    const mult = multiplierFor(feverOn, goldenOn, frenzyOn ? this.frenzyMult : 1, false);
    let label = upper(t('game.fever'));
    if (frenzyOn) label = `ÇARPAN x${this.frenzyMult}!`;
    else if (rainbowOn) label = 'AURORA!';
    else if (mult > 1) label = `${feverOn ? upper(t('game.fever')) : upper(t('game.golden').replace('!', ''))}  x${mult}`;
    if (frozen) label = upper(t('game.frozen'));

    if (label !== this.shownMode) {
      this.shownMode = label;
      this.modeText.setText(label).setColor(frozen ? '#7dd3fc' : frenzyOn ? '#a855f7' : mult > 1 ? PALETTE.accent2 : PALETTE.textDim);
    }

    this.modeFx.clear();
    if ((feverOn || goldenOn || frenzyOn || rainbowOn || frozen) && !this.ended) {
      const a = 0.32 + 0.18 * Math.sin(now / 110);
      const color = frozen ? 0x7dd3fc : frenzyOn ? 0xa855f7 : rainbowOn ? 0x06b6d4 : feverOn ? 0x38bdf8 : 0x2dd4bf;
      this.modeFx.lineStyle(14, color, a);
      this.modeFx.strokeRect(7, 7, W - 14, H - 14);
    }

    this.comboG.clear();
    if (this.combo <= 0 || this.ended) return;
    const left = 1 - (now - this.lastWordAt) / COMBO_WINDOW_MS;
    if (left <= 0) {
      this.combo = 0;
      this.updateHud();
      return;
    }
    this.comboG.fillStyle(0x132a4a, 1);
    this.comboG.fillRoundedRect(56, 130, 150, 6, 3);
    this.comboG.fillStyle(left < 0.3 ? 0xf87171 : 0x2dd4bf, 1);
    this.comboG.fillRoundedRect(56, 130, Math.max(6, 150 * left), 6, 3);
  }

  private baseTex(i: number): string {
    return this.jokers.has(i) ? 'hexJoker' : this.bonus.has(i) ? 'hexBonus' : 'hex';
  }

  private setJoker(i: number, on: boolean): void {
    const img = this.hexViews[i];
    const letter = this.letterTexts[i];
    if (!img || !letter) return;
    if (!this.hexOnFlags[i]) img.setTexture(this.baseTex(i));
    letter.setText(on ? '★' : display(this.board[i].letter, this.lang));
  }

  private startFever(): void {
    this.feverUntil = this.time.now + FEVER_MS;
    this.feverMeter = 100;
    this.meta.stats.fevers += 1;
    play('fever');
    haptic('success');
    this.banner(t('game.feverOn'), '#38bdf8');
    this.cameras.main.flash(200, 56, 189, 248);
  }

  private maybeGoldenOrFrenzy(): void {
    const now = this.time.now;
    if (this.def.seconds >= 50) {
      for (const frac of [0.65, 0.35]) {
        const mark = Math.floor(this.def.seconds * frac);
        if (this.secondsLeft === mark && !this.goldenFired.has(mark)) {
          this.goldenFired.add(mark);
          if (this.rng.next() > 0.4) {
            this.frenzyMult = this.rng.next() > 0.5 ? 3 : 2;
            this.frenzyUntil = now + FRENZY_MS;
            play('treasure');
            this.banner(this.frenzyMult === 3 ? t('game.frenzy3x') : t('game.frenzy2x'), '#a855f7');
            this.cameras.main.flash(200, 168, 85, 247);
          } else {
            this.goldenUntil = now + GOLDEN_MS;
            play('bonus');
            this.banner(t('game.golden'), '#38bdf8');
          }
        }
      }
    }
  }

  private banner(text: string, color: string): void {
    const tx = this.add
      .text(W / 2, 640, text, {
        fontFamily: FONT,
        fontSize: '56px',
        color,
        fontStyle: 'bold',
        stroke: '#040d1a',
        strokeThickness: 10,
      })
      .setOrigin(0.5)
      .setDepth(120)
      .setScale(0.5)
      .setAlpha(0);
    this.tweens.add({ targets: tx, scale: 1, alpha: 1, duration: 280, ease: 'Back.easeOut' });
    this.tweens.add({
      targets: tx,
      alpha: 0,
      y: 600,
      duration: 500,
      delay: 1200,
      onComplete: () => tx.destroy(),
    });
  }

  private refreshTreasure(): void {
    if (!this.treasureText) return;
    if (!this.treasure) {
      this.treasureText.setText('');
      return;
    }
    const found = this.found.has(this.treasure);
    const reveal = found
      ? this.treasure.length
      : this.secondsLeft <= this.def.seconds * 0.25
        ? 2
        : this.secondsLeft <= this.def.seconds * 0.5
          ? 1
          : 0;
    const slots = display(this.treasure, this.lang)
      .split('')
      .map((ch, k) => (k < reveal ? ch : '_'))
      .join(' ');
    this.treasureText
      .setText(`${upper(t('game.treasure'))}  ${slots}`)
      .setColor(found ? PALETTE.success : PALETTE.accent2);
  }

  private popCells(cells: number[], tier: number): void {
    cells.forEach((i, k) => {
      const p = this.posOf(i);
      const x = this.originX + p.x;
      const y = this.originY + p.y;
      this.time.delayedCall(k * 45, () => {
        if (!this.hexViews[i]) return;
        play('pop', k + 1);
        this.burst.emitParticleAt(x, y, 7 + tier * 4);
        this.ring(x, y, tier >= 2 ? 0x38bdf8 : 0x2dd4bf);
        this.tweens.add({
          targets: this.hexViews[i],
          scale: { from: 1.32, to: 1 },
          duration: 340,
          ease: 'Back.easeOut',
        });
      });
    });
  }

  private shockwave(x: number, y: number, color: number): void {
    for (let k = 0; k < 2; k++) {
      const r = this.add
        .image(x, y, 'ring')
        .setTint(color)
        .setAlpha(0.8)
        .setScale(0.4)
        .setDepth(19)
        .setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: r,
        scale: 5.5,
        alpha: 0,
        duration: 700,
        delay: k * 140,
        ease: 'Cubic.easeOut',
        onComplete: () => r.destroy(),
      });
    }
  }

  private pickChest(stars: number): Promise<number> {
    return new Promise((resolve) => {
      const values = chestValues(stars);
      this.rng.shuffle(values);

      const layer = this.add.container(0, 0).setDepth(210);
      const dim = this.add.rectangle(0, 0, W, H, 0x020611, 0.82).setOrigin(0).setInteractive();
      layer.add(dim);
      layer.add(
        this.add
          .text(W / 2, 470, upper(t('game.chestTitle')), {
            fontFamily: FONT,
            fontSize: '40px',
            color: PALETTE.accent,
            fontStyle: 'bold',
            stroke: '#040d1a',
            strokeThickness: 8,
          })
          .setOrigin(0.5)
      );

      let chosen = false;
      const chests = values.map((v, i) => {
        const x = W / 2 + (i - 1) * 200;
        const y = 700;
        const box = this.add.container(x, y);
        const glow = this.add
          .image(0, -10, 'dot')
          .setDisplaySize(200, 200)
          .setTint(0x38bdf8)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setAlpha(0);
        const body = this.add.graphics();
        body.fillStyle(0x000000, 0.35);
        body.fillEllipse(0, 66, 150, 24);
        body.fillStyle(0x0e2444, 1);
        body.fillRoundedRect(-62, -6, 124, 70, 10);
        body.fillStyle(0x153664, 1);
        body.fillRoundedRect(-62, -6, 124, 54, 10);
        body.fillStyle(0x38bdf8, 1);
        body.fillRect(-62, 16, 124, 8);
        const lid = this.add.graphics();
        lid.fillStyle(0x1d4d8c, 1);
        lid.fillRoundedRect(-66, -46, 132, 46, { tl: 26, tr: 26, bl: 6, br: 6 });
        lid.fillStyle(0x38bdf8, 1);
        lid.fillRect(-66, -8, 132, 8);
        lid.fillRoundedRect(-12, -10, 24, 28, 6);
        const valText = this.add
          .text(0, -84, `+${v} XP`, {
            fontFamily: FONT,
            fontSize: '34px',
            color: PALETTE.accent,
            fontStyle: 'bold',
            stroke: '#040d1a',
            strokeThickness: 6,
          })
          .setOrigin(0.5)
          .setAlpha(0);
        box.add([glow, body, lid, valText]);
        layer.add(box);
        this.tweens.add({
          targets: box,
          y: y - 10,
          duration: 700 + i * 130,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
        const zone = this.add.zone(x, y, 160, 140).setOrigin(0.5).setInteractive({ useHandCursor: true });
        layer.add(zone);
        return { box, lid, glow, valText, zone, v, x, y };
      });

      const reveal = (idx: number) => {
        if (chosen) return;
        chosen = true;
        chests.forEach((c, i) => {
          const mine = i === idx;
          this.tweens.killTweensOf(c.box);
          this.tweens.add({ targets: c.box, y: c.y, duration: 120 });
          this.tweens.add({
            targets: c.lid,
            y: -44,
            angle: -18,
            duration: 340,
            delay: mine ? 0 : 280,
            ease: 'Back.easeOut',
          });
          this.tweens.add({
            targets: [c.valText, c.glow],
            alpha: mine ? 1 : 0.4,
            duration: 300,
            delay: mine ? 120 : 420,
          });
          if (mine) this.tweens.add({ targets: c.valText, scale: 1.35, duration: 300, delay: 120, ease: 'Back.easeOut' });
        });
        const c = chests[idx];
        play('treasure');
        haptic('success');
        this.confetti.emitParticleAt(c.x, c.y - 20, 60);
        this.burst.emitParticleAt(c.x, c.y - 20, 36);
        this.shockwave(c.x, c.y - 20, 0x38bdf8);
        this.time.delayedCall(1800, () => {
          layer.destroy();
          resolve(c.v);
        });
      };

      chests.forEach((c, i) =>
        c.zone.on('pointerdown', () => {
          unlockAudio();
          reveal(i);
        })
      );
      this.time.delayedCall(9000, () => reveal(1));
    });
  }

  private checkBadges(): void {
    const ids = newAchievements(this.meta);
    if (ids.length) {
      this.meta.unlocked.push(...ids);
      this.toastQueue.push(...ids.map((id) => `ach:${id}`));
      this.flushToast();
    }
    saveMeta(this.meta);
  }

  private flushToast(): void {
    if (this.toasting) return;
    const item = this.toastQueue.shift();
    if (!item) return;
    const [kind, id] = item.split(':');
    this.toasting = true;
    play('badge');

    const box = this.add.container(W / 2, -70).setDepth(230);
    const bg = this.add.graphics();
    bg.fillStyle(0x0e1d35, 0.97);
    bg.fillRoundedRect(-270, -40, 540, 80, 24);
    bg.lineStyle(2, 0x38bdf8, 1);
    bg.strokeRoundedRect(-270, -40, 540, 80, 24);
    const icon = this.add.image(-222, 0, 'star5').setDisplaySize(46, 46).setTint(0x38bdf8);
    const head = this.add
      .text(-186, -22, upper(t(kind === 'mis' ? 'game.mission' : 'game.badge')), {
        fontFamily: FONT,
        fontSize: '14px',
        color: PALETTE.accent2,
        fontStyle: 'bold',
      })
      .setLetterSpacing(2);
    const name = this.add.text(-186, -2, t(kind === 'mis' ? `mis.${id}` : `ach.${id}`), {
      fontFamily: FONT,
      fontSize: '26px',
      color: PALETTE.text,
      fontStyle: 'bold',
    });
    box.add([bg, icon, head, name]);
    this.burst?.emitParticleAt(W / 2 - 222, 270, 14);

    this.tweens.add({ targets: box, y: 268, duration: 380, ease: 'Back.easeOut' });
    this.tweens.add({
      targets: box,
      y: -90,
      duration: 320,
      delay: 2400,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        box.destroy();
        this.toasting = false;
        this.flushToast();
      },
    });
  }

  private clearPath(): void {
    this.path = [];
    this.refreshPath();
  }

  private refreshPath(): void {
    this.pathG.clear();
    if (this.path.length >= 2) {
      this.pathG.lineStyle(7, 0x14b8a6, 1); // Zarif zümrüt bağlantı ipi
      this.pathG.beginPath();
      const first = this.posOf(this.path[0]);
      this.pathG.moveTo(this.originX + first.x, this.originY + first.y);
      for (let k = 1; k < this.path.length; k++) {
        const p = this.posOf(this.path[k]);
        this.pathG.lineTo(this.originX + p.x, this.originY + p.y);
      }
      this.pathG.strokePath();
      this.pathG.fillStyle(0x14b8a6, 1);
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
      const shadow = this.hexShadows[i];
      this.tweens.killTweensOf([img, letter, glow, shadow]);

      if (on) {
        img.setTexture('hexOn');
        this.ring(baseX, baseY, 0x2dd4bf);
        img.setPosition(baseX, baseY + 5).setScale(0.9);
        this.tweens.add({ targets: img, y: baseY - 16, scale: 1.1, duration: 240, ease: 'Back.easeOut' });
        this.tweens.add({ targets: glow, alpha: 0.8, duration: 170 });
        this.tweens.add({
          targets: shadow,
          alpha: 0.55,
          scale: 1.18,
          x: baseX + 6,
          y: baseY + 14,
          duration: 220,
          ease: 'Sine.easeOut',
        });
        letter.setColor(PALETTE.hexTextOn).setScale(0.92).setY(baseY + 2);
        this.tweens.add({ targets: letter, y: baseY - 20, scale: 1.3, duration: 250, ease: 'Back.easeOut' });
      } else {
        img.setTexture(this.baseTex(i));
        this.tweens.add({ targets: img, y: baseY, scale: 1, duration: 200, ease: 'Bounce.easeOut' });
        this.tweens.add({ targets: glow, alpha: 0, duration: 140 });
        this.tweens.add({
          targets: shadow,
          alpha: 0.3,
          scale: 1,
          x: baseX,
          y: baseY + 9,
          duration: 200,
          ease: 'Sine.easeOut',
        });
        letter.setColor(PALETTE.hexText).setScale(1).setY(baseY - 3);
        this.tweens.add({ targets: letter, y: baseY - 3, scale: 1, duration: 170, ease: 'Sine.easeOut' });
      }
    }

    const w = this.path.map((i) => (this.jokers.has(i) ? '★' : this.board[i].letter)).join('');
    this.wordText.setText(w ? display(w, this.lang) : '');
  }

  private updateHud(): void {
    if (this.scoreText && this.score !== this.shownScore) {
      this.shownScore = this.score;
      this.scoreText.setText(fmtInt(this.score));
      this.tweens.add({ targets: this.scoreText, scale: { from: 1.14, to: 1 }, duration: 200 });
    }
    this.timeText?.setText(`${upper(t('common.time'))} ${this.secondsLeft}`);
    this.shownTimeColor = '';
    this.foundText?.setText(
      `${t('common.found')} ${this.found.size} ${t('common.words')}  •  ${t('game.minLength', { n: this.def.minLength })}`
    );
    this.comboText?.setText(this.combo >= 2 ? upper(t('common.combo', { n: this.combo })) : '');
    this.refreshTreasure();
    if (!this.bar) return;

    const w = 480;
    const x = W / 2 - w / 2;
    const y = 168;
    const pct = Math.max(0, Math.min(1, this.score / (this.def.target * 2)));
    this.bar.clear();
    this.bar.fillStyle(0x071120, 1);
    this.bar.fillRoundedRect(x, y, w, 14, 7);
    if (pct > 0) {
      const fw = Math.max(14, w * pct);
      this.bar.fillStyle(pct >= 0.5 ? 0x2dd4bf : 0x0ea5e9, 1);
      this.bar.fillRoundedRect(x, y, fw, 14, 7);
      this.bar.fillStyle(0xffffff, 0.28);
      this.bar.fillRoundedRect(x + 3, y + 2, Math.max(8, fw - 6), 4, 2);
    }
    this.bar.lineStyle(1, 0x1e355b, 1);
    this.bar.strokeRoundedRect(x, y, w, 14, 7);

    const stars = starsFor(this.score, this.def.target);
    this.starMarks.forEach((m, k) => m.setTint(k < stars ? 0x38bdf8 : 0x1a2e4c));
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
    this.mascotTimer?.remove();
    setBackButton(null);
    this.scene.start('Menu');
  }

  // ================= BİTİŞ EKRANI & EN UZUN KELİMELERİN ANİMASYONLU KARTLARI =================

  private async endGame(): Promise<void> {
    if (this.ended) return;
    this.ended = true;
    this.timerEvent?.remove();
    this.mascotTimer?.remove();
    this.clearPath();
    this.bridge.track('level_start_end', { level: this.level });

    const won = this.score >= this.def.target;
    const stars = starsFor(this.score, this.def.target);
    let xp = xpFor(this.level, this.score, stars);

    const today = dayKey(Date.now());
    const day = touchDay(this.meta, today);
    this.meta.stats.plays += 1;
    if (won) this.meta.stats.wins += 1;
    const notes: string[] = [];
    if (this.meta.streak > 0) notes.push(t('game.streak', { n: this.meta.streak }));
    if (day.isNewDay) {
      const bonusXp = streakBonusXp(this.meta.streak);
      xp += bonusXp;
      notes.push(t('game.streakXp', { n: bonusXp }));
    }
    if (this.daily && won && !dailyDone(this.meta, today)) {
      this.meta.dailyDay = today;
      this.meta.dailyScore = this.score;
      xp += DAILY_BONUS_XP;
      notes.push(t('game.dailyDone', { n: DAILY_BONUS_XP }));
    }
    const missionXp = takePendingXp(this.meta);
    if (missionXp > 0) {
      xp += missionXp;
      notes.push(t('game.missionXp', { n: missionXp }));
    }
    this.resultNote = notes.join('   •   ');
    this.checkBadges();
    play(won ? 'win' : 'lose');
    haptic(won ? 'success' : 'error');
    this.cameras.main.flash(won ? 220 : 160, won ? 14 : 120, won ? 165 : 40, won ? 233 : 40);

    if (won) {
      const chestXp = await this.pickChest(stars);
      xp += chestXp;
      notes.push(t('game.chestWin', { n: chestXp }));
      this.resultNote = notes.join('   •   ');
    }

    let xpGained = xp;
    try {
      const outcome = await this.bridge.finish({
        score: this.score,
        durationMs: Date.now() - this.startedAt,
        level: this.daily ? 0 : won ? this.level : Math.max(0, this.level - 1),
        xp,
        stats: {
          stars,
          found: this.found.size,
          maxCombo: this.maxCombo,
          hints: this.hintCount,
          daily: this.daily ? 1 : 0,
          streak: this.meta.streak,
          target: this.def.target,
        },
        clientVersion: '0.1.0',
      });
      xpGained = outcome.xpGained;
    } catch {
      /* yerel */
    }

    this.showResult(won, stars, xpGained);
  }

  private showResult(won: boolean, stars: number, xpGained: number): void {
    const profile = loadProfile();
    const info = levelInfo(profile.xp);
    const best = profile.games['word-hunt']?.bestScore ?? this.score;

    const layer = this.add.container(0, 0).setDepth(200);
    const dim = this.add
      .rectangle(0, 0, W, H, 0x020612, 0.88)
      .setOrigin(0)
      .setInteractive();
    layer.add(dim);

    const panelY = 240;
    const panelH = 820;
    const panel = this.add.graphics();
    panel.fillStyle(0x0c192e, 0.98);
    panel.fillRoundedRect(45, panelY, W - 90, panelH, 32);
    panel.lineStyle(2, won ? 0x2dd4bf : 0xf87171, 0.8);
    panel.strokeRoundedRect(45, panelY, W - 90, panelH, 32);
    layer.add(panel);

    const title = this.add
      .text(W / 2, panelY + 44, upper(won ? t('game.won') : t('game.lost')), {
        fontFamily: FONT,
        fontSize: '34px',
        color: won ? PALETTE.success : PALETTE.danger,
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    layer.add(title);

    // Yıldızlar
    for (let i = 0; i < 3; i++) {
      const x = W / 2 + (i - 1) * 88;
      const earned = i < stars;
      const star = this.add
        .image(x, panelY + 110, 'star5')
        .setDisplaySize(earned ? 64 : 48, earned ? 64 : 48)
        .setTint(earned ? 0x38bdf8 : 0x1a2e4c)
        .setAlpha(earned ? 1 : 0.5);
      layer.add(star);
      if (earned) {
        star.setScale(0);
        this.tweens.add({
          targets: star,
          scale: 64 / 64,
          duration: 380,
          delay: 200 + i * 150,
          ease: 'Back.easeOut',
        });
      }
    }

    // Hedef Durumu
    const targetBoxY = panelY + 158;
    const targetPct = Math.round((this.score / this.def.target) * 100);
    const targetStatusText = won
      ? t('result.targetStatusSuccess', { pct: targetPct })
      : t('result.targetStatusFail', { pts: fmtInt(this.def.target - this.score) });

    const tBox = this.add.graphics();
    tBox.fillStyle(0x081324, 0.9);
    tBox.fillRoundedRect(75, targetBoxY, W - 150, 100, 16);
    tBox.lineStyle(1.5, won ? 0x2dd4bf : 0xf87171, 0.5);
    tBox.strokeRoundedRect(75, targetBoxY, W - 150, 100, 16);
    layer.add(tBox);

    layer.add(
      this.add
        .text(95, targetBoxY + 16, t('result.targetHeader'), {
          fontFamily: FONT,
          fontSize: '15px',
          color: PALETTE.textDim,
          fontStyle: 'bold',
        })
    );
    layer.add(
      this.add
        .text(W - 95, targetBoxY + 16, fmtInt(this.def.target), {
          fontFamily: FONT,
          fontSize: '16px',
          color: PALETTE.accent,
          fontStyle: 'bold',
        })
        .setOrigin(1, 0)
    );

    const barW = W - 190;
    const barFill = Math.min(barW, Math.max(12, (barW * this.score) / this.def.target));
    const barG = this.add.graphics();
    barG.fillStyle(0x132a4a, 1);
    barG.fillRoundedRect(95, targetBoxY + 44, barW, 12, 6);
    barG.fillStyle(won ? 0x2dd4bf : 0xf87171, 1);
    barG.fillRoundedRect(95, targetBoxY + 44, barFill, 12, 6);
    layer.add(barG);

    layer.add(
      this.add
        .text(W / 2, targetBoxY + 76, targetStatusText, {
          fontFamily: FONT,
          fontSize: '14px',
          color: won ? PALETTE.success : PALETTE.danger,
          fontStyle: 'bold',
        })
        .setOrigin(0.5)
    );

    // ================= BÖLÜMDE BULUNAN EN İYİ / EN UZUN KELİMELERİN ANİMASYONLU KARTLARI =================
    const wordsSectionY = targetBoxY + 116;
    layer.add(
      this.add
        .text(W / 2, wordsSectionY, t('result.bestWordsHeader'), {
          fontFamily: FONT,
          fontSize: '14px',
          color: PALETTE.textDim,
          fontStyle: 'bold',
          letterSpacing: 1,
        })
        .setOrigin(0.5)
    );

    // En uzun 3-4 kelimeyi seç
    const topWords = [...this.found].sort((a, b) => b.length - a.length).slice(0, 3);
    const cardStartX = 80;
    const cardGap = 12;
    const cardTotalW = W - 160;
    const count = Math.max(1, topWords.length);
    const cWidth = (cardTotalW - cardGap * (count - 1)) / count;

    if (topWords.length === 0) {
      layer.add(
        this.add
          .text(W / 2, wordsSectionY + 36, t('game.noWords'), {
            fontFamily: FONT,
            fontSize: '15px',
            color: PALETTE.textDim,
          })
          .setOrigin(0.5)
      );
    } else {
      topWords.forEach((word, idx) => {
        const cX = cardStartX + idx * (cWidth + cardGap);
        const cY = wordsSectionY + 22;

        const wCard = this.add.graphics();
        wCard.fillStyle(0x0e2444, 0.95);
        wCard.fillRoundedRect(cX, cY, cWidth, 54, 12);
        wCard.lineStyle(1.5, 0x38bdf8, 0.7);
        wCard.strokeRoundedRect(cX, cY, cWidth, 54, 12);
        layer.add(wCard);

        const wText = this.add
          .text(cX + cWidth / 2, cY + 20, display(word, this.lang), {
            fontFamily: FONT,
            fontSize: cWidth < 140 ? '16px' : '19px',
            color: PALETTE.text,
            fontStyle: 'bold',
          })
          .setOrigin(0.5);

        const lenText = this.add
          .text(cX + cWidth / 2, cY + 39, `${word.length} Harf`, {
            fontFamily: FONT,
            fontSize: '12px',
            color: PALETTE.accent2,
          })
          .setOrigin(0.5);

        layer.add([wText, lenText]);

        // Yumuşak giriş animasyonu
        wCard.setAlpha(0);
        wText.setAlpha(0);
        lenText.setAlpha(0);
        this.tweens.add({
          targets: [wCard, wText, lenText],
          alpha: 1,
          y: '-=6',
          duration: 350,
          delay: 350 + idx * 120,
          ease: 'Back.easeOut',
        });
      });
    }

    // İstatistik Tablosu
    const statsY = wordsSectionY + 98;
    const lines: Array<[string, string, string]> = [
      [upper(t('common.score')), fmtInt(this.score), PALETTE.text],
      [upper(t('common.best')), fmtInt(best), PALETTE.accent],
      [upper(t('common.found')), `${this.found.size} ${t('common.words')}`, PALETTE.textDim],
      ['EN İYİ KOMBO', `x${this.maxCombo}`, PALETTE.accent2],
      [upper(t('common.xpEarned')), `+${xpGained} XP`, PALETTE.success],
    ];

    lines.forEach(([lbl, val, col], i) => {
      const y = statsY + i * 36;
      layer.add(
        this.add
          .text(85, y, lbl, {
            fontFamily: FONT,
            fontSize: '16px',
            color: PALETTE.textDim,
            fontStyle: 'bold',
          })
          .setOrigin(0, 0.5)
      );
      layer.add(
        this.add
          .text(W - 85, y, val, {
            fontFamily: FONT,
            fontSize: '18px',
            color: col,
            fontStyle: 'bold',
          })
          .setOrigin(1, 0.5)
      );
    });

    // Butonlar
    const buttons: Array<{ label: string; primary?: boolean; action: () => void }> = [
      { label: upper(t('common.menu')), action: () => this.scene.start('Menu') },
      { label: upper(t('common.retry')), action: () => this.scene.restart({ level: this.level, daily: this.daily }) },
    ];
    if (won && !this.daily && this.level < MAX_LEVEL) {
      buttons.push({
        label: upper(t('common.next')),
        primary: true,
        action: () => this.scene.restart({ level: this.level + 1 }),
      });
    } else {
      buttons[1].primary = true;
    }

    const totalW = W - 160;
    const gap = 14;
    const bw = (totalW - gap * (buttons.length - 1)) / buttons.length;
    buttons.forEach((b, i) => {
      const bx = 80 + i * (bw + gap) + bw / 2;
      addButton(
        this,
        bx,
        panelY + panelH - 62,
        bw,
        58,
        b.label,
        { primary: b.primary, fontSize: 19, pulse: b.primary },
        b.action,
        layer
      );
    });

    layer.setAlpha(0);
    this.tweens.add({ targets: layer, alpha: 1, duration: 260 });
    if (won) this.celebrate();
  }
}
