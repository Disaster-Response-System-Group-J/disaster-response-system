FROM node:20.19.2-alpine3.21 AS deps

RUN apk upgrade --no-cache && apk add --no-cache openssl

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --frozen-lockfile


FROM node:20.19.2-alpine3.21 AS builder

RUN apk upgrade --no-cache && apk add --no-cache openssl

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_API_URL=http://localhost:3000
ARG NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SOCKET_URL=$NEXT_PUBLIC_SOCKET_URL

RUN npx prisma generate
RUN npm run build


FROM node:20.19.2-alpine3.21 AS runner

RUN apk upgrade --no-cache && apk add --no-cache openssl

WORKDIR /app

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0

# Create public/ (Next.js standalone expects it) and data/ for the SQLite volume mount.
# This project has no public/ assets, so no COPY from builder is needed.
RUN mkdir -p ./public ./data && chown -R node:node ./public ./data

COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

USER node

EXPOSE 3000

HEALTHCHECK --interval=20s --timeout=10s --start-period=40s --retries=3 \
    CMD wget -qO- http://127.0.0.1:3000/api/metrics > /dev/null || exit 1

CMD ["node", "server.js"]
