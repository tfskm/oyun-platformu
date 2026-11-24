# OYUN PLATFORMU — Proje Hafızası

> Bu dosya, projeye sonradan bakan (insan veya AI) herkesin **hiçbir şey sormadan**
> devam edebilmesi için yazıldı. Kararlar, kurallar, dosya yapısı ve mevcut durum burada.
>
> Son güncelleme: 2026-11-24 · Aşama: **2 (Gem Match + Kelime Avı bağımsız oyunlar)**
>
> **Bu depo Taskonomix'ten tamamen ayrıdır.** Taskonomix kodu, veritabanı, API'si
> ve deploy'u burada yoktur. İleride istenirse iki ürün birbirine bağlanabilir;
> bağlanmadan önce de oyunlar tek başına yayınlanabilir.

---

## 1. Temel kararlar (DEĞİŞTİRİLMEZ kabul edilir)

| # | Karar | Gerekçe |
|---|---|---|
| K1 | **Oyun önce bağımsız ürün.** Başka bir uygulamaya entegrasyon sonra ve isteğe bağlı. | Entegrasyonu erken yapmak oyun tasarımını kısıtlar. |
| K2 | **Oyun kodu hiçbir platformu tanımaz.** Sadece `GameBridge` arayüzünü bilir. | Oyunu her yerde çalıştırabilmek için. |
| K3 | **Oyun XP'si gerçek çekilebilir puana otomatik dönüşmez.** | Gerçek para = ciddi hile denetimi gerekir. |
| K4 | **Phaser yalnızca aksiyon/bulmaca oyunlarında.** Quiz, kelime, çark gibi oyunlar React + DOM. | 1.5 MB Phaser'ı metin oyununa yüklemek anlamsız. |
| K5 | **Her oyun ayrı Vite build → `dist/games/<id>/`.** | Ana paket şişmesin; oyunlar tek başına açılsın. |
| K6 | **RNG tohumu (seed) oturumdan gelir ve oyun deterministiktir.** | İleride replay ile skor doğrulaması yapılabilsin. `Math.random()` YOK. |
| K7 | **Telegram `initData` oyun koduna verilmez.** | O, ana kimlik bilgisidir. |
| K8 | **Oyun verisi genel, kimliksiz API'lerden okunmaz/yazılmaz.** | Bu depoda zaten API yok; ileride özel `/api/games/*` açılacak. |
| K9 | **İlk sürümde 2 oyun.** Sonra cilalama, sonra istenirse entegrasyon. | Yarım 6 ürün yerine tam 2 ürün. |
| K10 | **YAPACAĞIMIZ HER UYGULAMA/oyun Türkçe + İngilizce olmak zorunda.** Metin koda gömülmez; `game-kit/i18n` üzerinden `t()` ile okunur. | Kullanıcı açık istedi. Sonradan dil eklemek tüm ekranları yeniden yazdırır. |

---

## 2. Mimari

```
Tarayıcı / Telegram Mini App
        │  HTTPS
        ▼
game-host/server.cjs       ← minimal statik sunucu (API yok, DB yok)
        │  /games/<id>/
        ▼
dist/games/<id>/           ← her oyunun kendi index.html + JS'i
        │
        ▼
games/shared/game-kit      ← bridge, profil, RNG, ses, storage, i18n
```

**Bridge iki modlu:** `StandaloneBridge` (şu anki mod; seed yerel, profil
localStorage) ve `TaskonomixBridge` (gelecekte; imzalı bilet + sunucu profili).
Oyun kodu iki modda da aynıdır; sadece `bridge.start()` / `bridge.finish()`
davranışı değişir.

---

## 3. Dosya yapısı

