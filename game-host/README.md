# OYUN HOST (bağımsız oyun servisi)

Bu depo **Taskonomix'ten tamamen ayrıdır**. Kendi VPS'imizde, kendi Coolify
resource'umuzda, kendi domainimizde çalışır. Taskonomix kodu, veritabanı veya
deploy'u ile hiçbir bağlantısı yoktur.

- Veritabanı yok
- `/api` yok
- Telegram `initData` işlenmez
- SPA fallback yok; bilinmeyen yol = 404
- `/healthz` → `ok`

**Canlı oyunlar:**
- https://oyun.179.253.91.172.sslip.io/games/gem-match/
- https://oyun.179.253.91.172.sslip.io/games/word-hunt/

(`/healthz` → ok)

## Yerel test

```bash
npm install
npm run build:games
node game-host/server.cjs         # → http://localhost:3000/games/gem-match/
```

## Coolify kurulumu

1. Coolify → **New resource** → **Public Repository** → `tfskm/oyun-platformu`.
2. Branch: `main`.
3. Build pack: **Dockerfile**.
4. **Build context (Base directory): `/`** — repo kökü olmalı.
5. **Dockerfile location: `game-host/Dockerfile`**.
6. Port: **3000**. Healthcheck path: **`/healthz`**.
7. Domain: örn. `oyun.179.253.91.172.sslip.io` veya kendi alt domainin.
8. Deploy. Doğrulama:
   - `GET /healthz` → `ok`
   - `GET /games/gem-match/` → oyun HTML'i (`no-store`)
   - `GET /games/gem-match/assets/index-*.js` → JS (`immutable`)
   - `GET /api/query` → **404** olmalı

> Build context'i `game-host/` yaparsan Docker `../games` ve `../package.json`'u
> göremez. Bu yüzden context kök, Dockerfile `game-host/Dockerfile` olmalı.

## Telegram Mini App (tamamlandı)

- Bot: `@gemmatch_bot`
- Başlık: **Gem Match**
- Web App URL: `https://oyun.179.253.91.172.sslip.io/games/gem-match/`
- Kısa ad: `gemmatch`
- Açılış linki: https://t.me/gemmatch_bot/gemmatch

Menü butonu veya mesaj içinde "Oyunu Aç" düğmesi istersen Bot API tarafında
`short_name: gemmatch` ile WebApp butonu eklenir (bot token gerekir).

`?lang=tr` / `?lang=en` ile dili test edebilirsin. Dil, Telegram kullanıcı dilinden
veya menüdeki TR/EN düğmesinden de otomatik seçilir.

## Yeni oyun eklenince

`games/<id>/` build'i `dist/games/<id>/` altına yazdığı için bu sunucuya tek satır
ekleme gerekmez. `package.json` içindeki `build:games` komutuna yeni oyunun
`vite build` satırını eklemek yeterli (bkz. `OYUN-PLATFORMU.md`).
