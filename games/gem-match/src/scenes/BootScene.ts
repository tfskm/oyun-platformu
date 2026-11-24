import Phaser from 'phaser';
import { GEMS } from '../theme.js';

/**
 * BOOT — tüm görseller kodla üretilir.
 * Avantaj: asset dosyası yok (telif/indirme/boyut sorunu yok), tek renk paletinden
 * tutarlı bir görünüm çıkar. İleride profesyonel sprite atlasına geçilirse
 * sadece bu dosya değişir.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    this.buildGems();
    this.buildSpecialIcons();
    this.buildFx();
    this.scene.start('Menu');
  }

  private buildGems(): void {
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    const C = 32;
    const R = 29;

    GEMS.forEach((gem, i) => {
      g.clear();
      const poly = this.shapePoints(gem.shape, C, R);

      if (gem.shape === 3) {
        g.fillStyle(gem.dark, 1);
        g.fillRoundedRect(3, 3, 58, 58, 15);
        g.fillStyle(gem.main, 1);
        g.fillRoundedRect(5, 5, 54, 54, 13);
        g.fillStyle(gem.light, 0.28);
        g.fillRoundedRect(9, 9, 24, 20, 8);
        g.lineStyle(2, gem.light, 0.35);
        g.strokeRoundedRect(5, 5, 54, 54, 13);
      } else if (gem.shape === 5) {
        g.fillStyle(gem.dark, 1);
        g.fillCircle(C, C, R + 1);
        g.fillStyle(gem.main, 1);
        g.fillCircle(C, C, R - 1);
        g.fillStyle(gem.light, 0.32);
        g.fillCircle(C - 7, C - 8, 9);
        g.lineStyle(2, gem.light, 0.4);
        g.strokeCircle(C, C, R - 1);
      } else {
        // Alt gölge (derinlik hissi)
        g.fillStyle(gem.dark, 1);
        g.fillPoints(poly.map((p) => new Phaser.Geom.Point(p.x + 1, p.y + 2)), true);
        // Gövde
        g.fillStyle(gem.main, 1);
        g.fillPoints(poly, true);
        // Kenar
        g.lineStyle(2.5, gem.light, 0.45);
        g.strokePoints(poly, true);
        // Parlama
        const hi = poly.map(
          (p) => new Phaser.Geom.Point(C + (p.x - C) * 0.5 - 5, C + (p.y - C) * 0.5 - 7)
        );
        g.fillStyle(gem.light, 0.4);
        g.fillPoints(hi, true);
      }

      g.generateTexture(`gem${i}`, 64, 64);
    });

    g.destroy();
  }

  /** 0 elmas, 1 altıgen, 2 yıldız, 3 kare, 4 üçgen, 5 daire */
  private shapePoints(shape: number, cx: number, cy: number): Phaser.Geom.Point[] {
    const R = 29;
    const pt = (x: number, y: number) => new Phaser.Geom.Point(x, y);

    switch (shape) {
      case 0:
        return [pt(cx, cy - R), pt(cx + R, cy), pt(cx, cy + R), pt(cx - R, cy)];
      case 1: {
        const out: Phaser.Geom.Point[] = [];
        for (let k = 0; k < 6; k++) {
          const a = (Math.PI / 3) * k - Math.PI / 2;
          out.push(pt(cx + Math.cos(a) * R, cy + Math.sin(a) * R));
        }
        return out;
      }
      case 2: {
        const out: Phaser.Geom.Point[] = [];
        for (let k = 0; k < 10; k++) {
          const a = (Math.PI / 5) * k - Math.PI / 2;
          const rr = k % 2 === 0 ? R + 1 : R * 0.45;
          out.push(pt(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr));
        }
        return out;
      }
      case 4:
        return [pt(cx, cy - R), pt(cx + R, cy + R * 0.75), pt(cx - R, cy + R * 0.75)];
      default:
        return [pt(cx, cy - R), pt(cx + R, cy), pt(cx, cy + R), pt(cx - R, cy)];
    }
  }

  private buildSpecialIcons(): void {
    const g = this.make.graphics({ x: 0, y: 0 }, false);

    // Yatay patlama
    g.clear();
    g.fillStyle(0xffffff, 0.95);
    g.fillRoundedRect(8, 27, 48, 10, 5);
    g.fillTriangle(2, 32, 14, 22, 14, 42);
    g.fillTriangle(62, 32, 50, 22, 50, 42);
    g.generateTexture('sp_row', 64, 64);

    // Dikey patlama
    g.clear();
    g.fillStyle(0xffffff, 0.95);
    g.fillRoundedRect(27, 8, 10, 48, 5);
    g.fillTriangle(32, 2, 22, 14, 42, 14);
    g.fillTriangle(32, 62, 22, 50, 42, 50);
    g.generateTexture('sp_col', 64, 64);

    // Bomba
    g.clear();
    g.lineStyle(6, 0xffffff, 0.95);
    g.strokeCircle(32, 32, 17);
    g.fillStyle(0xffffff, 0.95);
    g.fillCircle(32, 32, 7);
    g.generateTexture('sp_bomb', 64, 64);

    // Gökkuşağı
    g.clear();
    const cols = [0xff4d6d, 0xffb020, 0x2ee6a8, 0x4d9dff, 0xb46bff, 0xeaf6ff];
    cols.forEach((col, k) => {
      const a = (Math.PI * 2 * k) / cols.length;
      g.fillStyle(col, 1);
      g.fillCircle(32 + Math.cos(a) * 16, 32 + Math.sin(a) * 16, 7);
    });
    g.lineStyle(3, 0xffffff, 0.85);
    g.strokeCircle(32, 32, 26);
    g.generateTexture('sp_rainbow', 64, 64);

    g.destroy();
  }

  private buildFx(): void {
    const g = this.make.graphics({ x: 0, y: 0 }, false);

    g.fillStyle(0xffffff, 1);
    g.fillCircle(8, 8, 7);
    g.generateTexture('spark', 16, 16);

    g.clear();
    g.lineStyle(6, 0xffffff, 1);
    g.strokeCircle(64, 64, 58);
    g.generateTexture('ring', 128, 128);

    g.clear();
    g.fillStyle(0xffffff, 0.9);
    g.fillCircle(16, 16, 15);
    g.generateTexture('dot', 32, 32);

    g.destroy();
  }
}
