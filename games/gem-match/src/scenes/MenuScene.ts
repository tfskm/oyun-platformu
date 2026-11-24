import Phaser from 'phaser';
import { GEMS, H, PALETTE, W } from '../theme.js';
import { levelDef, MAX_LEVEL } from '../core/levels.js';
import { levelInfo, loadProfile, isMuted, setMuted, play, unlockAudio } from '../../../shared/game-kit/src/index.js';
import { closeApp, haptic, setBackButton, tgApp } from '../telegram.js';
import { fmtInt, getLang, t, toggleLang, upper } from '../strings.js';

const FONT = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';

export class MenuScene extends Phaser.Scene {
  private level = 1;
  private requestedLevel = 0;
  private levelText!: Phaser.GameObjects.Text;
  private targetText!: Phaser.GameObjects.Text;
  private mutedLabel!: Phaser.GameObjects.Text;

  constructor() {
    super('Menu');
  }

  init(data: { level?: number }): void {
    this.requestedLevel = Math.max(0, Number(data?.level) || 0);
  }

  create(): void {
    this.level = this.requestedLevel || this.nextLevel();
    this.buildBackground();
    this.buildTitle();
    this.buildLevelCard();
    this.buildPlayButton();
    this.buildProfileBar();
    this.buildSoundToggle();
    this.buildLangToggle();

    // Telegram: geri tuşu uygulamayı kapatır (menüde başka gidilecek yer yok).
    setBackButton(() => {
      haptic('light');
      closeApp();
    });

    this.add
      .text(W / 2, H - 34, t('menu.footer'), {
        fontFamily: FONT,
        fontSize: '16px',
        color: PALETTE.textDim,
      })
      .setOrigin(0.5)
      .setAlpha(0.7);

    this.cameras.main.fadeIn(320, 7, 11, 24);
  }

  private nextLevel(): number {
    const p = loadProfile();
    const best = p.games['gem-match']?.bestLevel ?? 0;
    return Math.max(1, Math.min(MAX_LEVEL, best + 1));
  }

  private buildBackground(): void {
    const g = this.add.graphics();
    g.fillGradientStyle(0x0a1226, 0x0a1226, 0x05070f, 0x05070f, 1);
    g.fillRect(0, 0, W, H);

    // Yumuşak ışık
    this.add
      .image(W / 2, 300, 'dot')
      .setDisplaySize(900, 900)
      .setAlpha(0.07)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(0x3ee0ff);

    // Yıldız alanı
    for (let i = 0; i < 70; i++) {
      const s = this.add
        .image(Phaser.Math.Between(0, W), Phaser.Math.Between(0, H), 'dot')
        .setDisplaySize(Phaser.Math.Between(2, 5), Phaser.Math.Between(2, 5))
        .setAlpha(Phaser.Math.FloatBetween(0.08, 0.4));
      this.tweens.add({
        targets: s,
        alpha: Phaser.Math.FloatBetween(0.05, 0.25),
        duration: Phaser.Math.Between(1400, 3600),
        yoyo: true,
        repeat: -1,
        delay: Phaser.Math.Between(0, 1500),
      });
    }

    // Dekoratif taşlar
    GEMS.forEach((gem, i) => {
      const x = 60 + ((i * 137) % 600);
      const y = 1080 + (i % 3) * 46;
      const img = this.add.image(x, y, `gem${i}`).setDisplaySize(46, 46).setAlpha(0.22);
      this.tweens.add({
        targets: img,
        y: y - 16,
        angle: Phaser.Math.Between(-12, 12),
        duration: Phaser.Math.Between(2200, 3400),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        delay: i * 120,
      });
    });
  }

