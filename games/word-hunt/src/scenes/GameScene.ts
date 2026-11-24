import Phaser from 'phaser';
import { H, LAYOUT, PALETTE, W } from '../theme.js';
import { levelDef, MAX_LEVEL, scoreWord, starsFor, xpFor, type LevelDef } from '../core/levels.js';
import {
  boardSize,
  COLS,
  hexPos,
  HEX_SIZE,
  isAdjacent,
  ROWS,
} from '../core/hex.js';
import { checkPath, generateBoard, type Board, type CheckResult } from '../core/board.js';
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
  }

  create(): void {
    this.lang = getLang();
    this.bridge = createBridge('word-hunt');
    this.buildBackground();
    this.buildHud();
    this.buildBoard();

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
    g.fillGradientStyle(0x0d1730, 0x0d1730, 0x05070f, 0x05070f, 1);
    g.fillRect(0, 0, W, H);
    this.add
      .image(W / 2, 600, 'dot')
      .setDisplaySize(950, 950)
      .setAlpha(0.05)
      .setTint(0xffd166)
      .setBlendMode(Phaser.BlendModes.ADD);
  }

  private buildHud(): void {
    const panel = this.add.graphics();
    panel.fillStyle(0x13203a, 0.95);
    panel.fillRoundedRect(28, 40, W - 56, 184, 26);
    panel.lineStyle(2, 0x2a3c60, 1);
    panel.strokeRoundedRect(28, 40, W - 56, 184, 26);

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
      })
      .setOrigin(0.5)
      .setDepth(100);

    this.bar = this.add.graphics().setDepth(100);

    this.foundText = this.add
      .text(W / 2, 194, '', {
        fontFamily: FONT,
        fontSize: '18px',
        color: PALETTE.textDim,
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(100);

    this.add
      .text(W / 2, 216, upper(t('game.howto')), {
        fontFamily: FONT,
        fontSize: '12px',
        color: PALETTE.textDim,
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setAlpha(0.8);

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
    this.pathG = this.add.graphics().setDepth(8);

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
  }

  private begin(): void {
    const gen = generateBoard(this.rng, this.lang, this.def.plantCount);
    this.board = gen.cells;
    this.planted = gen.planted;

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
        .image(x, y, 'hex')
        .setDisplaySize(HEX_SIZE * 2 + 28, HEX_SIZE * 2 + 28)
        .setDepth(6)
        .setAlpha(0);

      const letter = this.add
        .text(x, y - 3, display(this.board[i].letter, this.lang), {
          fontFamily: FONT,
          fontSize: '38px',
          color: PALETTE.hexText,
          fontStyle: 'bold',
        })
        .setOrigin(0.5)
        .setDepth(10)
        .setAlpha(0);

      this.hexGlows.push(glow);
      this.hexViews.push(img);
      this.letterTexts.push(letter);
      this.hexOnFlags.push(false);
      this.tweens.add({
        targets: [img, letter],
        alpha: 1,
        duration: 280,
        delay: (i % COLS) * 22 + Math.floor(i / COLS) * 26,
      });
    }

    this.startedAt = Date.now();
    this.ready = true;
    this.bridge.track('level_start', { level: this.level, lang: this.lang });

    this.timerEvent = this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        if (this.ended) return;
        this.secondsLeft = Math.max(0, this.secondsLeft - 1);
        this.updateHud();
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
    play('select');
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
    play('select');
  }

  private onUp(): void {
    if (!this.ready || this.ended || this.path.length === 0) return;
    const result = checkPath(this.board, this.path, this.lang, this.def.minLength, this.found);
    if (result.ok) this.acceptWord(result);
    else this.rejectWord(result);
    this.clearPath();
  }

  private acceptWord(result: CheckResult): void {
    this.found.add(result.word);
    this.foundOrder.push(result.word);
    this.combo += 1;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    const gained = scoreWord(result.word.length, this.combo, this.level);
    this.score += gained;

    this.wordText.setText(display(result.word, this.lang));
    this.feedbackText.setText(`+${fmtInt(gained)}  ${t('common.great')}`).setColor(PALETTE.success);
    play('match', this.combo);
    haptic(this.combo >= 3 ? 'success' : 'light');
    this.updateHud();

    this.bridge.track('word_found', {
      level: this.level,
      word: result.word,
      length: result.word.length,
      points: gained,
      combo: this.combo,
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
  }

  private clearPath(): void {
    this.path = [];
    this.refreshPath();
  }

  private refreshPath(): void {
    this.pathG.clear();
    if (this.path.length >= 2) {
      // dış yumuşak ışık + ince renkli ip
      this.pathG.lineStyle(14, 0xff2d55, 0.22);
      this.pathG.beginPath();
      const first = this.posOf(this.path[0]);
      this.pathG.moveTo(this.originX + first.x, this.originY + first.y);
      for (let k = 1; k < this.path.length; k++) {
        const p = this.posOf(this.path[k]);
        this.pathG.lineTo(this.originX + p.x, this.originY + p.y);
      }
      this.pathG.strokePath();
      this.pathG.lineStyle(4, 0x6fffe0, 0.98);
      this.pathG.beginPath();
      this.pathG.moveTo(this.originX + first.x, this.originY + first.y);
      for (let k = 1; k < this.path.length; k++) {
        const p = this.posOf(this.path[k]);
        this.pathG.lineTo(this.originX + p.x, this.originY + p.y);
      }
      this.pathG.strokePath();
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
        img.setPosition(baseX, baseY + 7).setScale(0.86);
        this.tweens.add({
          targets: img,
          y: baseY,
          scale: 1,
          duration: 230,
          ease: 'Back.easeOut',
        });
        this.tweens.add({ targets: glow, alpha: 0.34, duration: 170 });
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
        img.setTexture('hex');
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
    this.scoreText?.setText(fmtInt(this.score));
    this.timeText?.setText(`${upper(t('common.time'))} ${this.secondsLeft}`);
    this.timeText?.setColor(this.secondsLeft <= 10 ? PALETTE.danger : PALETTE.text);
    this.foundText?.setText(
      `${t('common.found')} ${this.found.size} ${t('common.words')}  •  ${t('game.minLength', { n: this.def.minLength })}`
    );
    if (this.scoreText) {
      this.tweens.add({ targets: this.scoreText, scale: { from: 1.12, to: 1 }, duration: 180 });
    }
    if (!this.bar) return;
    const w = 480;
    const x = W / 2 - w / 2;
    const y = 168;
    const pct = Math.max(0, Math.min(1, this.score / this.def.target));
    this.bar.clear();
    this.bar.fillStyle(0x16213f, 1);
    this.bar.fillRoundedRect(x, y, w, 14, 7);
    if (pct > 0) {
      this.bar.fillStyle(pct >= 1 ? 0x37e6a6 : 0xffd166, 1);
      this.bar.fillRoundedRect(x, y, Math.max(14, w * pct), 14, 7);
    }
    this.bar.lineStyle(1, 0x2a3c60, 1);
    this.bar.strokeRoundedRect(x, y, w, 14, 7);
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
        .image(x, panelY + 152, 'spark')
        .setDisplaySize(earned ? 72 : 56, earned ? 72 : 56)
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
  }
}
