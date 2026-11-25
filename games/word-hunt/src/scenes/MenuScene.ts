import Phaser from 'phaser';
import { PALETTE, W, H, WORLDS } from '../theme.js';
import { isBoss, LEVELS_PER_WORLD, levelDef, MAX_LEVEL, WORLD_COUNT, worldOf } from '../core/levels.js';
import { starsOf, totalStars } from '../progress.js';
import {
  fmtInt,
  getLang,
  isMuted,
  levelInfo,
  loadProfile,
  play,
  setMuted,
  t,
  toggleLang,
  unlockAudio,
  upper,
} from '../../../shared/game-kit/src/index.js';
import { closeApp, haptic, setBackButton, tgApp } from '../telegram.js';

const FONT = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';

export class MenuScene extends Phaser.Scene {
  private level = 1;
  private requestedLevel = 0;
  private unlocked = 1;
  private page = 0;
  private gridLayer!: Phaser.GameObjects.Container;
  private worldText!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;
  private targetText!: Phaser.GameObjects.Text;
  private bossText!: Phaser.GameObjects.Text;
  private mutedLabel!: Phaser.GameObjects.Text;

  constructor() {
    super('Menu');
  }

  init(data: { level?: number }): void {
    this.requestedLevel = Math.max(0, Number(data?.level) || 0);
  }

  create(): void {
    this.unlocked = this.nextLevel();
    this.level = Math.min(this.requestedLevel || this.unlocked, MAX_LEVEL);
    this.page = worldOf(this.level);
    this.buildBackground();
    this.buildTitle();
    this.buildWorldNav();
    this.gridLayer = this.add.container(0, 0).setDepth(5);
    this.buildCard();
    this.buildPlayButton();
    this.buildProfileBar();
    this.buildSoundToggle();
    this.buildLangToggle();
    this.rebuildGrid();
    this.refreshCard();

    setBackButton(() => {
      haptic('light');
      closeApp();
    });

    this.add
      .text(W / 2, H - 30, t('menu.footer'), { fontFamily: FONT, fontSize: '16px', color: PALETTE.textDim })
      .setOrigin(0.5)
      .setAlpha(0.7);

    this.cameras.main.fadeIn(320, 7, 11, 24);
  }

  private nextLevel(): number {
    const p = loadProfile();
    const best = p.games['word-hunt']?.bestLevel ?? 0;
    return Math.max(1, Math.min(MAX_LEVEL, best + 1));
  }

  private hexKey(world: number): string {
    return world === 0 ? 'hex' : `hex${world}`;
  }

  /** Basılınca küçülüp geri yaylanan, dokunsal his veren düğme davranışı. */
  private press(zone: Phaser.GameObjects.Zone, target: Phaser.GameObjects.GameObject, action: () => void): void {
    zone.on('pointerdown', () => {
      unlockAudio();
      play('click');
      haptic('light');
      this.tweens.killTweensOf(target);
      this.tweens.add({
        targets: target,
        scale: 0.92,
        duration: 70,
        yoyo: true,
        ease: 'Sine.easeOut',
        onComplete: () => action(),
      });
    });
  }

