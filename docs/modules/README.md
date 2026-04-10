# Modules Metier

Cette section documente les modules stables a traiter de maniere isolee pour limiter les regressions.

## Modules documentes

- `AUTH_PERMISSIONS.md`
  - Roles, permissions, profils et garde-fous d'acces.
- `FRONTEND_PROXY.md`
  - Proxy dashboard vers l'API, binding Next et healthchecks frontend.
- `AUDIT.md`
  - Journal d'audit, tracabilite des actions sensibles et filtres d'analyse.
- `USERS_RESELLERS.md`
  - Comptes revendeurs, profils d'acces, suspension et suppression reservee.
- `ROUTERS.md`
  - Inventaire routeurs, sync, health-check et operations de masse.
- `PAYMENTS_WEBHOOKS.md`
  - Provider de paiement, verification webhook et securite des callbacks.
- `SESSIONS.md`
  - Sessions actives, coupure et coordination avec les routeurs.
- `VOUCHERS.md`
  - Tickets, verification, suppression et PDF.
- `METRICS.md`
  - Rapports, supervision et centre d'incidents.
- `SUBSCRIPTIONS.md`
  - Cycle de vie abonnement et contrat Prisma du module subscriptions.

## Regles de travail

- Une tache ne doit toucher qu'un module principal a la fois, sauf si un contrat inter-module l'impose.
- Toute modification d'un module doit indiquer:
  - les entrees/sorties impactees
  - les tests a relancer
  - les dependances autorisees
- Les modules d'observabilite (`audit`, `metrics`, `incidents`) doivent documenter clairement:
  - ce qu'ils enregistrent
  - ce qu'ils affichent
  - ce qu'ils n'annulent pas
- Si une fonctionnalite a besoin de plusieurs modules, creer d'abord le contrat dans la doc avant de coder.
- Toute regression constatee en production doit etre rattachee a un module ici avant correctif.
