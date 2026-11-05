# ─── shared builder ───────────────────────────────────────────────────────────
FROM node:24-slim AS builder
WORKDIR /app

RUN apt-get update && apt-get upgrade -y && rm -rf /var/lib/apt/lists/*
RUN corepack enable

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

# ─── mint_app: API and dashboard ─────────
FROM node:24-slim AS mint_app
WORKDIR /app

RUN apt-get update && apt-get upgrade -y && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
RUN corepack enable

COPY pnpm-workspace.yaml ./
COPY package.json pnpm-lock.yaml ./
COPY packages/tsconfig/package.json ./packages/tsconfig/
COPY packages/types/package.json ./packages/types/
COPY apps/api/package.json ./apps/api/

RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/packages/types/dist ./packages/types/dist
COPY --from=builder /app/apps/web/dist ./apps/api/dist/web

COPY --chmod=755 docker/entrypoint.sh /usr/local/bin/entrypoint.sh

ENV NODE_ENV=production
ENTRYPOINT ["entrypoint.sh"]
CMD ["node", "apps/api/dist/main.js"]
