FROM node:20-bookworm-slim

WORKDIR /app

COPY services/qmd/package.json ./services/qmd/package.json
COPY services/qmd/tsconfig.json ./services/qmd/tsconfig.json
RUN cd services/qmd && npm install

COPY services/qmd ./services/qmd
RUN cd services/qmd && npm run build

ENV NODE_ENV=production
ENV QMD_PORT=8181

EXPOSE 8181

CMD ["node", "services/qmd/dist/server.js"]
