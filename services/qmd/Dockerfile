FROM node:22-bookworm-slim AS deps

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY services/qmd/package.json ./services/qmd/package.json
COPY services/qmd/package-lock.json ./services/qmd/package-lock.json
COPY services/qmd/tsconfig.json ./services/qmd/tsconfig.json
RUN cd services/qmd && npm ci

FROM node:22-bookworm-slim AS builder

WORKDIR /app

COPY --from=deps /app/services/qmd/node_modules ./services/qmd/node_modules
COPY services/qmd ./services/qmd
RUN cd services/qmd && npm run build
RUN cd services/qmd && npm prune --omit=dev

FROM node:22-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV QMD_PORT=8181

COPY --from=builder /app/services/qmd/package.json ./services/qmd/package.json
COPY --from=builder /app/services/qmd/node_modules ./services/qmd/node_modules
COPY --from=builder /app/services/qmd/dist ./services/qmd/dist

EXPOSE 8181

CMD ["node", "services/qmd/dist/server.js"]
