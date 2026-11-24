import Phaser from 'phaser';
import { HEX_SIZE } from '../theme.js';

/**
 * Görseller kodla üretilir — asset dosyası yok.
 * Petek: gölge + yan duvar + üst yüzey + parlama katmanları = 3B hissi.
 * İki versiyon: 'hex' (sönük beyaz) ve 'hexOn' (yanan sarı).
 */
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
    const pad = HEX_SIZE + 14;
    const c = pad;
    const g = this.make.graphics({ x: 0, y: 0 }, false);

    const make = (
      key: string,
      shadow: number,
      wall: number,
      face: number,
      inner: number,
      edge: number
    ) => {
      g.clear();
      const outer = this.hexPoints(c, c, HEX_SIZE - 1);
      const shifted = (dy: number) => outer.map((p) => new Phaser.Geom.Point(p.x, p.y + dy));

      // zemin gölgesi
      g.fillStyle(shadow, 0.55);
      g.fillPoints(shifted(8), true);
      // yan duvar (kalın alt kenar)
      g.fillStyle(wall, 1);
      g.fillPoints(shifted(4), true);
      // üst yüzey
      g.fillStyle(face, 1);
      g.fillPoints(shifted(-2), true);
      // iç parlama
      g.fillStyle(inner, 0.55);
      g.fillPoints(this.hexPoints(c - 3, c - 7, HEX_SIZE - 10), true);
      // ince kenar ışığı
      g.lineStyle(2.5, edge, 0.85);
      g.strokePoints(shifted(-2), true);
      // küçük üst sol ışık
      g.fillStyle(0xffffff, 0.16);
      g.fillPoints(this.hexPoints(c - 7, c - 11, HEX_SIZE - 19), true);

      g.generateTexture(key, pad * 2, pad * 2);
    };

    // Normal: sönük beyaz / buzlu cam
    make('hex', 0x050a16, 0x5b6b86, 0xaebdd2, 0xdde7f5, 0xf2f7ff);
    // Seçili: sarı ışıkla yanan petek
    make('hexOn', 0x5a3a00, 0xb97c12, 0xffd166, 0xfff3c4, 0xfffbe8);

    g.destroy();
  }

  private buildFx(): void {
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(8, 8, 7);
    g.generateTexture('spark', 16, 16);
    g.clear();
    g.fillStyle(0xffffff, 0.9);
    g.fillCircle(16, 16, 15);
    g.generateTexture('dot', 32, 32);
    g.destroy();
  }
}
