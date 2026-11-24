import Phaser from 'phaser';
import { HEX_COLORS, HEX_SIZE } from '../theme.js';

/** Görseller kodla üretilir — asset dosyası yok. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    this.buildHex();
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

  private buildHex(): void {
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    const S = HEX_SIZE + 6;
    const c = S;
    const outer = this.hexPoints(c, c, HEX_SIZE - 1);
    const inner = this.hexPoints(c, c, HEX_SIZE - 7);

    g.fillStyle(0x000000, 0.35);
    g.fillPoints(outer.map((p) => new Phaser.Geom.Point(p.x + 2, p.y + 4)), true);

    g.fillStyle(HEX_COLORS.fill, 1);
    g.fillPoints(outer, true);
    g.lineStyle(2, HEX_COLORS.edge, 0.9);
    g.strokePoints(outer, true);

    g.fillStyle(HEX_COLORS.fillAlt, 0.75);
    g.fillPoints(inner, true);

    g.fillStyle(0xffffff, 0.06);
    g.fillPoints(
      this.hexPoints(c - 4, c - 5, HEX_SIZE - 16),
      true
    );

    g.generateTexture('hex', S * 2, S * 2);
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
