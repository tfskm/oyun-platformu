import Phaser from 'phaser';
import { HEX_SIZE } from '../theme.js';

/**
 * Görseller kodla üretilir — asset dosyası yok.
 *
 * Petek artık gerçek bir "3B karo": yumuşak zemin gölgesi, kalın yan duvar
 * (extrude), radyal degrade üst yüzey, ışığa göre aydınlık/karanlık bevel
 * kenarlar, cam parlaması ve speküler nokta. Işık sol üstten gelir.
 *
 * Dokular: 'hex' (buzlu cam), 'hexOn' (yanan kehribar), 'hexBonus' (mor bonus),
 * 'dot' (yumuşak ışık), 'spark' (parçacık), 'ring' (dalga), 'star5' (yıldız).
 */

interface HexStyle {
  shadow: number;
  wallDark: number;
  wall: number;
  faceEdge: number;
  faceCenter: number;
  rimLight: number;
  rimDark: number;
}

function mix(a: number, b: number, f: number): number {
  const k = Math.max(0, Math.min(1, f));
  const ar = (a >> 16) & 255;
  const ag = (a >> 8) & 255;
  const ab = a & 255;
  const br = (b >> 16) & 255;
  const bg = (b >> 8) & 255;
  const bb = b & 255;
  return (
    (Math.round(ar + (br - ar) * k) << 16) |
    (Math.round(ag + (bg - ag) * k) << 8) |
    Math.round(ab + (bb - ab) * k)
  );
}

const STYLES: Record<string, HexStyle> = {
  hex: {
    shadow: 0x02070f,
    wallDark: 0x04202a,
    wall: 0x0e5964,
    faceEdge: 0x155064,
    faceCenter: 0x44bcbd,
    rimLight: 0xc4fff4,
    rimDark: 0x0a3140,
  },
  hexOn: {
    shadow: 0x3a2200,
    wallDark: 0x6b3d00,
    wall: 0xc98a1c,
    faceEdge: 0xe2a22c,
    faceCenter: 0xfff1bd,
    rimLight: 0xffffff,
    rimDark: 0xb4761a,
  },
  hexBonus: {
    shadow: 0x12041f,
    wallDark: 0x25093f,
    wall: 0x5a2496,
    faceEdge: 0x6d2bb0,
    faceCenter: 0xd791ff,
    rimLight: 0xf6dcff,
    rimDark: 0x3d1670,
  },
};

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    this.buildHexes();
    this.buildFx();
    this.scene.start('Menu');
  }

  private hexPoints(cx: number, cy: number, r: number): Phaser.Geom.Point[] {
    const pts: Phaser.Geom.Point[] = [];
    for (let k = 0; k < 6; k++) {
      const a = (Math.PI / 3) * k;
      pts.push(new Phaser.Geom.Point(cx + Math.cos(a) * r, cy + Math.sin(a) * r));
    }
    return pts;
  }

  private buildHexes(): void {
    for (const [key, style] of Object.entries(STYLES)) this.bevelHex(key, style);
  }

  private bevelHex(key: string, p: HexStyle): void {
    const pad = HEX_SIZE + 14;
    const c = pad;
    const cy = pad - 3;
    const R = HEX_SIZE - 3;
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    const poly = (r: number, ox = 0, oy = 0) => this.hexPoints(c + ox, cy + oy, r);

    // 1) Yumuşak zemin gölgesi (birkaç genişleyen katman)
    for (let k = 5; k >= 0; k--) {
      g.fillStyle(p.shadow, 0.08);
      g.fillPoints(poly(R + k * 1.4, 0, 9 + k * 0.6), true);
    }

    // 2) Kalınlık: alta doğru koyulaşan yan duvar
    const depth = 9;
    for (let d = depth; d >= 1; d--) {
      g.fillStyle(mix(p.wallDark, p.wall, (depth - d) / depth), 1);
      g.fillPoints(poly(R, 0, d), true);
    }

    // 3) Üst yüzey: dıştan içe radyal degrade, merkez sol-üste kayık (ışık yönü)
    const steps = 16;
    for (let s = 0; s < steps; s++) {
      const f = s / (steps - 1);
      g.fillStyle(mix(p.faceEdge, p.faceCenter, f), 1);
      g.fillPoints(poly(R * (1 - f * 0.84), -f * 5, -f * 6), true);
    }

    // 4) Bevel: ışığa dönük kenarlar parlak, uzak kenarlar koyu
    const top = poly(R);
    const lightAngle = -Math.PI * 0.75;
    for (let k = 0; k < 6; k++) {
      const a = top[k];
      const b = top[(k + 1) % 6];
      const normal = (Math.PI / 3) * (k + 0.5);
      const lit = Math.max(0, Math.cos(normal - lightAngle));
      g.lineStyle(4, mix(p.rimDark, p.rimLight, lit), 1);
      g.lineBetween(a.x, a.y, b.x, b.y);
    }

    // 5) İnce iç çerçeve (cam derinliği)
    g.lineStyle(1.5, p.rimLight, 0.22);
    g.strokePoints(poly(R * 0.76, -1, -2), true);

    // 6) Cam parlaması: üst yarıda yarı saydam beyaz
    const gl = poly(R * 0.93, 0, -1);
    g.fillStyle(0xffffff, 0.13);
    g.fillPoints(
      [
        gl[3],
        gl[4],
        gl[5],
        gl[0],
        new Phaser.Geom.Point(c + R * 0.38, cy - R * 0.14),
        new Phaser.Geom.Point(c - R * 0.38, cy - R * 0.02),
      ],
      true
    );

    // 7) Speküler nokta
    g.fillStyle(0xffffff, 0.2);
    g.fillCircle(c - R * 0.4, cy - R * 0.5, 7);
    g.fillStyle(0xffffff, 0.7);
    g.fillCircle(c - R * 0.4, cy - R * 0.5, 3);

    g.generateTexture(key, pad * 2, pad * 2);
    g.destroy();
  }

  private buildFx(): void {
    const g = this.make.graphics({ x: 0, y: 0 }, false);

    // Parçacık: parlak çekirdekli küçük nokta
    g.fillStyle(0xffffff, 0.35);
    g.fillCircle(8, 8, 8);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(8, 8, 5);
    g.generateTexture('spark', 16, 16);
    g.clear();

    // Yumuşak ışık: üst üste binen, giderek küçülen halkalar
    for (let i = 0; i < 18; i++) {
      g.fillStyle(0xffffff, 0.12);
      g.fillCircle(16, 16, 16 - i * 0.85);
    }
    g.generateTexture('dot', 32, 32);
    g.clear();

    // Dalga halkası
    g.lineStyle(4, 0xffffff, 1);
    g.strokeCircle(32, 32, 27);
    g.lineStyle(2, 0xffffff, 0.4);
    g.strokeCircle(32, 32, 31);
    g.generateTexture('ring', 64, 64);
    g.clear();

    // Beş köşeli yıldız
    const pts: Phaser.Geom.Point[] = [];
    for (let k = 0; k < 10; k++) {
      const r = k % 2 === 0 ? 30 : 13;
      const a = -Math.PI / 2 + (Math.PI / 5) * k;
      pts.push(new Phaser.Geom.Point(32 + Math.cos(a) * r, 33 + Math.sin(a) * r));
    }
    g.fillStyle(0xffffff, 1);
    g.fillPoints(pts, true);
    g.lineStyle(2, 0xffffff, 0.5);
    g.strokePoints(pts, true);
    g.generateTexture('star5', 64, 64);
    g.destroy();
  }
}