```
games/
  shared/game-kit/src/
    types.ts      GameBridge, SessionInfo, GameResult sözleşmesi
    bridge.ts     StandaloneBridge / TaskonomixBridge
    profile.ts    XP, seviye, rekor, başarımlar (rütbe adları i18n'de)
    rng.ts        mulberry32 deterministik RNG
    audio.ts      Web Audio sentezi (dosyasız ses)
    storage.ts    güvenli localStorage
    i18n.ts       TR/EN sözlük, dil algılama, t(), fmtInt(), upper()
    index.ts      tek giriş noktası

  gem-match/
    index.html            Telegram SDK + canvas kabuğu
    vite.config.ts        base=/games/gem-match/, outDir=dist/games/gem-match
    src/
      main.ts             Phaser.Game + Telegram + dil init
      strings.ts          Gem Match TR/EN sözlüğü (kendini kaydeder)
      theme.ts            renk paleti, layout sabitleri
      telegram.ts         expand, back button, haptic, kullanıcı dili
      core/board.ts       SAF mantık (Phaser yok) — test edilebilir
      core/levels.ts      seviye/hedef/yıldız/XP kuralları
      scenes/BootScene.ts görselleri kodla üretir (asset dosyası yok)
      scenes/MenuScene.ts menü, seviye seçimi, profil, TR/EN düğmesi
      scenes/GameScene.ts tahta, animasyon, kombo, sonuç

  word-hunt/
    index.html / vite.config.ts   port 5175, /games/word-hunt/
    src/
      main.ts / theme.ts / telegram.ts / strings.ts
      core/hex.ts        petek ızgara matematiği (6 komşu, odd-q)
      core/board.ts      tahta üretimi, kelime gömme, yol kontrolü
      core/words.ts      TR/EN sözlük setleri
      core/levels.ts     süre, hedef, min harf, puan
      data/words.tr.ts   25.772 Türkçe kelime
      data/words.en.ts   14.441 İngilizce kelime
      scenes/Boot/Menu/Game

game-host/
    Dockerfile            Build: oyunları derler / Runner: statik sunucu
    server.cjs            sadece /games/... + /healthz, API yok
    README.md             Coolify ve BotFather adımları

scripts/
    test-gem-match.mjs    mantık testi (300 oyun simülasyonu)
    test-word-hunt.mjs    petek/kelime testi (92 kontrol)
    ensure-esbuild.cjs    esbuild binary garantisi
```

---

## 4. Yeni oyun ekleme rehberi

1. `games/<oyun-id>/` klasörünü aç.
2. `vite.config.ts` kopyala → `base`, `outDir`, `server.port` değerlerini değiştir.
3. `index.html` kopyala → `<title>` değiştir, Telegram SDK script'ini koru.
4. `src/theme.ts` → kendi paletin.
5. `src/strings.ts` → oyunun TR/EN metinleri; `main.ts` içinde
   `import './strings.js'` ve `initLang(tgInfo.language)` (K10).
6. Saf mantık katmanını `src/core/` altına yaz (Phaser import etme!).
   Testi: `scripts/test-<oyun>.mjs`.
7. `createBridge('<oyun-id>')` ile başla; `bridge.start()` → `seed` al.
8. Tüm rastgeleliği `createRng(seed)` üzerinden yap. `Math.random()` kullanma.
9. Oyun bitince `bridge.finish({ score, durationMs, xp, stats, clientVersion })`.
10. `package.json` içindeki `build:games` komutuna yeni build satırını ekle:
    ```
    vite build --config games/gem-match/vite.config.ts &&
    vite build --config games/<oyun-id>/vite.config.ts
    ```
11. `npm run typecheck && npm test && npm run build` → doğrula.
12. TR ve EN ekranlarını `?lang=tr` / `?lang=en` ile kontrol et.

**Kural:** Oyun içinde `localStorage`, `fetch`, `Telegram`, platform kodu doğrudan
kullanılmaz. Hepsi `game-kit` üzerinden geçer. Tek istisna: `telegram.ts`
(sadece UI: expand, geri tuşu, haptic).

### Dil kuralı (K10)

