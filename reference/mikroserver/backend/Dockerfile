# =============================================================================
# Multi-stage Dockerfile — production-optimized
# Stage 1: deps — install all dependencies
# Stage 2: build — TypeScript compilation
# Stage 3: migrations — for the migrate-only container
# Stage 4: production — minimal runtime image
# =============================================================================

FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat
COPY package*.json ./

# ---- Dependencies ----
FROM base AS deps
RUN npm ci --only=production && \
    cp -R node_modules /tmp/prod_modules
RUN npm ci
COPY . .

# ---- Build ----
FROM deps AS build
RUN npm run prisma:generate
RUN npm run build

# ---- Migrations target ----
FROM base AS migrations
RUN npm ci
COPY prisma ./prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma

# ---- Production ----
FROM node:20-alpine AS production
WORKDIR /app

# Security: non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001 -G nodejs

RUN apk add --no-cache openssl curl

# Copy production node_modules
COPY --from=build /tmp/prod_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/prisma ./prisma
COPY package*.json ./

# Set ownership
RUN chown -R nestjs:nodejs /app
USER nestjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:3000/api/v1/health/live || exit 1

CMD ["node", "dist/main"]
