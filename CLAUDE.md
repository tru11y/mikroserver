# MikroServer — Project Context

## Objectif

Plateforme de monétisation WiFi pour opérateur MikroTik en Côte d'Ivoire.
Paiement Wave (Mobile Money XOF), tunnel WireGuard vers routeurs MikroTik.

## Stack

Backend :
- NestJS + Fastify + TypeScript strict
- Prisma + PostgreSQL
- BullMQ + Redis (ioredis)
- Auth JWT HS256 + Argon2id + refresh token rotation

Frontend :
- Next.js 14 + Tailwind + Recharts + React Query
- Labels UI en français, dark mode par défaut

Infrastructure :
- Docker + Nginx + WireGuard
- RouterOS API sur 10.66.66.x (tunnel WireGuard uniquement)

Paiement :
- Wave CI — HMAC-SHA256 webhook verification
- Store-and-queue pattern : payload brut < 5ms, traitement async

## Structure

- `backend/` — NestJS app (modules : auth, users, plans, transactions, payments, vouchers, routers, sessions, metrics, queue, health, webhooks, audit, prisma)
- `frontend/` — Next.js dashboard
- `infrastructure/` — Docker, Nginx, WireGuard configs
- `backend/prisma/schema.prisma` — modèle de données complet
- `docs/ARCHITECTURE.md` — ADR complet

## Commandes

```bash
# Backend
cd backend && npm run dev
cd backend && npm run build
cd backend && npm run lint
cd backend && npm run test

# Frontend
cd frontend && npm run dev
cd frontend && npm run build

# Prisma
cd backend && npm run prisma:migrate
cd backend && npm run prisma:seed
```

## Règles backend

- Validation Zod à la frontière (body, env, webhooks)
- Guards globaux JWT + RolesGuard — opt-out @Public explicite
- Idempotency keys sur opérations financières
- Audit log append-only, jamais de throw dans le service d'audit
- Soft delete systématique, pas de cascade delete
- Circuit breaker par routeur (opossum) : 50% threshold, 30s reset
- Réponses API standard : `{ success, data, message, error }`

## Règles frontend

- Server Components par défaut, Client uniquement si nécessaire
- React Query pour data fetching — pas de useEffect pour fetcher
- États loading, empty, error obligatoires
- Accessible : aria-labels, contraste WCAG AA

## Sécurité

- HMAC timingSafeEqual pour webhooks Wave
- IP allowlist + replay window sur webhooks
- Rate limiting Throttler + Nginx
- Jamais de secret dans le code ou les logs
- CORS restreint en prod
- Headers Nginx : CSP, HSTS, X-Frame-Options

## Qualité obligatoire

Avant de finir une tâche :
1. Signaler les fichiers modifiés
2. Signaler les risques restants
3. Proposer amélioration suivante si pertinent
