'use strict';

/**
 * OYUN HOST — sadece oyun dosyalarını servis eden minimal sunucu.
 * ------------------------------------------------------------------
 * Taskonomix'ten BAĞIMSIZDIR: veritabanı yok, /api yok, initData işlenmez.
 *
 * İki mod:
 *   GAME_ID yok  → tüm oyunları /games/<id>/ altında servis eder (ortak host)
 *   GAME_ID var  → sadece o oyunu kök dizinde servis eder (Coolify'da ayrı uygulama)
 *
 * Yerel:  node game-host/server.cjs
 *         GAME_ID=word-hunt node game-host/server.cjs
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const PORT = Number(process.env.PORT) || 3000;
const BIND = process.env.HOST || '0.0.0.0';
const GAME_ID = String(process.env.GAME_ID || '').trim().toLowerCase();

const candidates = [
  process.env.GAMES_ROOT,
  path.join(__dirname, 'dist', 'games'),
  path.join(__dirname, '..', 'dist', 'games'),
]
  .filter(Boolean)
  .map((p) => path.resolve(p));

const ROOT =
  candidates.find((p) => fs.existsSync(path.join(p, GAME_ID || 'gem-match', 'index.html'))) ||
  candidates.find((p) => fs.existsSync(path.join(p, 'gem-match', 'index.html'))) ||
  candidates.find((p) => fs.existsSync(path.join(p, 'word-hunt', 'index.html')));

if (!ROOT) {
  console.error('[oyun-host] oyun build bulunamadı. Önce `npm run build:games` çalıştır.');
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

function serveFile(req, res, file) {
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

  if (GAME_ID && (pathname === '/' || pathname === '/index.html')) {
    serveFile(req, res, path.resolve(ROOT, GAME_ID, 'index.html'));
    return;
  }

  if (!GAME_ID && (pathname === '/' || pathname === '/games' || pathname === '/games/')) {
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

  const gameId = match[1];
  if (GAME_ID && gameId !== GAME_ID) {
    notFound(res);
    return;
  }

  const base = path.resolve(ROOT, gameId);
  let relative = match[2];
  if (!relative || relative.endsWith('/')) relative += 'index.html';

  const file = path.resolve(base, relative.replace(/^\/+/, ''));
  if (file !== path.join(base, 'index.html') && !file.startsWith(base + path.sep)) {
    notFound(res);
    return;
  }
  serveFile(req, res, file);
});

server.listen(PORT, BIND, () => {
  const pathLabel = GAME_ID ? '/' : `/games/${GAME_ID || 'gem-match'}/`;
  console.log(`[oyun-host] http://${BIND}:${PORT}${pathLabel}  (root: ${ROOT}, game: ${GAME_ID || 'all'})`);
});

process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT', () => server.close(() => process.exit(0)));
