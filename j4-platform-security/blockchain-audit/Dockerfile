# This image builds the TypeScript backend and runs the compiled API.
# To add it to the shared root docker-compose.yml, use the example
# service block in the final notes for this task.

FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json tsconfig.build.json ./
COPY src ./src

RUN npm run build

# The backend reads the ABI JSON from the filesystem at runtime,
# so copy it into the compiled dist folder as part of the image build.
RUN mkdir -p dist/blockchain && cp src/blockchain/IncidentAuditLog.json dist/blockchain/IncidentAuditLog.json

FROM node:22-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

EXPOSE 8084

CMD ["npm", "start"]
