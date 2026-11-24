import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

/**
 * Gem Match — BAĞIMSIZ build.
 * Çıktı: dist/games/gem-match/  (kendi index.html'i ile tek başına çalışır)
 *
 * `npm run dev:game`  → http://localhost:5174/games/gem-match/
 * `npm run build:games` → dist/games/gem-match/
 */
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: '/games/gem-match/',
  build: {
    outDir: fileURLToPath(new URL('../../dist/games/gem-match', import.meta.url)),
    emptyOutDir: true,
    target: 'es2020',
    assetsInlineLimit: 0,
    sourcemap: false,
  },
  server: {
    port: 5174,
    host: true,
  },
});
