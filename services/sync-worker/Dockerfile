FROM node:22-bookworm-slim AS deps

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY services/sync-worker/package.json ./services/sync-worker/package.json
COPY services/sync-worker/package-lock.json ./services/sync-worker/package-lock.json
COPY services/sync-worker/tsconfig.json ./services/sync-worker/tsconfig.json
RUN cd services/sync-worker && npm ci

FROM node:22-bookworm-slim AS builder

WORKDIR /app

COPY --from=deps /app/services/sync-worker/node_modules ./services/sync-worker/node_modules
COPY scripts ./scripts
COPY services/sync-worker ./services/sync-worker
RUN cd services/sync-worker && npm run build
RUN cd services/sync-worker && npm prune --omit=dev

FROM node:22-bookworm-slim AS runner

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends bash curl ca-certificates awscli \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV SYNC_WORKER_PORT=4000

COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/services/sync-worker/package.json ./services/sync-worker/package.json
COPY --from=builder /app/services/sync-worker/node_modules ./services/sync-worker/node_modules
COPY --from=builder /app/services/sync-worker/dist ./services/sync-worker/dist

EXPOSE 4000

CMD ["node", "services/sync-worker/dist/server.js"]
