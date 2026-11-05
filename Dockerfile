# ─── shared builder ───────────────────────────────────────────────────────────
FROM node:24-slim AS builder
WORKDIR /app

RUN apt-get update && apt-get upgrade -y && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@11.9.0 --activate

ENV CI=true

ARG VITE_API_URL=/v1
ENV VITE_API_URL=$VITE_API_URL

COPY pnpm-workspace.yaml ./
COPY package.json pnpm-lock.yaml ./
COPY packages/tsconfig/package.json ./packages/tsconfig/
COPY packages/types/package.json ./packages/types/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/

RUN pnpm install --frozen-lockfile

COPY packages ./packages
COPY apps ./apps

RUN pnpm --filter @mintit/types build
RUN pnpm --filter @mintit/api build
RUN pnpm --filter @mintit/web build

# ─── web: built SPA only, no runtime ─────────────────────────────────────────
# Consumed by mint_proxy below. To serve it with your own web server instead:
#   docker build --target web --output type=local,dest=./web-dist .
FROM scratch AS web
COPY --from=builder /app/apps/web/dist /

# ─── mint_proxy: Caddy serving the SPA and proxying the API ──────────────────
FROM caddy:2-alpine AS mint_proxy
COPY --from=web / /srv/web

# ─── mint_web runtime (API only) ─────────────────────────────────────────────
FROM node:24-slim AS mint_web
WORKDIR /app

RUN apt-get update && apt-get upgrade -y && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@11.9.0 --activate

COPY pnpm-workspace.yaml ./
COPY package.json pnpm-lock.yaml ./
COPY packages/tsconfig/package.json ./packages/tsconfig/
COPY packages/types/package.json ./packages/types/
COPY apps/api/package.json ./apps/api/

RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/packages/types/dist ./packages/types/dist

RUN mkdir -p /app/data/wallet /app/data/jwt && chown -R node:node /app/data

USER node
ENV NODE_ENV=production
CMD ["node", "apps/api/dist/src/main.js"]
