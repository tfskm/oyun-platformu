# OYUN HOST — bağımsız Coolify servisi.
# Build context: REPO KÖKÜ (Dockerfile konumu: game-host/Dockerfile).
# Bu depo Taskonomix'ten tamamen ayrıdır; kendi resource'umuz olarak kurulur.

# ---- 1) Build: sadece oyunları derle ----------------------------------
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY scripts/ensure-esbuild.cjs scripts/ensure-esbuild.cjs
RUN npm ci --include=dev --no-audit --no-fund

COPY tsconfig.json ./
COPY games/ games/
RUN npm run build:games

# ---- 2) Runner: statik dosya sunucusu, Ekstra bağımlılık yok -----------
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000

COPY game-host/server.cjs ./server.cjs
COPY --from=build /app/dist/games ./dist/games

RUN addgroup -S game && adduser -S game -G game \
    && chown -R game:game /app
USER game

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -q -O- http://127.0.0.1:3000/healthz >/dev/null || exit 1

CMD ["node", "server.cjs"]
