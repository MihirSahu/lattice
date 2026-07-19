FROM node:20-bookworm-slim

WORKDIR /app

# The npm launcher uses spawnSync, so killing it does not terminate its native
# OpenCode child. Point the SDK at the native binary so close() owns the server PID.
RUN npm install -g opencode-ai@1.14.26 \
  && test -x /usr/local/lib/node_modules/opencode-ai/bin/.opencode \
  && ln -sfn /usr/local/lib/node_modules/opencode-ai/bin/.opencode /usr/local/bin/opencode
RUN mkdir -p /app/opencode-data/opencode

COPY services/opencode-query/package.json ./services/opencode-query/package.json
COPY services/opencode-query/tsconfig.json ./services/opencode-query/tsconfig.json
RUN cd services/opencode-query && npm install

COPY services/opencode-query ./services/opencode-query
RUN cd services/opencode-query && npm run build

ENV NODE_ENV=production
ENV OPENCODE_QUERY_PORT=8282

EXPOSE 8282

CMD ["node", "services/opencode-query/dist/server.js"]
