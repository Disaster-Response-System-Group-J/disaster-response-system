FROM node:20.19.2-alpine3.21 AS deps

RUN apk upgrade --no-cache && apk add --no-cache openssl

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install


FROM node:20.19.2-alpine3.21 AS builder

RUN apk upgrade --no-cache && apk add --no-cache openssl

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_API_URL=http://localhost:3000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

ARG NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL

ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY

RUN npm run build


FROM node:20.19.2-alpine3.21 AS runner

RUN apk upgrade --no-cache && apk add --no-cache openssl py3-pip \
    && pip3 install --no-cache-dir --upgrade pip wheel "jaraco.context>=6.1.0"

WORKDIR /app

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0

# Create public/ (Next.js standalone expects it) and data/ for the SQLite volume mount.
# This project has no public/ assets, so no COPY from builder is needed.
RUN mkdir -p ./public ./data && chown -R node:node ./public ./data

COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

# http-proxy and its deps are not bundled by Next.js standalone — copy explicitly
COPY --from=builder --chown=node:node /app/node_modules/http-proxy       ./node_modules/http-proxy
COPY --from=builder --chown=node:node /app/node_modules/eventemitter3    ./node_modules/eventemitter3
COPY --from=builder --chown=node:node /app/node_modules/follow-redirects ./node_modules/follow-redirects
COPY --from=builder --chown=node:node /app/node_modules/requires-port    ./node_modules/requires-port

COPY --from=builder --chown=node:node /app/server-wrapper.js ./

USER node

EXPOSE 3000

HEALTHCHECK --interval=20s --timeout=10s --start-period=40s --retries=3 \
    CMD wget -qO- http://127.0.0.1:3000/api/metrics > /dev/null || exit 1

CMD ["node", "server-wrapper.js"]
