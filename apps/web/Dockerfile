FROM node:24-bookworm-slim AS builder
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@11.1.2 --activate
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
RUN pnpm --filter lattice-web... install --frozen-lockfile
COPY apps/web ./apps/web
RUN pnpm --filter lattice-web build

FROM node:24-bookworm-slim AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder /app/apps/web/drizzle ./apps/web/drizzle
WORKDIR /app/apps/web
EXPOSE 3000
CMD ["node", "server.js"]
