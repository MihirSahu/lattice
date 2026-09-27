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
RUN pnpm --filter lattice-opencode-query... install --frozen-lockfile
COPY services/opencode-query ./services/opencode-query
RUN pnpm --filter lattice-opencode-query build && pnpm --filter lattice-opencode-query deploy --prod /prod/service

FROM node:24-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /prod/service ./services/opencode-query
# Bypass the npm launcher: the SDK must own the native server PID for shutdown.
RUN test -x /app/services/opencode-query/node_modules/opencode-ai/bin/opencode.exe \
  && ln -s /app/services/opencode-query/node_modules/opencode-ai/bin/opencode.exe /usr/local/bin/opencode
ENV OPENCODE_QUERY_PORT=8282
EXPOSE 8282
CMD ["node", "services/opencode-query/dist/server.js"]
