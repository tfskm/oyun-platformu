'use strict';

/**
 * OYUN HOST — sadece oyun dosyalarını servis eden minimal sunucu.
 * ------------------------------------------------------------------
 * Taskonomix'ten BAĞIMSIZDIR:
 *   - veritabanı yok, /api yok, Telegram initData işlenmez
 *   - SPA fallback yok (bilinmeyen yol → 404)
 *   - sadece /games/<id>/... altındaki statik dosyalar açılır
 *
 * Yerel çalıştırma (repo kökünden):
 *   npm run build:games && node game-host/server.cjs
 *   → http://localhost:3000/games/gem-match/
 *
 * Docker/Coolify: PORT=3000, dosyalar /app/dist/games altında.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const PORT = Number(process.env.PORT) || 3000;
const BIND = process.env.HOST || '0.0.0.0';

const ROOT = [
  process.env.GAMES_ROOT,
  path.join(__dirname, 'dist', 'games'),
  path.join(__dirname, '..', 'dist', 'games'),
]
  .filter(Boolean)
  .map((p) => path.resolve(p))
  .find((p) => fs.existsSync(path.join(p, 'gem-match', 'index.html')));

if (!ROOT) {
  console.error('[oyun-host] dist/games/gem-match bulunamadı. Önce `npm run build:games` çalıştır.');
  process.exit(1);
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

const COMPRESSIBLE = /\.(html?|css|js|mjs|json|svg|xml)$/i;
const gzipCache = new Map();

function gzip(buffer, key) {
  const hit = gzipCache.get(key);
  if (hit) return hit;
  const out = zlib.gzipSync(buffer, { level: 9 });
  if (gzipCache.size < 40) gzipCache.set(key, out);
  return out;
}

function send(res, status, body, headers = {}) {
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(String(body));
  res.writeHead(status, {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Content-Length': buf.length,
    ...headers,
  });
  res.end(buf);
}

function notFound(res) {
  send(res, 404, 'Not found', { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
}

const server = http.createServer((req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    notFound(res);
    return;
  }

  if (pathname === '/healthz') {
    send(res, 200, 'ok', { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
    return;
  }

  if (pathname === '/' || pathname === '/games' || pathname === '/games/') {
    res.writeHead(302, {
      Location: '/games/gem-match/',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    res.end();
    return;
  }

  const match = /^\/games\/([a-z0-9-]+)\/(.*)$/i.exec(pathname);
  if (!match) {
    notFound(res);
    return;
  }

  const base = path.resolve(ROOT, match[1]);
  let relative = match[2];
  if (!relative || relative.endsWith('/')) relative += 'index.html';

  const file = path.resolve(base, relative.replace(/^\/+/, ''));
  if (file !== path.join(base, 'index.html') && !file.startsWith(base + path.sep)) {
    notFound(res);
    return;
  }

  fs.stat(file, (err, stat) => {
    if (err || !stat.isFile()) {
      notFound(res);
      return;
    }

    fs.readFile(file, (readErr, data) => {
      if (readErr) {
        notFound(res);
        return;
      }

      const isIndex = path.basename(file) === 'index.html';
      const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
      const headers = {
        'Content-Type': type,
        'Cache-Control': isIndex ? 'no-store' : 'public, max-age=31536000, immutable',
      };

      const acceptGzip = /\bgzip\b/i.test(String(req.headers['accept-encoding'] || ''));
      if (acceptGzip && COMPRESSIBLE.test(file)) {
        headers['Content-Encoding'] = 'gzip';
        headers.Vary = 'Accept-Encoding';
        send(res, 200, gzip(data, file), headers);
      } else {
        send(res, 200, data, headers);
      }
    });
  });
});

server.listen(PORT, BIND, () => {
  console.log(`[oyun-host] http://${BIND}:${PORT}/games/gem-match/  (root: ${ROOT})`);
});

process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT', () => server.close(() => process.exit(0)));
