# =============================================================================
# Multi-stage Dockerfile — production-optimized
# Stage 1: deps — install all dependencies
# Stage 2: build — TypeScript compilation
# Stage 3: migrations — for the migrate-only container
# Stage 4: production — minimal runtime image
# =============================================================================

FROM node:25-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat
COPY package*.json ./

# ---- Dependencies ----
FROM base AS deps
RUN apk add --no-cache python3 make g++
RUN npm install --omit=dev --legacy-peer-deps && \
    cp -R node_modules /tmp/prod_modules
RUN npm install --legacy-peer-deps
COPY . .

# ---- Build ----
FROM deps AS build
RUN npm run prisma:generate
RUN npm run build

# ---- Migrations target ----
FROM base AS migrations
RUN npm install --legacy-peer-deps
COPY prisma ./prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma

# ---- Production ----
FROM node:25-alpine AS production
WORKDIR /app

# Security: non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001 -G nodejs

RUN apk add --no-cache openssl curl wireguard-tools util-linux

# Copy production node_modules
COPY --from=build /tmp/prod_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/prisma ./prisma
COPY package*.json ./

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:3000/api/v1/health/live || exit 1

CMD ["node", "dist/src/main.js"]