```ts
// src/strings.ts
export const STRINGS: Dict = {
  'menu.play': ['OYNA', 'PLAY'],
  'menu.target': ['Hedef {score} puan', 'Target {score} pts'],
};
registerStrings(STRINGS);
export { t, fmtInt, upper, toggleLang } from '../../shared/game-kit/src/i18n.js';

// sahne
t('menu.play');                         // OYNA | PLAY
t('menu.target', { score: fmtInt(1500) });
```

Dil sırası: `?lang=en` (test) → kullanıcı seçimi (`tq_lang_v1`) → Telegram dili →
tarayıcı dili → Türkçe. Sayılar `fmtInt()` ile dile göre biçimlenir.

---

## 5. Gem Match — teknik özet

| Konu | Detay |
|---|---|
| Tahta | 8×8, 5–6 renk |
| Eşleşme | 3+ yatay/dikey; L/T birleştirme |
| Özel taşlar | 4'lü → satır/sütun, L/T → bomba (3×3), 5'li → gökkuşağı |
| Zincirleme | Sınırsız (guard 40), kombo çarpanı `1 + (n-1)*0.5` |
| Süre | Hamle bazlı (26 → 20) |
| Yıldız | hedef ×1 = 1★, ×1.5 = 2★, ×2 = 3★ |
| XP | `6 + seviye*2 + yıldız*7 + skor/1200*3`, max 150 |
| Görseller | Kodla üretilir (`BootScene`) — asset dosyası yok |
| Ses | Web Audio sentezi — dosya yok |
| Determinizm | Aynı seed + aynı hamleler = aynı sonuç |

---

## 5b. Kelime Avı — teknik özet

| Konu | Detay |
|---|---|
| Izgara | 7×8 petek (flat-top hex, odd-q), 6 komşu yön |
| Girdi | Parmakla komşu harflere doğru çizgi; geri dönerek silinebilir |
| Kelime | En az 3 / 4 / 5 harf (seviyeye göre), sözlükte olmalı, tekrar edilemez |
| Sözlük | TR 25.772 kelime (mythes-tr), EN 14.441 kelime (google-20k) |
| Tahta | Rastgele harfler + 7-16 kelime komşu zincir olarak gömülür; seed deterministik |
| Puan | `harf² × 10 × kombo × seviye` |
| Süre | 100 saniyeden başlar, 55 saniyeye kadar düşer |
| Dil | TR/EN; tahta harfleri ve sözlük dile göre değişir |

## 6. Komutlar

```bash
npm install
npm run dev        # → http://localhost:5174/games/gem-match/
npm run dev:word   # → http://localhost:5175/games/word-hunt/
npm test           # iki oyunun mantık testleri
npm run typecheck  # tip kontrolü
npm run build      # iki oyunu dist/games/ altına derler
npm start          # → http://localhost:3000/games/gem-match/
```

---

## 7. Yayınlama

### A. Coolify (kendi VPS'imiz)

