# Oyun Platformu

Canlı oyunlar:
- Gem Match: https://oyun.179.253.91.172.sslip.io/games/gem-match/
- Kelime Avı: https://oyun.179.253.91.172.sslip.io/games/word-hunt/
Telegram Mini App: https://t.me/gemmatch_bot/gemmatch  ·  kısa ad: `gemmatch`

Taskonomix'ten **tamamen bağımsız** oyun deposu. Şu anki oyun: **Gem Match**
(Telegram Mini App olarak açılabilen, Türkçe/İngilizce, mobil öncelikli).

Kendi VPS'imizde Coolify ile yayınlanır. Veritabanı yok, API yok, Taskonomix
kodu burada yok.

## Hızlı başlangıç

```bash
npm install
npm test           # mantık testi
npm run dev        # http://localhost:5174/games/gem-match/
npm run dev:word   # http://localhost:5175/games/word-hunt/
npm run build      # dist/games/gem-match/
npm start          # http://localhost:3000/games/gem-match/
```

Dili test etmek için adresin sonuna `?lang=tr` veya `?lang=en` ekle.
Menüdeki **TR / EN** düğmesi de dili değiştirir.

## Yayın

- Coolify: yeni resource → `tfskm/oyun-platformu` → Dockerfile →
  build context `/` → Dockerfile `game-host/Dockerfile` → port 3000.
- Ayrıntılı adımlar: [`game-host/README.md`](game-host/README.md)
- Kararlar, mimari, yeni oyun rehberi: [`OYUN-PLATFORMU.md`](OYUN-PLATFORMU.md)

## Telegram'da açma

BotFather → `/newapp` → Web App URL:
`https://<OYUN-DOMAIN>/games/gem-match/` → kısa ad `gemmatch`.
