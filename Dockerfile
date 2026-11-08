# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS deps

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates python3 \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM node:22-bookworm-slim

WORKDIR /app
ENV NODE_ENV=production \
    STATE_DIR=/data

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates ffmpeg python3 \
    && rm -rf /var/lib/apt/lists/*

COPY --chown=node:node --from=deps /app/node_modules ./node_modules
COPY --chown=node:node . .

RUN mkdir -p /data && chown node:node /data

USER node
VOLUME ["/data"]

CMD ["node", "src/index.js"]
