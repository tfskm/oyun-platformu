import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

/** Kelime Avı — bağımsız build, çıktı dist/games/word-hunt/ */
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: '/games/word-hunt/',
  build: {
    outDir: fileURLToPath(new URL('../../dist/games/word-hunt', import.meta.url)),
    emptyOutDir: true,
    target: 'es2020',
    assetsInlineLimit: 0,
    sourcemap: false,
  },
  server: {
    port: 5175,
    host: true,
  },
});
