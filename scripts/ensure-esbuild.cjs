// 🔧 esbuild binary kontrolü
//
// npm 11+ artık postinstall script'lerini otomatik çalıştırmıyor ("allowScripts"
// uyarısı). Bu durumda esbuild'in platform binary'si eksik kalabilir ve
// `vite build` "You installed esbuild for another platform" hatası verir.
//
// Bu betik esbuild'in resmi install.js'ini çalıştırarak binary'yi hazırlar.
// Hata olursa da build'i ENGELLEMEZ (exit 0) — vite zaten çalışıyorsa
// gereksiz yere build'i bozmamış oluruz.
const { existsSync } = require('fs');
const { join } = require('path');
const { spawnSync } = require('child_process');

try {
  const esbuildDir = join(__dirname, '..', 'node_modules', 'esbuild');
  const installJs = join(esbuildDir, 'install.js');

  if (existsSync(installJs)) {
    const res = spawnSync(process.execPath, [installJs], { stdio: 'inherit' });
    if (res.status !== 0) {
      console.warn('[ensure-esbuild] install.js uyarılı bitti, build devam ediyor');
    }
  }
} catch (err) {
  console.warn('[ensure-esbuild] atlandı:', err && err.message);
}

process.exit(0);
