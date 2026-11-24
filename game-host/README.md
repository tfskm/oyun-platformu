# OYUN HOST (bağımsız oyun servisi)

Bu depo **Taskonomix'ten tamamen ayrıdır**. Kendi VPS'imizde, kendi Coolify
resource'umuzda, kendi domainimizde çalışır. Taskonomix kodu, veritabanı veya
deploy'u ile hiçbir bağlantısı yoktur.

- Veritabanı yok
- `/api` yok
- Telegram `initData` işlenmez
- SPA fallback yok; bilinmeyen yol = 404
- `/healthz` → `ok`

**Canlı:** https://oyun.179.253.91.172.sslip.io/games/gem-match/ (`/healthz` → ok)

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

## BotFather (son adım, domain hazır olunca)

1. BotFather → `/newapp` → botunu seç.
2. Başlık: **Gem Match**
3. Web App URL: `https://<OYUN-DOMAIN>/games/gem-match/`
4. Kısa ad: `gemmatch`
5. Açılış: `https://t.me/<botun>/gemmatch`
6. Menü butonu istersen `/setmenubutton`.

`?lang=tr` / `?lang=en` ile dili test edebilirsin. Dil, Telegram kullanıcı dilinden
veya menüdeki TR/EN düğmesinden de otomatik seçilir.

## Yeni oyun eklenince

`games/<id>/` build'i `dist/games/<id>/` altına yazdığı için bu sunucuya tek satır
ekleme gerekmez. `package.json` içindeki `build:games` komutuna yeni oyunun
`vite build` satırını eklemek yeterli (bkz. `OYUN-PLATFORMU.md`).
