import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene.js';
import { MenuScene } from './scenes/MenuScene.js';
import { GameScene } from './scenes/GameScene.js';
import { H, W } from './theme.js';
import { initTelegram, tgApp } from './telegram.js';
import './strings.js'; // metinleri kaydet (yan etki)
import { initLang } from './strings.js';

/**
 * Gem Match giriş noktası.
 * Tek başına çalışır: Taskonomix olmadan da açılır, oynanır, XP biriktirir.
 * Telegram Mini App olarak da tarayıcıda da aynı kod çalışır.
 */
const tgInfo = initTelegram();
initLang(tgInfo.language);

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#05070f',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: W,
    height: H,
  },
  render: {
    antialias: true,
    powerPreference: 'high-performance',
  },
  fps: { target: 60 },
  scene: [BootScene, MenuScene, GameScene],
  audio: { noAudio: true }, // Ses game-kit içindeki Web Audio ile üretilir
});

const refresh = () => game.scale.refresh();
window.addEventListener('resize', refresh);
window.addEventListener('orientationchange', () => setTimeout(refresh, 250));

// Telegram viewport değişimleri (klavye, tam ekran, döndürme)
const tg = tgApp();
if (tg?.onEvent) {
  try {
    tg.onEvent('viewportChanged', refresh);
  } catch {
    /* yut */
  }
}

// Geliştirme kolaylığı: konsoldan sahne durumunu görmek için.
if (import.meta.env.DEV) {
  (window as any).__GEM = game;
  (window as any).__TG_INFO = tgInfo;
}