GitHub repo: `tfskm/oyun-platformu` → yeni resource → Build pack **Dockerfile** →
Build context **/** → Dockerfile **`game-host/Dockerfile`** → Port **3000** →
domain (örn. `oyun.179.253.91.172.sslip.io`). Detay: `game-host/README.md`.

**Canlı URL'ler:**
- https://oyun.179.253.91.172.sslip.io/games/gem-match/
- https://oyun.179.253.91.172.sslip.io/games/word-hunt/

Doğrulama:

```
GET /healthz                             → 200 ok
GET /games/gem-match/                    → 200 text/html, no-store
GET /games/gem-match/assets/index-*.js   → 200 application/javascript, immutable
GET /games/gem-match                     → 301 → /games/gem-match/
GET /api/query                           → 404 (API yok)
```

### B. Telegram Mini App (tamamlandı)

- Bot: `@gemmatch_bot`, başlık **Gem Match**
- Web App URL: `https://oyun.179.253.91.172.sslip.io/games/gem-match/`
- Kısa ad: `gemmatch`
- Açılış linki: https://t.me/gemmatch_bot/gemmatch
- Menü butonu: "Oyunu Başlat"

**Kelime Avı Mini App:**
- Bot: `@kelimeavi_bot`, başlık **Kelime Avı**
- Web App URL: `https://oyun.179.253.91.172.sslip.io/games/word-hunt/`
- Kısa ad: `kelimeavi`
- Açılış linki: https://t.me/kelimeavi_bot/kelimeavi
- Menü butonu: "Oyuna Başla" (Bot API `setChatMenuButton` / WebApp)

Oyun backend kullanmadığı için yeni bot token'ı gerekmez; sadece HTTPS URL yeter.

---

## 8. Planlanan veritabanı (henüz kurulmadı)

İleride skor doğrulaması / liderlik istenirse bu depoda ayrı bir API katmanı açılır:

| Tablo | Not |
|---|---|
| `game_sessions` | `id, user_id, game_id, seed, started_at, ended_at, score` |
| `game_events` | telemetri (ilk günden gerekli) |
| `game_profiles` | `user_id, xp, best jsonb` |
| `game_xp_transactions` | `UNIQUE(session_id)` → mükerrer XP engeli |

Güvenlik: XP sunucuda hesaplanır, bilet tek kullanımlık ve süreli olur.

---

## 9. Yapılanlar

| Tarih | İş |
|---|---|
| 2026-11-24 | `games/shared/game-kit`: bridge, profil, RNG, ses, depolama, i18n. |
| 2026-11-24 | Gem Match saf mantığı + 300 oyunluk test (19 kontrol). |
| 2026-11-24 | Sahneler: Boot/Menu/Game; özel taşlar, kombo, yıldız, XP. |
| 2026-11-24 | Ayrı Vite build (`dist/games/gem-match`, ~353 KB gzip). |
| 2026-11-24 | Telegram katmanı: expand, kaydırma kilidi, geri tuşu, haptic. |
| 2026-11-24 | TR/EN dil seçimi (K10) — menüde TR/EN düğmesi. |
| 2026-11-24 | `game-host`: API'siz bağımsız statik sunucu + Dockerfile. |
| 2026-11-24 | Ayrı GitHub deposu: `tfskm/oyun-platformu`. |
| 2026-11-24 | Telegram Mini App: `@gemmatch_bot`, kısa ad `gemmatch`, menü butonu. |
| 2026-11-24 | Kelime Avı: petek ızgara, TR/EN sözlük, kaydırma ile kelime, seviye/süre/puan. |

---

## 10. Sıradaki adım

1. `tfskm/oyun-platformu` deposunu Coolify'a bağla, domain ver, deploy et.
2. BotFather'da Mini App'i oluştur, telefonda gerçek dokunmayla test et.
3. Kelime Avı cilası: ipucu düğmesi, kelime açıklaması, günlük görev.
4. Gem Match cilası: seviye geçiş ekranı, ipucu, özel taş kombinasyonları.
5. Üçüncü oyun: Space Runner (aynı şema, `game-kit` tekrar kullanım testi).
6. İstenirse: Taskonomix ile bağlantı (iki ürün ayrı kalır, API üzerinden konuşur).

---

## 11. Tuzaklar (bilmeden dokunma)

1. **Build sırası:** oyun build'i `dist/games/` altına yazar; `npm run build`
   önce typecheck, sonra oyunları derler.
2. **Docker build context repo kökü olmalı.** Dockerfile `games/` ve
   `package.json`'u bu yüzden arar.
3. **Sunucuda SPA fallback yok.** Bilinmeyen yol 404 dönmeli; `/api` açılmaz.
4. **`Scale.FIT`**, tasarım 720×1280. Arayüz buna göre konumlanır.
5. **Ses** Telegram WebView'de kullanıcı etkileşiminden sonra çalışır →
   `unlockAudio()` ilk `pointerdown`'da çağrılır.
6. **`Math.random()` kullanma.** Determinizmi ve replay doğrulamasını bozar.
7. **Metinleri koda yazma (K10).** Yeni metin `strings.ts` içine, iki dilde girilir.
