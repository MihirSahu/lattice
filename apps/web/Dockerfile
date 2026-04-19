FROM node:20-bookworm-slim AS deps

WORKDIR /app

COPY apps/web/package.json apps/web/package.json
RUN cd apps/web && npm install

FROM node:20-bookworm-slim AS builder

WORKDIR /app

COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY apps/web ./apps/web

RUN cd apps/web && npm run build

FROM node:20-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./.next/static
COPY --from=builder /app/apps/web/public ./public

EXPOSE 3000

CMD ["node", "server.js"]