  private buildTitle(): void {
    const shadow = this.add
      .text(W / 2 + 3, 262, 'GEM MATCH', {
        fontFamily: FONT,
        fontSize: '76px',
        color: PALETTE.accent,
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setAlpha(0.55);

    const title = this.add
      .text(W / 2, 258, 'GEM MATCH', {
        fontFamily: FONT,
        fontSize: '76px',
        color: PALETTE.gold,
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    this.tweens.add({
      targets: [title, shadow],
      y: '-=8',
      duration: 2000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.add
      .text(W / 2, 322, t('menu.tagline'), {
        fontFamily: FONT,
        fontSize: '19px',
        color: PALETTE.textDim,
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setLetterSpacing(2);
  }

  private buildLevelCard(): void {
    const g = this.add.graphics();
    g.fillStyle(0x0d1730, 0.92);
    g.fillRoundedRect(W / 2 - 270, 400, 540, 190, 26);
    g.lineStyle(2, 0x24365f, 1);
    g.strokeRoundedRect(W / 2 - 270, 400, 540, 190, 26);

    this.add
      .text(W / 2, 434, upper(t('menu.levelLabel')), {
        fontFamily: FONT,
        fontSize: '17px',
        color: PALETTE.textDim,
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setLetterSpacing(3);

    this.levelText = this.add
      .text(W / 2, 500, String(this.level), {
        fontFamily: FONT,
        fontSize: '64px',
        color: PALETTE.text,
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    this.targetText = this.add
      .text(W / 2, 556, '', {
        fontFamily: FONT,
        fontSize: '19px',
        color: PALETTE.textDim,
      })
      .setOrigin(0.5);

    const chevron = (x: number, label: string, dir: number) => {
      const t = this.add
        .text(x, 500, label, {
          fontFamily: FONT,
          fontSize: '54px',
          color: PALETTE.accent,
          fontStyle: 'bold',
        })
        .setOrigin(0.5)
        .setAlpha(0.85)
        .setInteractive({ useHandCursor: true });
      t.on('pointerdown', () => {
        unlockAudio();
        play('click');
        const next = Phaser.Math.Clamp(this.level + dir, 1, this.nextLevel());
        if (next !== this.level) {
          this.level = next;
          this.refreshLevel();
        }
      });
      return t;
    };
    chevron(W / 2 - 210, '‹', -1);
    chevron(W / 2 + 210, '›', 1);

    this.refreshLevel();
  }

  private refreshLevel(): void {
    const def = levelDef(this.level);
    this.levelText.setText(String(def.level));
    this.targetText.setText(
      t('menu.target', { score: fmtInt(def.target), moves: def.moves })
    );
    this.tweens.add({
      targets: this.levelText,
      scale: { from: 1.18, to: 1 },
      duration: 220,
      ease: 'Back.easeOut',
    });
  }

  private buildPlayButton(): void {
    const y = 700;
    const glow = this.add.graphics();
    glow.fillStyle(0x3ee0ff, 0.18);
    glow.fillRoundedRect(W / 2 - 230, y - 66, 460, 132, 34);

    const g = this.add.graphics();
    g.fillStyle(0x1ec8ea, 1);
    g.fillRoundedRect(W / 2 - 210, y - 55, 420, 110, 28);
    g.fillStyle(0x3ee0ff, 1);
    g.fillRoundedRect(W / 2 - 210, y - 58, 420, 100, 28);

    const label = this.add
      .text(W / 2, y - 8, upper(t('common.play')), {
        fontFamily: FONT,
        fontSize: '44px',
        color: '#04222b',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setLetterSpacing(4);

    const zone = this.add
      .zone(W / 2, y - 8, 420, 110)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    zone.on('pointerdown', () => {
      unlockAudio();
      play('click');
      this.cameras.main.fadeOut(220, 7, 11, 24);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('Game', { level: this.level });
      });
    });

    this.tweens.add({
      targets: [g, glow, label],
      y: '+=5',
      duration: 1600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private buildProfileBar(): void {
    const p = loadProfile();
    const info = levelInfo(p.xp);
    const stats = p.games['gem-match'];
    const barW = 460;
    const x = W / 2 - barW / 2;
    const y = 900;

    const tgUser = tgApp()?.initDataUnsafe?.user;
    if (tgUser) {
      const name = [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ').trim() || tgUser.username;
      if (name) {
        this.add
          .text(W / 2, y - 40, t('common.welcome', { name }), {
            fontFamily: FONT,
            fontSize: '18px',
            color: PALETTE.accent,
            fontStyle: 'bold',
          })
          .setOrigin(0.5)
          .setAlpha(0.9);
      }
    }

    this.add
      .text(W / 2, y, t('common.levelOf', { level: info.level, title: info.title }), {
        fontFamily: FONT,
        fontSize: '22px',
        color: PALETTE.text,
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    const track = this.add.graphics();
    track.fillStyle(0x16213f, 1);
    track.fillRoundedRect(x, y + 32, barW, 16, 8);
    if (info.progress > 0) {
      const fill = this.add.graphics();
      fill.fillStyle(0x3ee0ff, 1);
      fill.fillRoundedRect(x, y + 32, Math.max(16, barW * info.progress), 16, 8);
      fill.setAlpha(0.9);
    }

    this.add
      .text(W / 2, y + 64, `${info.xpIntoLevel} / ${info.xpForNext} XP`, {
        fontFamily: FONT,
        fontSize: '16px',
        color: PALETTE.textDim,
      })
      .setOrigin(0.5);

    if (stats && stats.bestScore > 0) {
      this.add
        .text(W / 2, y + 104, `${t('common.best')}: ${fmtInt(stats.bestScore)}`, {
          fontFamily: FONT,
          fontSize: '20px',
          color: PALETTE.gold,
          fontStyle: 'bold',
        })
        .setOrigin(0.5);
    }
  }

  private buildSoundToggle(): void {
    this.mutedLabel = this.add
      .text(W - 24, 30, this.soundLabel(), {
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
      this.mutedLabel.setText(this.soundLabel());
      if (!next) play('click');
    });
  }

  private soundLabel(): string {
    return upper(isMuted() ? t('common.soundOff') : t('common.soundOn'));
  }

  /** Dil seçici: sol üstte TR / EN. Dokununca menü aynı bölümde yeniden çizilir. */
  private buildLangToggle(): void {
    const y = 30;
    this.add
      .text(74, y, '/', {
        fontFamily: FONT,
        fontSize: '16px',
        color: PALETTE.textDim,
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0)
      .setAlpha(0.6);

    const chip = (label: string, x: number) => {
      const text = this.add
        .text(x, y, label, {
          fontFamily: FONT,
          fontSize: '17px',
          color: PALETTE.textDim,
          fontStyle: 'bold',
        })
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
