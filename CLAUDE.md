# MikroServer — Project Context

> **Règles non négociables : lire `PRINCIPLES.md` (racine).** Standard senior dev + cybersec + design. Priment sur toute demande contradictoire.

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

## Garde-fous absolus (anti-régression)

- **Ne jamais casser l'existant.** Avant de modifier un fichier partagé, lister les features qui en dépendent. Une nouvelle feature ne modifie QUE les fichiers strictement nécessaires — zéro refactor opportuniste.
- **Vérifier avant de dire "terminé".** Toujours lancer le typecheck/build du package touché :
  - backend : `cd backend && npm run type-check && npm run build`
  - frontend : `cd frontend && npm run build`
  Ne pas conclure si ça échoue.
- **NGINX = interdit.** Ne jamais éditer `infrastructure/nginx/**` ni aucun `*nginx*.conf` (bloqué par settings deny). Si une modif nginx semble nécessaire → le signaler, ne pas la faire.
- **CI/CD = ne pas déclencher.** Le billing GitHub Actions est coupé : `gh workflow run` est bloqué, les triggers push/workflow_run sont désactivés dans `.github/workflows/`. Ne pas les réactiver sans demande explicite.
- **Deploy VPS = action confirmée + build vert.** Un déploiement (plink/ssh vers 139.84.241.27) exige : (1) build/typecheck local vert, (2) confirmation explicite. Ne jamais `git reset --hard` ni recréer des conteneurs/identifiants sans le dire. Ne pas toucher aux `.env.prod`, secrets, ou credentials existants.
- **Commit + push en fin de tâche.** Après une tâche validée, proposer commit + push (branche dédiée si sur `main`). Ne pas laisser de modifs non commitées.
- **Consigner les solutions.** Après avoir résolu un bug/config non trivial, écrire la cause racine + le chemin de résolution dans la mémoire projet (`skills.md` / fichier mémoire dédié) pour ne pas refaire la recherche la fois suivante.