  private buildBackground(): void {
    const th = WORLDS[worldOf(this.level)];
    const g = this.add.graphics();
    g.fillGradientStyle(th.bgTop, th.bgTop, th.bgBottom, th.bgBottom, 1);
    g.fillRect(0, 0, W, H);

    const a = this.add.image(W / 2, 330, 'dot').setDisplaySize(1000, 1000).setAlpha(0.12).setTint(th.glowA).setBlendMode(Phaser.BlendModes.ADD);
    const b = this.add.image(120, 1100, 'dot').setDisplaySize(800, 800).setAlpha(0.1).setTint(th.glowB).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: a, alpha: 0.22, x: W / 2 + 80, duration: 5200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: b, alpha: 0.2, x: 320, duration: 6400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // Yavaş süzülen cam petekler + ışık noktaları
    for (let i = 0; i < 16; i++) {
      const x = ((i * 137) % 720) + 10;
      const y = ((i * 211) % 1200) + 40;
      const hex = this.add
        .image(x, y, this.hexKey(worldOf(this.level)))
        .setScale(0.3 + (i % 5) * 0.16)
        .setAlpha(0.07 + (i % 3) * 0.03)
        .setAngle((i * 23) % 60);
      this.tweens.add({
        targets: hex,
        y: y - 140 - (i % 4) * 50,
        angle: hex.angle + 40,
        duration: 12000 + (i % 6) * 2200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
    for (let i = 0; i < 16; i++) {
      const fx = (i * 97) % 720;
      const fy = 300 + ((i * 173) % 900);
      const fly = this.add
        .image(fx, fy, 'dot')
        .setDisplaySize(16 + (i % 4) * 8, 16 + (i % 4) * 8)
        .setTint(i % 2 ? th.glowA : 0xffffff)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(0);
      this.tweens.add({
        targets: fly,
        y: fy - 240,
        x: fx + ((i % 3) - 1) * 60,
        alpha: { from: 0, to: 0.5 },
        duration: 5200 + (i % 5) * 900,
        delay: (i % 7) * 600,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }

  private buildTitle(): void {
    const th = WORLDS[worldOf(this.level)];
    const main = getLang() === 'tr' ? 'KELİME AVI' : 'WORD HUNT';
    this.add.text(W / 2, 186, main, { fontFamily: FONT, fontSize: '72px', color: '#000000', fontStyle: 'bold' }).setOrigin(0.5).setAlpha(0.35);
    const title = this.add
      .text(W / 2, 180, main, {
        fontFamily: FONT,
        fontSize: '72px',
        color: th.accent,
        fontStyle: 'bold',
        stroke: '#05070f',
        strokeThickness: 8,
      })
      .setOrigin(0.5);
    this.tweens.add({ targets: title, y: '-=8', duration: 2000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.add
      .text(W / 2, 252, t('menu.tagline'), { fontFamily: FONT, fontSize: '16px', color: PALETTE.textDim, fontStyle: 'bold' })
      .setOrigin(0.5)
      .setLetterSpacing(2);
  }

  private buildWorldNav(): void {
    const th = WORLDS[this.page];
    this.worldText = this.add
      .text(W / 2, 336, '', { fontFamily: FONT, fontSize: '32px', color: th.accent, fontStyle: 'bold', stroke: '#05070f', strokeThickness: 5 })
      .setOrigin(0.5)
      .setLetterSpacing(3);
    const arrow = (x: number, label: string, dir: number) => {
      const tx = this.add
        .text(x, 334, label, { fontFamily: FONT, fontSize: '64px', color: PALETTE.accent, fontStyle: 'bold' })
        .setOrigin(0.5)
        .setAlpha(0.9);
      const zone = this.add.zone(x, 334, 110, 90).setOrigin(0.5).setInteractive({ useHandCursor: true });
      this.press(zone, tx, () => {
        const next = Phaser.Math.Clamp(this.page + dir, 0, WORLD_COUNT - 1);
        if (next === this.page) return;
        this.page = next;
        this.rebuildGrid();
      });
    };
    arrow(W / 2 - 270, '‹', -1);
    arrow(W / 2 + 270, '›', 1);
  }

  private rebuildGrid(): void {
    const th = WORLDS[this.page];
    this.worldText.setText(upper(t(`world.${this.page}`))).setColor(th.accent);
    this.gridLayer.removeAll(true);
    const key = this.hexKey(this.page);

    for (let k = 0; k < LEVELS_PER_WORLD; k++) {
      const n = this.page * LEVELS_PER_WORLD + k + 1;
      const c = k % 5;
      const r = Math.floor(k / 5);
      const x = W / 2 + (c - 2) * 118 + (r ? 34 : -34);
      const y = 470 + r * 132;
      const locked = n > this.unlocked;
      const sel = n === this.level;
      const size = sel ? 118 : 100;

      const img = this.add
        .image(x, y, sel ? 'hexOn' : isBoss(n) ? 'hexBonus' : key)
        .setDisplaySize(size, size)
        .setAlpha(locked ? 0.28 : 1);
      const num = this.add
        .text(x, y - 3, String(n), {
          fontFamily: FONT,
          fontSize: sel ? '38px' : '32px',
          color: sel ? PALETTE.hexTextOn : PALETTE.hexText,
          fontStyle: 'bold',
          stroke: sel ? '#ffe9a6' : '#04202a',
          strokeThickness: 3,
        })
        .setOrigin(0.5)
        .setAlpha(locked ? 0.45 : 1);
      const items: Phaser.GameObjects.GameObject[] = [img, num];

      const stars = starsOf(n);
      for (let s = 0; s < 3; s++) {
        items.push(
          this.add
            .image(x + (s - 1) * 22, y + 50, 'star5')
            .setDisplaySize(18, 18)
            .setTint(s < stars ? 0xffd166 : 0x24365f)
            .setAlpha(locked ? 0.25 : 1)
        );
      }
      if (sel) {
        this.tweens.add({ targets: img, scale: { from: img.scale, to: img.scale * 1.06 }, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      }

      const zone = this.add.zone(x, y, 104, 108).setOrigin(0.5).setInteractive({ useHandCursor: true });
      this.press(zone, img, () => {
        if (n > this.unlocked) {
          this.cameras.main.shake(100, 0.003);
          this.targetText.setText(t('menu.locked')).setColor(PALETTE.danger);
          return;
        }
        this.level = n;
        this.rebuildGrid();
        this.refreshCard();
      });
      items.push(zone);
      this.gridLayer.add(items);
    }
  }

  private buildCard(): void {
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.28);
    g.fillRoundedRect(W / 2 - 270, 702, 540, 140, 28);
    g.fillStyle(0x13203a, 0.82);
    g.fillRoundedRect(W / 2 - 270, 696, 540, 140, 28);
    g.fillStyle(0xffffff, 0.06);
    g.fillRoundedRect(W / 2 - 270, 696, 540, 50, { tl: 28, tr: 28, bl: 0, br: 0 });
    g.lineStyle(2, 0x3a5080, 1);
    g.strokeRoundedRect(W / 2 - 270, 696, 540, 140, 28);

    this.levelText = this.add
      .text(W / 2, 738, '', { fontFamily: FONT, fontSize: '40px', color: PALETTE.text, fontStyle: 'bold' })
      .setOrigin(0.5)
      .setLetterSpacing(3);
    this.bossText = this.add
      .text(W / 2 + 250, 716, '', { fontFamily: FONT, fontSize: '15px', color: PALETTE.danger, fontStyle: 'bold' })
      .setOrigin(1, 0.5)
      .setLetterSpacing(2);
    this.targetText = this.add
      .text(W / 2, 792, '', { fontFamily: FONT, fontSize: '19px', color: PALETTE.textDim })
      .setOrigin(0.5);
  }

  private refreshCard(): void {
    const def = levelDef(this.level);
    this.levelText.setText(`${upper(t('menu.levelLabel'))} ${def.level}`);
    this.targetText
      .setText(t('menu.target', { score: fmtInt(def.target), seconds: def.seconds }))
      .setColor(PALETTE.textDim);
    this.bossText.setText(def.boss ? `★ ${upper(t('game.boss'))}` : '');
    this.tweens.add({ targets: this.levelText, scale: { from: 1.16, to: 1 }, duration: 220, ease: 'Back.easeOut' });
  }

  private buildPlayButton(): void {
    const x = W / 2;
    const y = 930;
    const btn = this.add.container(x, y);
    const glow = this.add.graphics();
    glow.fillStyle(0xffd166, 0.18);
    glow.fillRoundedRect(-240, -66, 480, 132, 40);
    const base = this.add.graphics();
    base.fillStyle(0xb9791a, 1);
    base.fillRoundedRect(-215, -48, 430, 108, 34);
    base.fillStyle(0xffd166, 1);
    base.fillRoundedRect(-215, -56, 430, 104, 34);
    base.fillStyle(0xffffff, 0.35);
    base.fillRoundedRect(-195, -50, 390, 22, 11);
    const label = this.add
      .text(0, -6, upper(t('common.play')), { fontFamily: FONT, fontSize: '48px', color: '#3a2500', fontStyle: 'bold' })
      .setOrigin(0.5)
      .setLetterSpacing(6);
    btn.add([glow, base, label]);
    btn.setDepth(6);

    // "Bana dokun" nabzı
    this.tweens.add({ targets: glow, alpha: { from: 1, to: 0.35 }, duration: 900, yoyo: true, repeat: -1 });
    this.tweens.add({ targets: btn, scale: { from: 1, to: 1.025 }, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    const zone = this.add.zone(x, y, 430, 112).setOrigin(0.5).setInteractive({ useHandCursor: true });
    zone.on('pointerdown', () => {
      unlockAudio();
      play('click');
      haptic('medium');
      this.tweens.killTweensOf(btn);
      this.tweens.add({
        targets: btn,
        scale: 0.93,
        duration: 80,
        yoyo: true,
        onComplete: () => {
          this.cameras.main.fadeOut(220, 7, 11, 24);
          this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Game', { level: this.level }));
        },
      });
    });
  }

  private buildProfileBar(): void {
    const p = loadProfile();
    const info = levelInfo(p.xp);
    const stats = p.games['word-hunt'];
    const barW = 460;
    const x = W / 2 - barW / 2;
    const y = 1040;

    const tgUser = tgApp()?.initDataUnsafe?.user;
    if (tgUser) {
      const name = [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ').trim() || tgUser.username;
      if (name) {
        this.add
          .text(W / 2, y - 44, t('common.welcome', { name }), { fontFamily: FONT, fontSize: '18px', color: PALETTE.accent, fontStyle: 'bold' })
          .setOrigin(0.5)
          .setAlpha(0.9);
      }
    }

    this.add
      .text(W / 2, y, t('common.levelOf', { level: info.level, title: info.title }), {
        fontFamily: FONT,
        fontSize: '21px',
        color: PALETTE.text,
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    const track = this.add.graphics();
    track.fillStyle(0x16213f, 1);
    track.fillRoundedRect(x, y + 30, barW, 16, 8);
    if (info.progress > 0) {
      const fill = this.add.graphics();
      fill.fillStyle(0xffd166, 1);
      fill.fillRoundedRect(x, y + 30, Math.max(16, barW * info.progress), 16, 8);
      fill.fillStyle(0xffffff, 0.3);
      fill.fillRoundedRect(x + 3, y + 33, Math.max(8, barW * info.progress - 6), 4, 2);
    }

    this.add
      .text(W / 2, y + 62, `${info.xpIntoLevel} / ${info.xpForNext} XP`, { fontFamily: FONT, fontSize: '16px', color: PALETTE.textDim })
      .setOrigin(0.5);

    const parts: string[] = [];
    if (stats && stats.bestScore > 0) parts.push(`${t('common.best')}: ${fmtInt(stats.bestScore)}`);
    parts.push(`★ ${t('menu.stars', { n: totalStars(), m: MAX_LEVEL * 3 })}`);
    this.add
      .text(W / 2, y + 104, parts.join('   •   '), { fontFamily: FONT, fontSize: '19px', color: PALETTE.accent, fontStyle: 'bold' })
      .setOrigin(0.5);
  }

  private buildSoundToggle(): void {
    this.mutedLabel = this.add
      .text(W - 24, 30, upper(isMuted() ? t('common.soundOff') : t('common.soundOn')), {
        fontFamily: FONT,
        fontSize: '15px',
        color: PALETTE.textDim,
        fontStyle: 'bold',
      })
      .setOrigin(1, 0)
      .setAlpha(0.85)
      .setInteractive({ useHandCursor: true });

    this.mutedLabel.on('pointerdown', () => {
      unlockAudio();
      const next = !isMuted();
      setMuted(next);
      this.mutedLabel.setText(upper(next ? t('common.soundOff') : t('common.soundOn')));
      if (!next) play('click');
    });
  }

  private buildLangToggle(): void {
    const y = 30;
    this.add
      .text(74, y, '/', { fontFamily: FONT, fontSize: '16px', color: PALETTE.textDim, fontStyle: 'bold' })
      .setOrigin(0.5, 0)
      .setAlpha(0.6);

    const chip = (label: string, x: number) => {
      const text = this.add
        .text(x, y, label, { fontFamily: FONT, fontSize: '17px', color: PALETTE.textDim, fontStyle: 'bold' })
        .setOrigin(0.5, 0)
        .setInteractive({ useHandCursor: true });
      text.on('pointerdown', () => {
        unlockAudio();
        play('click');
        if (getLang() !== label.toLowerCase()) toggleLang();
        this.scene.restart({ level: this.level });
      });
      return text;
    };

    const tr = chip('TR', 46);
    const en = chip('EN', 102);
    const active = getLang();
    tr.setColor(active === 'tr' ? PALETTE.accent : PALETTE.textDim).setAlpha(active === 'tr' ? 1 : 0.6);
    en.setColor(active === 'en' ? PALETTE.accent : PALETTE.textDim).setAlpha(active === 'en' ? 1 : 0.6);
  }
}
