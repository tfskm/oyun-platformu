import Phaser from 'phaser';
import { PALETTE } from './theme.js';
import { play, unlockAudio } from '../../shared/game-kit/src/index.js';
import { haptic } from './telegram.js';

const FONT = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';

export interface ButtonOpts {
  /** Altın renkli ana buton. */
  primary?: boolean;
  fontSize?: number;
  /** Etiket altında küçük açıklama. */
  sub?: string;
  /** Ana butonun etrafındaki nabız parıltısı. */
  pulse?: boolean;
  /** Kenarlık rengi (ikincil butonlar için vurgu). */
  border?: number;
  labelColor?: string;
  letterSpacing?: number;
}

export interface UiButton {
  container: Phaser.GameObjects.Container;
  label: Phaser.GameObjects.Text;
  sub?: Phaser.GameObjects.Text;
}

/**
 * Modern 3B buton: kalın alt kenar, cam parlaması, basınca çöker, bırakınca zıplar.
 * Dokunma `pointerdown` ile alınır (Telegram WebView'de en güvenilir olan bu);
 * olay yayılımı durdurulur, böylece arkadaki tahta girdisini tetiklemez.
 */
export function addButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  text: string,
  opts: ButtonOpts,
  onTap: () => void,
  parent?: Phaser.GameObjects.Container
): UiButton {
  const primary = !!opts.primary;
  const r = Math.min(28, h / 2.4);
  const lip = Math.max(5, Math.round(h * 0.09));
  const face = h - lip;

  const container = scene.add.container(x, y);

  if (opts.pulse) {
    const glow = scene.add.graphics();
    glow.fillStyle(primary ? 0xffd166 : 0x7dffe0, 0.18);
    glow.fillRoundedRect(-w / 2 - 14, -h / 2 - 12, w + 28, h + 30, r + 10);
    container.add(glow);
    scene.tweens.add({ targets: glow, alpha: 0.35, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.32);
  g.fillRoundedRect(-w / 2 + 2, -h / 2 + lip + 4, w, face, r);
  g.fillStyle(primary ? 0xa86a12 : 0x0d1730, 1);
  g.fillRoundedRect(-w / 2, -h / 2 + lip, w, face, r);
  g.fillStyle(primary ? 0xffd166 : 0x243658, 1);
  g.fillRoundedRect(-w / 2, -h / 2, w, face, r);
  g.fillStyle(0xffffff, primary ? 0.28 : 0.1);
  g.fillRoundedRect(-w / 2 + 6, -h / 2 + 4, w - 12, face / 2 - 3, { tl: r - 5, tr: r - 5, bl: 8, br: 8 });
  g.lineStyle(2, opts.border ?? (primary ? 0xfff0b8 : 0x3b5486), 1);
  g.strokeRoundedRect(-w / 2, -h / 2, w, face, r);
  container.add(g);

  const size = opts.fontSize ?? 22;
  const hasSub = !!opts.sub;
  const label = scene.add
    .text(0, -lip / 2 - (hasSub ? size * 0.42 : 0), text, {
      fontFamily: FONT,
      fontSize: `${size}px`,
      color: opts.labelColor ?? (primary ? '#3a2500' : PALETTE.text),
      fontStyle: 'bold',
    })
    .setOrigin(0.5);
  if (opts.letterSpacing) label.setLetterSpacing(opts.letterSpacing);
  container.add(label);

  let sub: Phaser.GameObjects.Text | undefined;
  if (hasSub) {
    sub = scene.add
      .text(0, -lip / 2 + size * 0.78, opts.sub!, {
        fontFamily: FONT,
        fontSize: `${Math.max(12, Math.round(size * 0.66))}px`,
        color: primary ? '#6b4a10' : PALETTE.textDim,
      })
      .setOrigin(0.5);
    container.add(sub);
  }

  const zone = scene.add.zone(0, 0, w, h).setOrigin(0.5).setInteractive({ useHandCursor: true });
  container.add(zone);

  zone.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
    ev?.stopPropagation?.();
    unlockAudio();
    play('click');
    haptic('light');
    scene.tweens.killTweensOf(container);
    scene.tweens.add({ targets: container, scale: 0.94, duration: 70, ease: 'Sine.easeOut' });
    const release = () => {
      scene.tweens.add({ targets: container, scale: 1, duration: 220, ease: 'Back.easeOut' });
    };
    scene.input.once('pointerup', release);
    scene.time.delayedCall(90, onTap);
  });

  if (parent) parent.add(container);
  return { container, label, sub };
}
