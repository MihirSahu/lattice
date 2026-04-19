FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends bash curl ca-certificates awscli \
  && rm -rf /var/lib/apt/lists/*

COPY services/sync-worker/package.json ./services/sync-worker/package.json
COPY services/sync-worker/tsconfig.json ./services/sync-worker/tsconfig.json
RUN cd services/sync-worker && npm install

COPY scripts ./scripts
COPY services/sync-worker ./services/sync-worker
RUN cd services/sync-worker && npm run build

ENV NODE_ENV=production
ENV SYNC_WORKER_PORT=4000

EXPOSE 4000

CMD ["node", "services/sync-worker/dist/server.js"]
