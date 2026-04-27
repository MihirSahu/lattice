FROM node:20-bookworm-slim

WORKDIR /app

RUN npm install -g opencode-ai@1.14.26

COPY services/opencode-query/package.json ./services/opencode-query/package.json
COPY services/opencode-query/tsconfig.json ./services/opencode-query/tsconfig.json
RUN cd services/opencode-query && npm install

COPY services/opencode-query ./services/opencode-query
RUN cd services/opencode-query && npm run build

ENV NODE_ENV=production
ENV OPENCODE_QUERY_PORT=8282

EXPOSE 8282

CMD ["node", "services/opencode-query/dist/server.js"]
