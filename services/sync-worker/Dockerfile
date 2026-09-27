FROM node:24-bookworm-slim AS builder
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@12.6.0 --activate
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/package.json
COPY services/opencode-query/package.json ./services/opencode-query/package.json
COPY services/sync-worker/package.json ./services/sync-worker/package.json
COPY showcase-website/package.json ./showcase-website/package.json
COPY packages ./packages
RUN pnpm --filter lattice-sync-worker... install --frozen-lockfile
COPY services/sync-worker ./services/sync-worker
COPY scripts ./scripts
RUN pnpm --filter lattice-sync-worker build && pnpm --filter lattice-sync-worker deploy --prod /prod/service

FROM node:24-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends bash curl ca-certificates awscli && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /prod/service ./services/sync-worker
ENV SYNC_WORKER_PORT=4000
EXPOSE 4000
CMD ["node", "services/sync-worker/dist/server.js"]
