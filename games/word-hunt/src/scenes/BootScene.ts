
import Phaser from 'phaser';
import { HEX_SIZE } from '../theme.js';

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
    Math.round(ab + (bb - ar) * k)
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
  hexJoker: {
    shadow: 0x1f0414,
    wallDark: 0x4a0d33,
    wall: 0xb0306e,
    faceEdge: 0xc4417f,
    faceCenter: 0xffa6d2,
    rimLight: 0xffe1f0,
    rimDark: 0x7a1d4d,
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
  hexRainbow: {
    shadow: 0x1a052b,
    wallDark: 0x5c0979,
    wall: 0x00d2ff,
    faceEdge: 0x9b51e0,
    faceCenter: 0x00ffcc,
    rimLight: 0xffffff,
    rimDark: 0x7928ca,
  },
  hexFrenzy: {
    shadow: 0x3d0000,
    wallDark: 0x8a0000,
    wall: 0xff3b30,
    faceEdge: 0xff9500,
    faceCenter: 0xffea00,
    rimLight: 0xffffff,
    rimDark: 0xcc0000,
  },
};

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    this.buildHexes();
    this.buildFx();
    this.buildMascot();
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

    // 1) Yumuşak zemin gölgesi
    for (let k = 5; k >= 0; k--) {
      g.fillStyle(p.shadow, 0.08);
      g.fillPoints(poly(R + k * 1.4, 0, 9 + k * 0.6), true);
    }

    // 2) Kalınlık: yan duvar
    const depth = 9;
    for (let d = depth; d >= 1; d--) {
      g.fillStyle(mix(p.wallDark, p.wall, (depth - d) / depth), 1);
      g.fillPoints(poly(R, 0, d), true);
    }

    // 3) Üst yüzey: radyal degrade
    const steps = 16;
    for (let s = 0; s < steps; s++) {
      const f = s / (steps - 1);
      g.fillStyle(mix(p.faceEdge, p.faceCenter, f), 1);
      g.fillPoints(poly(R * (1 - f * 0.84), -f * 5, -f * 6), true);
    }

    // 4) Bevel: kenarlar
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

    // 5) İnce iç çerçeve
    g.lineStyle(1.5, p.rimLight, 0.22);
    g.strokePoints(poly(R * 0.76, -1, -2), true);

    // 6) Cam parlaması
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

  private buildMascot(): void {
    // Sevimli Arı Maskotu Dokusu (Petekler üzerinde gezen karakter)
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    // Gövde (Sarı & Siyah şeritler)
    g.fillStyle(0xffd166, 1);
    g.fillEllipse(32, 34, 40, 30);
    g.fillStyle(0x1a1a24, 1);
    g.fillRect(24, 20, 5, 28);
    g.fillRect(35, 20, 5, 28);
    // Gözler
    g.fillStyle(0xffffff, 1);
    g.fillCircle(44, 30, 4);
    g.fillStyle(0x000000, 1);
    g.fillCircle(45, 30, 2);
    // Yanak allığı
    g.fillStyle(0xff6b8b, 0.6);
    g.fillCircle(42, 36, 3);
    // Kanatlar (Yarı saydam beyaz-mavi)
    g.fillStyle(0xdcf8ff, 0.85);
    g.fillEllipse(28, 16, 18, 12);
    g.fillEllipse(36, 14, 14, 10);
    g.lineStyle(1.5, 0xffffff, 1);
    g.strokeEllipse(28, 16, 18, 12);
    g.generateTexture('mascotBee', 64, 64);
    g.destroy();
  }

  private buildFx(): void {
    const g = this.make.graphics({ x: 0, y: 0 }, false);

    // Parçacık
    g.fillStyle(0xffffff, 0.35);
    g.fillCircle(8, 8, 8);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(8, 8, 5);
    g.generateTexture('spark', 16, 16);
    g.clear();

    // Yumuşak ışık
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
