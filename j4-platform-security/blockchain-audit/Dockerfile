FROM node:22.16.0-alpine3.21 AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN apk add --no-cache zlib>=1.3.2-r0
RUN npm ci

COPY tsconfig.json tsconfig.build.json ./
COPY src ./src

RUN npm run build
RUN mkdir -p dist/blockchain \
    && cp src/blockchain/IncidentAuditLog.json dist/blockchain/IncidentAuditLog.json


FROM node:22.16.0-alpine3.21 AS runtime

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN apk add --no-cache zlib>=1.3.2-r0
RUN npm ci --omit=dev && chown -R node:node /app/node_modules

COPY --from=builder --chown=node:node /app/dist ./dist

USER node

EXPOSE 8084

HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://127.0.0.1:8084/health || exit 1

CMD ["npm", "start"]
