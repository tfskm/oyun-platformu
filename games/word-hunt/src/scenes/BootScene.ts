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
      const top = shifted(-2);
      g.fillStyle(face, 1);
      g.fillPoints(top, true);

      // kristal fasetler — merkezden köşelere sırayla açık/koyu üçgenler
      const center = new Phaser.Geom.Point(c, c - 2);
      for (let k = 0; k < 6; k++) {
        const a = top[k];
        const b = top[(k + 1) % 6];
        g.fillStyle(k % 2 === 0 ? 0xffffff : 0x001318, k % 2 === 0 ? 0.075 : 0.11);
        g.fillTriangle(center.x, center.y, a.x, a.y, b.x, b.y);
      }

      // iç parlama
      g.fillStyle(inner, 0.4);
      g.fillPoints(this.hexPoints(c - 3, c - 8, HEX_SIZE - 12), true);
      // kenar ışığı
      g.lineStyle(3, edge, 0.9);
      g.strokePoints(top, true);
      // üst sol küçük ışık noktası
      g.fillStyle(0xffffff, 0.2);
      g.fillPoints(this.hexPoints(c - 8, c - 12, HEX_SIZE - 20), true);

      g.generateTexture(key, pad * 2, pad * 2);
    };

    // Normal: sönük beyaz / buzlu cam
    make('hex', 0x04121a, 0x126b70, 0x2b8f93, 0x74d8cf, 0xc9fff2);
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
