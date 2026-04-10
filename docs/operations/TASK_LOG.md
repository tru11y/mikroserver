# Journal des Taches

## 2026-03-28 - Hotfix V23: deploy VPS plus robuste face a Redis et .env explicite

- statut: valide par inspection, pret a pousser
- zone: infrastructure docker + deploy production
- fichiers principaux:
  - `infrastructure/docker/docker-compose.prod.yml`
  - `infrastructure/docker/deploy.sh`
- verification:
  - healthcheck Redis assoupli: `timeout 5s`, `retries 10`, `start_period 30s`
  - `deploy.sh` passe maintenant explicitement `--env-file infrastructure/docker/.env`
  - `deploy.sh` demarre `postgres` et `redis` avant `api` et `dashboard`
- reserve:
  - ce lot ne repare pas un Redis corrompu ou un volume malade; il rend surtout le deploiement moins fragile aux demarrages lents et aux ambiguïtés d environnement
  - si `docker-redis-1` reste `unhealthy` apres ce lot, il faudra lire ses logs et traiter le conteneur ou son volume, pas re-builder le dashboard

## 2026-03-28 - Hotfix V22: build dashboard VPS restaure + timeouts routeur requalifies + spec auth repare

- statut: valide localement, pret a pousser
- zone: frontend build stability + backend routers + backend auth tests + docs
- fichiers principaux:
  - `frontend/src/app/offline/page.tsx`
  - `backend/src/modules/routers/router-runtime.utils.ts`
  - `backend/src/modules/auth/auth.service.spec.ts`
  - `docs/operations/FEATURE_VERIFICATION_LEDGER.md`
  - `docs/operations/TASK_LOG.md`
- verification:
  - backend tests complets OK: `26 suites`, `97 tests`
  - backend build OK
  - frontend lint OK: `zero warning/erreur`
  - frontend tests OK: `8 suites`, `33 tests`
  - frontend build Next.js OK
- reserve:
  - le build VPS cassait sur `main` a cause d un handler `onClick` dans `frontend/src/app/offline/page.tsx`; le lot le corrige en Client Component
  - `router-runtime.utils.ts` remappe maintenant les timeouts RouterOS en `GatewayTimeoutException` et remet les routeurs en `DEGRADED` avec metadata de sync, ce qui restaure le comportement attendu par les specs et par l UI
  - `auth.service.spec.ts` etait en retard sur `passwordService`, `tokenService` et `twoFactorService`; le spec est remis a jour sans changer le runtime
  - `router-api.service.ts` reste trop gros (`950 lignes`) et doit etre la prochaine cible serieuse de refactor
  - le deploiement VPS reste manuel depuis ici tant que l acces SSH interactif mot de passe n est pas automatisable


## 2026-03-25 - Frontend hardening V21: security headers Next + cockpit analytics decoupe

- statut: valide localement, pret a pousser
- zone: frontend security + frontend analytics + docs
- fichiers principaux:
  - `frontend/next.config.js`
  - `frontend/src/app/globals.css`
  - `frontend/src/app/(dashboard)/analytics/page.tsx`
  - `frontend/src/app/(dashboard)/analytics/use-analytics-data.ts`
  - `frontend/src/app/(dashboard)/analytics/analytics.types.ts`
  - `frontend/src/app/(dashboard)/analytics/analytics.utils.ts`
  - `frontend/src/app/(dashboard)/analytics/analytics.utils.spec.ts`
  - `frontend/src/app/(dashboard)/analytics/analytics-overview-section.tsx`
  - `frontend/src/app/(dashboard)/analytics/analytics-subscriptions-section.tsx`
  - `frontend/src/app/(dashboard)/analytics/analytics-recommendations-section.tsx`
  - `frontend/src/app/(dashboard)/analytics/analytics-ticket-report-section.tsx`
  - `frontend/src/app/(dashboard)/analytics/analytics-revenue-charts-section.tsx`
  - `frontend/src/app/(dashboard)/analytics/analytics-breakdown-table.tsx`
  - `docs/audit/FRONTEND_UI_UX_AUDIT_2026-03-25.md`
  - `docs/audit/MODULARITY_AUDIT_2026-03-24.md`
  - `docs/operations/FEATURE_VERIFICATION_LEDGER.md`
  - `docs/operations/TASK_LOG.md`
- verification:
  - frontend lint OK: `zero warning/erreur`
  - frontend tests OK: `6 suites`, `26 tests`
  - frontend build Next.js OK
- reserve:
  - `analytics/page.tsx` tombe a `77 lignes`, ce qui est un vrai saut senior
  - la securite frontend progresse avec des headers globaux, mais on reste sous un vrai modele `HttpOnly` tant que l auth n est pas revue end-to-end
  - l accessibilite progresse avec `focus-visible` et `prefers-reduced-motion`, mais elle n est pas encore mesuree par tests dedies
  - les nouveaux gros ecrans frontend visibles sont maintenant surtout `resellers/page.tsx` et `routers/page.tsx`
  - le design est plus lisible et plus guide, mais pas encore `9.8/10`

## 2026-03-25 - Senior hardening V20: vouchers helpers + metrics operations + formulaires IP binding

- statut: valide localement, pret a pousser
- zone: backend vouchers + backend metrics + frontend router detail + docs
- fichiers principaux:
  - `backend/src/modules/vouchers/voucher.service.ts`
  - `backend/src/modules/vouchers/voucher.service.helpers.ts`
  - `backend/src/modules/vouchers/voucher.service.helpers.spec.ts`
  - `backend/src/modules/metrics/metrics.service.ts`
  - `backend/src/modules/metrics/metrics.service.operations.ts`
  - `frontend/src/app/(dashboard)/routers/[id]/use-hotspot-ip-bindings-management.ts`
  - `frontend/src/app/(dashboard)/routers/[id]/hotspot-ip-binding.forms.ts`
  - `frontend/src/app/(dashboard)/routers/[id]/hotspot-ip-binding.forms.spec.ts`
  - `docs/audit/MODULARITY_AUDIT_2026-03-24.md`
  - `docs/modules/ROUTERS.md`
  - `docs/operations/FEATURE_VERIFICATION_LEDGER.md`
  - `docs/operations/TASK_LOG.md`
- verification:
  - backend tests complets OK: `26 suites`, `95 tests`
  - backend build OK
  - frontend lint OK: `zero warning/erreur`
  - frontend tests OK: `5 suites`, `22 tests`
  - frontend build Next.js OK
- reserve:
  - `voucher.service.ts` tombe a `990 lignes`, gros mieux, mais reste le plus gros monolithe backend
  - `metrics.service.ts` tombe a `814 lignes`, enfin nettement plus respirable, mais pas encore au niveau `9.5/10`
  - `router-api.service.ts` n est plus le principal goulet (`557 lignes`)
  - `use-hotspot-ip-bindings-management.ts` tombe a `248 lignes`, mais garde encore trop de responsabilites UI/metier
  - le registre de verification commence a devenir utile; il faut maintenant le respecter strictement a chaque lot

## 2026-03-25 - Senior hardening V19: split lifecycle routeur + extraction helpers metrics + modal IP binding plus robuste

- statut: valide localement, pret a pousser
- zone: backend routers + backend metrics + frontend router detail + docs
- fichiers principaux:
  - `backend/src/modules/routers/router-api.service.ts`
  - `backend/src/modules/routers/router-hotspot-delivery.operations.ts`
  - `backend/src/modules/routers/router-hotspot-writes.operations.ts`
  - `backend/src/modules/routers/router-health.operations.ts`
  - `backend/src/modules/routers/router-legacy-ticket.operations.ts`
  - `backend/src/modules/routers/router-hotspot-delivery.operations.spec.ts`
  - `backend/src/modules/routers/router-hotspot-writes.operations.spec.ts`
  - `backend/src/modules/routers/router-health.operations.spec.ts`
  - `backend/src/modules/metrics/metrics.service.ts`
  - `backend/src/modules/metrics/metrics.service.helpers.ts`
  - `frontend/src/app/(dashboard)/routers/[id]/hotspot-ip-binding-modal.tsx`
  - `docs/audit/MODULARITY_AUDIT_2026-03-24.md`
  - `docs/modules/ROUTERS.md`
  - `docs/operations/FEATURE_VERIFICATION_LEDGER.md`
  - `docs/operations/TASK_LOG.md`
- verification:
  - backend tests complets OK: `25 suites`, `88 tests`
  - backend build OK
  - frontend lint OK: `zero warning/erreur`
  - frontend tests OK: `4 suites`, `18 tests`
  - frontend build Next.js OK
- reserve:
  - `router-api.service.ts` tombe a `607 lignes`, vrai mieux, mais encore trop gros pour du `9.5/10`
  - `metrics.service.ts` tombe a `1193 lignes`, gros gain, mais devient un des monolithes principaux restants avec `voucher.service.ts`
  - `frontend/src/app/(dashboard)/routers/[id]/page.tsx` reste propre (`442 lignes`), mais l UX produit globale n est pas encore premium
  - `use-hotspot-ip-bindings-management.ts` reste la brique hotspot front la plus lourde
  - on a maintenant un registre fonctionnel plus utile; il faut continuer a le tenir strictement a jour a chaque lot critique

## 2026-03-24 - Runtime hardening V13: update IP binding fiable + changement de profil recentre sur les bons parcours

- statut: valide localement, pret a pousser
- zone: backend routers + frontend router detail + docs
- fichiers principaux:
  - `backend/src/modules/routers/router-api.service.ts`
  - `backend/src/modules/routers/router-hotspot-ip-bindings.utils.ts`
  - `backend/src/modules/routers/router-hotspot-ip-bindings.utils.spec.ts`
  - `frontend/src/app/(dashboard)/routers/[id]/connected-clients-section.tsx`
  - `frontend/src/app/(dashboard)/routers/[id]/hotspot-profile-change-modal.tsx`
  - `frontend/src/app/(dashboard)/routers/[id]/hotspot-users-section.tsx`
  - `frontend/src/app/(dashboard)/routers/[id]/page.tsx`
  - `docs/audit/MODULARITY_AUDIT_2026-03-24.md`
  - `docs/modules/ROUTERS.md`
  - `docs/operations/TASK_LOG.md`
- verification:
  - backend tests complets OK: `22 suites`, `80 tests`
  - backend build OK
  - frontend lint OK: `zero warning/erreur`
  - frontend tests OK: `3 suites`, `12 tests`
  - frontend build Next.js OK
- reserve:
  - score honnete encore sous `9/10`: la page routeur reste tres dense et `router-api.service.ts` reste au-dessus de `1000 lignes`
  - le bug `timeout of 15000ms exceeded` ne doit plus apparaitre si la prod est bien sur le dernier lot precedent; si c est encore le cas, il faut verifier le hash deploye et vider le cache navigateur
  - les `401` vus sur `auth/me`/`routers` ressemblent encore a du churn de refresh token; ce n etait pas la cause racine du bug IP binding traite ici

## 2026-03-24 - Runtime hardening V12: timeout/polling/proxy alignes sur la latence routeur reelle

- statut: valide localement, pret a pousser
- zone: frontend proxy + frontend router detail + docs
- fichiers principaux:
  - `frontend/src/app/proxy/[...path]/route.ts`
  - `frontend/src/lib/api/client.ts`
  - `frontend/src/lib/api/routers.ts`
  - `frontend/src/app/(dashboard)/routers/[id]/page.tsx`
  - `frontend/src/app/layout.tsx`
  - `frontend/src/app/favicon.ico/route.ts`
  - `docs/audit/MODULARITY_AUDIT_2026-03-24.md`
  - `docs/modules/ROUTERS.md`
  - `docs/operations/TASK_LOG.md`
- verification:
  - logs VPS analyses sur `7d1cacb`:
    - `live-stats`: `~1.8s` a `4.5s`
    - `hotspot/ip-bindings`: `~3.8s`
    - `hotspot/users`: `11.7s` puis `23.5s`
    - API backend vivante (`/health/live` OK), probleme principal = lenteur routeur + mismatch timeout dashboard
  - frontend lint OK
  - frontend tests OK: `3 suites`, `12 tests`
  - frontend build Next.js OK
- reserve:
  - le proxy est plus resilient, mais si un routeur depasse encore `45s` cote client ou `60s` cote proxy, l utilisateur verra toujours une erreur explicite
  - `router-api.service.ts` et `routers/[id]/page.tsx` restent encore trop gros pour viser `9/10`
  - le `favicon.ico` doit etre reverifie sur VPS apres deploiement de ce lot
  - aucune preuve ici d un crash API generalise; la faiblesse remontee par les logs est surtout la latence terrain des lectures hotspot

## 2026-03-24 - Runtime hardening V11: lectures hotspot sequentielles + front moins agressif en erreur

- statut: valide localement, pret a pousser
- zone: backend routers + frontend router detail + docs
- fichiers principaux:
  - `backend/src/modules/routers/router-api.service.ts`
  - `backend/src/modules/routers/router-hotspot-readers.utils.ts`
  - `backend/src/modules/routers/router-hotspot-readers.utils.spec.ts`
  - `backend/src/modules/routers/router-legacy-ticket.utils.ts`
  - `frontend/src/app/(dashboard)/routers/[id]/page.tsx`
  - `frontend/src/app/(dashboard)/routers/[id]/connected-clients-section.tsx`
  - `frontend/src/app/icon.svg`
  - `docs/audit/MODULARITY_AUDIT_2026-03-24.md`
  - `docs/modules/ROUTERS.md`
  - `docs/operations/TASK_LOG.md`
- verification:
  - backend tests complets OK: `22 suites`, `80 tests`
  - backend build OK
  - frontend lint OK: `zero warning/erreur`
  - frontend tests OK: `3 suites`, `12 tests`
  - frontend build Next.js OK
- reserve:
  - l hypothese technique principale reste une fragilite RouterOS sur lectures paralleles; elle est corrigee dans le code mais doit etre reverifiee sur VPS
  - `router-api.service.ts` descend a `999 lignes`, mieux mais toujours trop gros pour un vrai `9/10`
  - `routers/[id]/page.tsx` descend a `1172 lignes`, mieux mais encore trop dense
  - si les `500` persistent apres deploiement, les logs API du VPS seront indispensables
  - VPS non deploye depuis cet environnement (SSH batch refuse)

## 2026-03-24 - Modularity uplift V10: extraction transport RouterOS + lookup legacy hors RouterApiService

- statut: valide localement, pret a pousser
- zone: backend routers + tests + docs
- fichiers principaux:
  - `backend/src/modules/routers/router-api.service.ts`
  - `backend/src/modules/routers/router-legacy-ticket.utils.ts`
  - `backend/src/modules/routers/router-legacy-ticket.utils.spec.ts`
  - `backend/src/modules/routers/router-routeros.transport.ts`
  - `backend/src/modules/routers/router-routeros.transport.spec.ts`
  - `docs/audit/MODULARITY_AUDIT_2026-03-24.md`
  - `docs/modules/ROUTERS.md`
  - `docs/operations/TASK_LOG.md`
- verification:
  - backend tests complets OK: `21 suites`, `78 tests`
  - backend build OK
  - frontend lint OK: `zero warning/erreur`
  - frontend tests OK: `3 suites`, `12 tests`
  - frontend build Next.js OK
- reserve:
  - `router-api.service.ts` descend a `1128 lignes`, ce qui reste trop gros pour un vrai `9/10`
  - `routers/[id]/page.tsx` reste a `1228 lignes`
  - la prochaine vraie extraction doit viser le circuit-breaker/push hotspot user et le reste du lifecycle routeur
  - VPS non deploye depuis cet environnement (SSH batch refuse)

## 2026-03-24 - Modularity uplift V9: extraction live/sync hotspot du backend routeur

- statut: valide localement, pret a pousser
- zone: backend routers + tests + docs
- fichiers principaux:
  - `backend/src/modules/routers/router-api.service.ts`
  - `backend/src/modules/routers/router-hotspot-live.utils.ts`
  - `backend/src/modules/routers/router-hotspot-live.utils.spec.ts`
  - `backend/src/modules/routers/router-hotspot-sync.utils.ts`
  - `backend/src/modules/routers/router-hotspot-sync.utils.spec.ts`
  - `docs/audit/MODULARITY_AUDIT_2026-03-24.md`
  - `docs/modules/ROUTERS.md`
  - `docs/operations/TASK_LOG.md`
- verification:
  - backend tests complets OK: `19 suites`, `74 tests`
  - backend build OK
  - frontend lint OK: `zero warning/erreur`
  - frontend tests OK: `3 suites`, `12 tests`
  - frontend build Next.js OK
- reserve:
  - `router-api.service.ts` descend a `1209 lignes`, ce qui est mieux mais encore trop gros pour un vrai `9/10`
  - `routers/[id]/page.tsx` reste a `1228 lignes`
  - la prochaine vraie extraction backend doit viser `findLegacyTicket` et le transport/connexion RouterOS
  - VPS non deploye depuis cet environnement (SSH batch refuse)

## 2026-03-24 - Modularity uplift V8: extraction clients connectes + modales hotspot du detail routeur

- statut: valide localement, pret a pousser
- zone: frontend router detail + docs
- fichiers principaux:
  - `frontend/src/app/(dashboard)/routers/[id]/page.tsx`
  - `frontend/src/app/(dashboard)/routers/[id]/connected-clients-section.tsx`
  - `frontend/src/app/(dashboard)/routers/[id]/hotspot-profile-change-modal.tsx`
  - `frontend/src/app/(dashboard)/routers/[id]/hotspot-profile-config-modal.tsx`
  - `frontend/src/app/(dashboard)/routers/[id]/hotspot-ip-binding-modal.tsx`
  - `docs/audit/MODULARITY_AUDIT_2026-03-24.md`
  - `docs/modules/ROUTERS.md`
  - `docs/operations/TASK_LOG.md`
- verification:
  - frontend lint OK: `zero warning/erreur`
  - frontend tests OK: `3 suites`, `12 tests`
  - frontend build Next.js OK
  - backend tests complets OK: `17 suites`, `72 tests`
  - backend build OK
- reserve:
  - `routers/[id]/page.tsx` descend a `1228 lignes`, ce qui est mieux mais encore trop gros pour un vrai `9/10`
  - l ergonomie produit reste encore trop dense sur la page routeur: la modularite interne avance plus vite que l UX
  - les problemes terrain `profils Winbox invisibles` et `actions IP bindings defaillantes` devront etre reverifies sur environnement reel apres deploiement
  - VPS non deploye depuis cet environnement (SSH batch refuse)

## 2026-03-24 - Hotfix routeur V7: sync utile, anciennete client visible, edition IP binding elargie + audit cybersécurité

- statut: valide localement, pret a pousser
- zone: backend routers + frontend router detail + audit securite + docs
- fichiers principaux:
  - `backend/src/modules/routers/dto/router.dto.ts`
  - `backend/src/modules/routers/router-api.service.ts`
  - `backend/src/modules/routers/router-hotspot-ip-bindings.utils.ts`
  - `backend/src/modules/routers/router-hotspot-ip-bindings.utils.spec.ts`
  - `backend/src/modules/routers/routers.service.ts`
  - `frontend/src/lib/api/routers.ts`
  - `frontend/src/app/(dashboard)/routers/[id]/page.tsx`
  - `frontend/src/app/(dashboard)/routers/[id]/router-detail.selectors.ts`
  - `frontend/src/app/(dashboard)/routers/[id]/router-detail.selectors.spec.ts`
  - `docs/audit/CYBERSECURITY_AUDIT_2026-03-24.md`
  - `docs/audit/MODULARITY_AUDIT_2026-03-24.md`
  - `docs/README.md`
  - `docs/operations/TASK_LOG.md`
- verification:
  - backend build OK
  - backend tests complets OK: `17 suites`, `72 tests`
  - frontend lint OK: `zero warning/erreur`
  - frontend tests OK: `3 suites`, `12 tests`
  - frontend build Next.js OK
- reserve:
  - `ip bindings` est mieux editable, mais un vrai composant dedie de modal reste necessaire
  - `page.tsx` detail routeur reste encore beaucoup trop grosse (`1688 lignes`)
  - si `1ere connexion` reste vide en prod sur un client actif, le probleme n est plus l UI mais l absence de mapping vers un voucher SaaS connu
  - les failles structurelles de securite P0/P1 documentees ne sont pas encore corrigees
  - VPS non deploye depuis cet environnement (SSH batch refuse)

## 2026-03-24 - Modularity uplift V6: extraction section profils/tarifs du detail routeur

- statut: valide localement, pret a pousser
- zone: frontend router detail + docs
- fichiers principaux:
  - `frontend/src/app/(dashboard)/routers/[id]/page.tsx`
  - `frontend/src/app/(dashboard)/routers/[id]/hotspot-profiles-section.tsx`
  - `docs/audit/MODULARITY_AUDIT_2026-03-24.md`
  - `docs/modules/ROUTERS.md`
  - `docs/operations/TASK_LOG.md`
- verification:
  - frontend lint OK: `zero warning/erreur`
  - frontend tests OK: `3 suites`, `11 tests`
  - frontend build Next.js OK
- reserve:
  - `routers/[id]/page.tsx` reste encore gros (`1603 lignes`)
  - les modales hotspot et le tableau clients connectes restent dans le composant parent
  - aucun backend touche sur ce lot
  - VPS non deploye depuis cet environnement (SSH batch refuse)

## 2026-03-24 - Modularity uplift V5: sections frontend routeur + utils hotspot profiles/ip-bindings backend

- statut: valide localement, pret a pousser
- zone: backend routers + frontend router detail + tests + docs
- fichiers principaux:
  - `backend/src/modules/routers/router-api.service.ts`
  - `backend/src/modules/routers/router-hotspot-profiles.utils.ts`
  - `backend/src/modules/routers/router-hotspot-profiles.utils.spec.ts`
  - `backend/src/modules/routers/router-hotspot-ip-bindings.utils.ts`
  - `backend/src/modules/routers/router-hotspot-ip-bindings.utils.spec.ts`
  - `frontend/src/app/(dashboard)/routers/[id]/page.tsx`
  - `frontend/src/app/(dashboard)/routers/[id]/hotspot-ip-bindings-section.tsx`
  - `frontend/src/app/(dashboard)/routers/[id]/hotspot-users-section.tsx`
  - `docs/audit/MODULARITY_AUDIT_2026-03-24.md`
  - `docs/modules/ROUTERS.md`
  - `docs/operations/TASK_LOG.md`
- verification:
  - backend build OK
  - backend tests complets OK: `17 suites`, `72 tests`
  - frontend lint OK: `zero warning/erreur`
  - frontend tests OK: `3 suites`, `11 tests`
  - frontend build Next.js OK
- reserve:
  - `router-api.service.ts` reste encore gros (`1434 lignes`)
  - `routers/[id]/page.tsx` reste encore gros (`1763 lignes`)
  - lint backend workspace reste non fiable dans cet environnement
  - VPS non deploye depuis cet environnement (SSH batch refuse)

## 2026-03-24 - Modularity uplift V4: extraction logique hotspot users backend + composant compliance frontend

- statut: valide localement, pret a pousser
- zone: backend routers + frontend router detail + tests + docs
- fichiers principaux:
  - `backend/src/modules/routers/router-api.service.ts`
  - `backend/src/modules/routers/router-hotspot-users.utils.ts`
  - `backend/src/modules/routers/router-hotspot-users.utils.spec.ts`
  - `frontend/src/app/(dashboard)/routers/[id]/page.tsx`
  - `frontend/src/app/(dashboard)/routers/[id]/hotspot-compliance-banner.tsx`
  - `docs/audit/MODULARITY_AUDIT_2026-03-24.md`
  - `docs/modules/ROUTERS.md`
  - `docs/operations/TASK_LOG.md`
- verification:
  - backend build OK
  - backend tests complets OK: `15 suites`, `67 tests`
  - frontend lint OK: `zero warning/erreur`
  - frontend tests OK: `3 suites`, `11 tests`
  - frontend build Next.js OK
- reserve:
  - `router-api.service.ts` et `routers/[id]/page.tsx` restent encore trop gros pour atteindre `9/10`
  - lint backend workspace reste non fiable dans cet environnement
  - VPS non deploye depuis cet environnement (SSH batch refuse)

## 2026-03-24 - Modularity uplift V3: extraction commandes RouterOS + selectors detail routeur

- statut: valide localement, pret a pousser
- zone: backend routers + frontend dashboard routers + tests + docs
- fichiers principaux:
  - `backend/src/modules/routers/router-api.service.ts`
  - `backend/src/modules/routers/router-api.commands.ts`
  - `frontend/src/app/(dashboard)/routers/[id]/page.tsx`
  - `frontend/src/app/(dashboard)/routers/[id]/router-detail.selectors.ts`
  - `frontend/src/app/(dashboard)/routers/[id]/router-detail.selectors.spec.ts`
  - `docs/audit/MODULARITY_AUDIT_2026-03-24.md`
  - `docs/operations/TASK_LOG.md`
- verification:
  - backend build OK
  - backend tests complets OK: `14 suites`, `64 tests`
  - frontend lint OK: `zero warning/erreur`
  - frontend tests OK: `3 suites`, `11 tests`
  - frontend build Next.js OK
- reserve:
  - `router-api.service.ts` et `routers/[id]/page.tsx` restent encore trop volumineux pour viser `9/10`
  - lint backend non fiable dans cet environnement (`eslint` ne trouve pas de config via le script workspace actuel)
  - VPS non deploye depuis cet environnement (SSH batch refuse)

## 2026-03-24 - Modularity uplift V2: decoupage router-api (types/utils) + zero warning lint frontend

- statut: valide localement, pret a pousser
- zone: backend routers + frontend dashboard + qualite
- fichiers principaux:
  - `backend/src/modules/routers/router-api.service.ts`
  - `backend/src/modules/routers/router-api.types.ts`
  - `backend/src/modules/routers/router-api.utils.ts`
  - `frontend/src/app/(dashboard)/hotspot/page.tsx`
  - `frontend/src/app/(dashboard)/incidents/page.tsx`
  - `frontend/src/app/(dashboard)/routers/page.tsx`
  - `frontend/src/app/(dashboard)/routers/[id]/page.tsx`
  - `frontend/src/app/(dashboard)/settings/page.tsx`
  - `frontend/src/app/(dashboard)/vouchers/generate/page.tsx`
  - `frontend/src/components/dashboard/router-alert-monitor.tsx`
  - `docs/audit/MODULARITY_AUDIT_2026-03-24.md`
- verification:
  - backend tests complets OK: `14 suites`, `64 tests`
  - backend build OK
  - frontend tests OK: `2 suites`, `7 tests`
  - frontend type-check OK
  - frontend lint OK: `zero warning/erreur`
  - frontend build Next.js OK
- reserve:
  - `router-api.service.ts` et `routers/[id]/page.tsx` restent encore trop gros pour un score 9/10
  - couverture tests frontend encore insuffisante pour les parcours critiques (IP bindings, profil user, auth reset UI)
  - VPS non deploye depuis cet environnement (SSH batch refuse)

## 2026-03-24 - Modularity uplift V1: API frontend modulaire + lint industrialise + tests frontend initiaux

- statut: valide localement, pret a pousser
- zone: frontend architecture + backend permissions + documentation
- fichiers principaux:
  - `frontend/src/lib/api.ts`
  - `frontend/src/lib/api/client.ts`
  - `frontend/src/lib/api/index.ts`
  - `frontend/src/lib/api/*.ts` (modules domaines)
  - `frontend/src/lib/api/query.spec.ts`
  - `frontend/src/app/(dashboard)/routers/[id]/router-detail.types.ts`
  - `frontend/src/app/(dashboard)/routers/[id]/router-detail.utils.ts`
  - `frontend/src/app/(dashboard)/routers/[id]/router-detail.utils.spec.ts`
  - `frontend/src/app/(dashboard)/routers/[id]/page.tsx`
  - `frontend/.eslintrc.json`
  - `frontend/jest.config.js`
  - `frontend/tsconfig.jest.json`
  - `frontend/tsconfig.json`
  - `backend/src/modules/auth/permissions/permissions.constants.ts`
  - `backend/src/modules/auth/permissions/permissions.constants.spec.ts`
  - `docs/audit/MODULARITY_AUDIT_2026-03-24.md`
- verification:
  - backend tests complets OK: `14 suites`, `64 tests`
  - backend build OK
  - frontend tests OK: `2 suites`, `7 tests`
  - frontend lint OK (non-interactif, warnings hooks restants)
  - frontend type-check OK
  - frontend build Next.js OK
- reserve:
  - `router-api.service.ts` et `routers/[id]/page.tsx` restent trop volumineux pour viser 9/10
  - warnings `react-hooks/exhaustive-deps` a traiter dans une passe dediee
  - VPS non deploye depuis cet environnement (SSH batch refuse)

## 2026-03-24 - Revalidation audit modulaire + sync GitHub

- statut: valide localement, pousse GitHub
- zone: qualite globale + documentation
- fichiers principaux:
  - `docs/audit/MODULARITY_AUDIT_2026-03-24.md`
  - `docs/operations/TASK_LOG.md`
- verification:
  - backend tests complets OK: `14 suites`, `63 tests`
  - backend build OK
  - frontend type-check OK
  - frontend build Next.js OK
  - lint frontend non industrialise: `next lint` ouvre encore l'assistant interactif
  - git status propre apres commit
  - push GitHub `main` OK
- reserve:
  - aucun test unitaire frontend present
  - deploiement VPS non execute depuis cet environnement (SSH batch refuse)

## 2026-03-24 - Audit modulaire dur + auth reset email/OTP + verifications globales

- statut: valide localement
- zone: backend auth + backend routers + frontend auth/dashboard + documentation
- fichiers principaux:
  - `backend/prisma/schema.prisma`
  - `backend/prisma/migrations/20260324093000_add_password_reset_tokens/migration.sql`
  - `backend/src/modules/auth/auth.controller.ts`
  - `backend/src/modules/auth/auth.service.ts`
  - `backend/src/modules/auth/dto/login.dto.ts`
  - `backend/src/modules/auth/auth.service.spec.ts`
  - `backend/src/modules/routers/router-api.service.spec.ts`
  - `frontend/src/app/(auth)/login/page.tsx`
  - `frontend/src/app/(auth)/forgot-password/page.tsx`
  - `frontend/src/app/(auth)/reset-password/page.tsx`
  - `frontend/src/app/(dashboard)/settings/page.tsx`
  - `frontend/src/app/(dashboard)/hotspot/page.tsx`
  - `frontend/src/app/(dashboard)/routers/[id]/page.tsx`
  - `frontend/src/lib/api.ts`
  - `docs/audit/MODULARITY_AUDIT_2026-03-24.md`
  - `docs/modules/AUTH_PERMISSIONS.md`
  - `docs/modules/ROUTERS.md`
  - `docs/README.md`
  - `docs/operations/TASK_LOG.md`
- verification:
  - backend tests complets OK: `14 suites`, `63 tests`
  - backend build OK
  - frontend type-check OK
  - frontend build Next.js OK
  - lint frontend non valide: `next lint` ouvre encore le setup interactif (pas de gate lint operationnel)
- reserve:
  - modularite encore insuffisante sur fichiers critiques (`router-api.service.ts`, `routers/[id]/page.tsx`)
  - frontend sans tests unitaires
  - 2FA de login non implemente (seul reset email+OTP est livre)

## 2026-03-23 - V4.5 lot routeur: profils/tarifs existants + IP bindings + edition profil utilisateur

- statut: valide localement
- zone: backend routers + frontend router detail
- fichiers principaux:
  - `backend/src/modules/routers/router-api.service.ts`
  - `backend/src/modules/routers/routers.service.ts`
  - `backend/src/modules/routers/routers.controller.ts`
  - `backend/src/modules/routers/dto/router.dto.ts`
  - `backend/src/modules/auth/permissions/controller-permissions.spec.ts`
  - `frontend/src/lib/api.ts`
  - `frontend/src/app/(dashboard)/routers/[id]/page.tsx`
- verification:
  - nouveaux endpoints API routeur:
    - `GET /api/v1/routers/:id/hotspot/user-profiles`
    - `GET /api/v1/routers/:id/hotspot/ip-bindings`
    - `GET /api/v1/routers/:id/hotspot/users`
    - `PATCH /api/v1/routers/:id/hotspot/users/profile`
  - UI routeur:
    - affichage des profils hotspot existants (source MikroTik/Winbox)
    - affichage des forfaits/tarifs existants (source SaaS)
    - affichage IP bindings
    - listing utilisateurs hotspot (actifs et inactifs)
    - changement de profil utilisateur avec option de coupure des sessions actives
  - backend build OK
  - frontend type-check OK
  - frontend build Next.js OK
  - test permissions controller OK
- reserve:
  - redeploiement VPS requis pour activer ces endpoints/UI en production

## 2026-03-23 - V4.5 lot users: gestion profils utilisateurs complete (liste + edition)

- statut: valide localement
- zone: frontend dashboard users + navigation
- fichiers principaux:
  - `frontend/src/app/(dashboard)/resellers/page.tsx`
  - `frontend/src/components/dashboard/sidebar.tsx`
- verification:
  - bascule de la source API `users/resellers` vers `users` pour afficher tous les comptes
  - ajout filtres role/statut pour retrouver rapidement un utilisateur existant
  - creation de compte avec selection de role (ADMIN pour super admin, RESELLER, VIEWER)
  - edition profil/acces/mot de passe disponible sur tous les comptes gerables (hors super admin)
  - libelle sidebar harmonise: `Utilisateurs`
  - frontend type-check OK
  - frontend build Next.js OK
- reserve:
  - redeploiement VPS requis pour activer cette UX en production

## 2026-03-23 - V4.5 lot analytics abonnements: today + recurring leaders

- statut: valide localement
- zone: backend metrics + frontend analytics
- fichiers principaux:
  - `backend/src/modules/metrics/metrics.controller.ts`
  - `backend/src/modules/metrics/metrics.service.ts`
  - `backend/src/modules/metrics/metrics.service.spec.ts`
  - `backend/src/modules/auth/permissions/controller-permissions.spec.ts`
  - `frontend/src/lib/api.ts`
  - `frontend/src/app/(dashboard)/analytics/page.tsx`
- verification:
  - nouveaux endpoints reports:
    - `GET /api/v1/metrics/subscriptions/today`
    - `GET /api/v1/metrics/subscriptions/expiring-today`
    - `GET /api/v1/metrics/subscriptions/top-clients`
    - `GET /api/v1/metrics/subscriptions/top-plans`
  - integration dashboard `/analytics`:
    - abonnements pris aujourd'hui
    - forfaits expirant aujourd'hui
    - top clients recurrents (30 jours)
    - top forfaits recurrents (30 jours)
  - tests backend OK:
    - `metrics.service.spec.ts` (runInBand)
    - `controller-permissions.spec.ts` (runInBand)
  - backend build OK
  - frontend type-check OK
- reserve:
  - redeploiement VPS requis pour activer ces endpoints et la nouvelle section analytics

## 2026-03-23 - Hardening release VPS: verrou d'execution + projet Compose stable

- statut: valide localement
- zone: infrastructure release script
- fichiers principaux:
  - `infrastructure/scripts/vps_release.sh`
  - `docs/operations/TASK_LOG.md`
- verification:
  - ajout d'un verrou `flock` pour bloquer les executions paralleles de `vps_release.sh`
  - ajout d'un projet Compose explicite et stable (`COMPOSE_PROJECT_NAME` ou `docker` par defaut)
  - unification des commandes compose via helper `compose()`
- reserve:
  - verification runtime a confirmer sur VPS au prochain run
  - validation syntaxe `bash -n` non lancee localement (bash indisponible sur cet environnement)

## 2026-03-23 - V4.5 preparation business + correctif users profiles (permissions/UX)

- statut: valide localement
- zone: backend auth permissions + frontend users/resellers + roadmap
- fichiers principaux:
  - `backend/src/modules/auth/permissions/permissions.constants.ts`
  - `backend/src/modules/auth/permissions/permissions.constants.spec.ts`
  - `frontend/src/app/(dashboard)/resellers/page.tsx`
  - `docs/roadmap/V4_5_BEST_SOLUTIONS_BLUEPRINT.md`
  - `docs/README.md`
  - `docs/operations/TASK_LOG.md`
- verification:
  - ajout d'une hierarchie permissions (ex: `users.manage` implique `users.view`)
  - suppression des blocages de consultation pour les profils custom "manage-only"
  - UI users/resellers: messages d'erreur explicites en cas d'echec API/droits
  - backend tests OK:
    - `permissions.constants.spec.ts` (runInBand)
    - `users.service.spec.ts` (runInBand)
  - backend build OK
  - frontend type-check OK
- reserve:
  - redeploiement VPS requis pour appliquer le correctif runtime
  - lot IA V4.5 documente, implementation non demarree dans ce commit

## 2026-03-23 - Preparation V4.5: cadrage roadmap et lots d'execution

- statut: valide localement
- zone: documentation produit + operations
- fichiers principaux:
  - `docs/roadmap/V4_5_EXECUTION_PLAN.md`
  - `docs/README.md`
  - `docs/operations/TASK_LOG.md`
- verification:
  - creation d'un plan V4.5 concret (incidents V2, reporting V2, bulk ops, hardening release)
  - definition explicite des lots et criteres de done
  - index docs mis a jour pour referencer le plan V4.5
- reserve:
  - aucun changement runtime sur ce lot
  - implementation V4.5 non commencee dans ce commit

## 2026-03-23 - V3 Lot A (phase 1): garde-fous permissions backend + UI dashboard

- statut: valide localement
- zone: backend auth/permissions + frontend dashboard
- fichiers principaux:
  - `backend/src/modules/auth/permissions/controller-permissions.spec.ts`
  - `frontend/src/app/(dashboard)/plans/page.tsx`
  - `frontend/src/app/(dashboard)/routers/page.tsx`
  - `frontend/src/app/(dashboard)/routers/[id]/page.tsx`
  - `frontend/src/app/(dashboard)/vouchers/page.tsx`
  - `frontend/src/app/(dashboard)/vouchers/generate/page.tsx`
  - `frontend/src/app/(dashboard)/vouchers/stock/page.tsx`
  - `frontend/src/app/(dashboard)/analytics/page.tsx`
  - `frontend/src/app/(dashboard)/incidents/page.tsx`
- verification:
  - backend build OK (`npm run build`)
  - frontend type-check OK (`npm run type-check`)
  - tests permissions backend OK (`controller-permissions.spec.ts` + `permissions.constants.spec.ts`)
  - ajout de gardes UI par permission pour les modules cibles V3:
    - plans
    - routers
    - tickets
    - metrics/rapports
  - reduction des appels API inutiles en absence de permission (queries `enabled`)
- reserve:
  - aucun changement runtime prod sur ce lot
  - redeploiement VPS requis pour appliquer ces protections UI en production

## 2026-03-23 - Kickoff V3: plan d'execution et cadrage des lots

- statut: valide localement
- zone: documentation produit + operations
- fichiers principaux:
  - `docs/roadmap/V3_EXECUTION_PLAN.md`
  - `docs/README.md`
  - `docs/operations/TASK_LOG.md`
- verification:
  - ajout d'un plan V3 executable (priorites, lots initiaux, criteres de done)
  - recommandation de demarrage sur le lot permissions metier end-to-end
  - index documentation mis a jour pour referencer le nouveau plan V3
- reserve:
  - aucun changement runtime SaaS sur ce lot
  - implementation technique V3 non demarree a ce stade

## 2026-03-23 - Hotfix compatibilite Docker Compose: migration sans flag `--no-build`

- statut: valide localement
- zone: infrastructure + documentation
- fichiers principaux:
  - `infrastructure/scripts/vps_release.sh`
- verification:
  - suppression du flag `--no-build` sur `docker compose run` (incompatible sur certains environnements VPS)
  - le script peut maintenant aller au bout (migrations puis restart sequentiel des services)
- reserve:
  - rerun VPS requis pour appliquer les nouveaux conteneurs et sortir de l'ancienne image API

## 2026-03-23 - Correctif critique API boot: configuration CinetPay + gestion espace disque release

- statut: valide localement
- zone: backend config + infrastructure + documentation
- fichiers principaux:
  - `backend/src/config/configuration.ts`
  - `backend/src/config/app.config.ts`
  - `backend/src/app.module.ts`
  - `infrastructure/scripts/vps_release.sh`
  - `docs/operations/SITE_MAINTENANCE.md`
- verification:
  - `backend npm run build` OK
  - ajout du namespace config `cinetpay.*` (stop crash `Configuration key "cinetpay.apiUrl" does not exist`)
  - script de release:
    - cleanup Docker non destructif automatique si disque insuffisant
    - build avec cache par defaut (moins de pression disque)
    - option `FULL_REBUILD=true` pour no-cache explicit
    - migration `db-migrate` en `--no-build` apres image deja construite
- reserve:
  - reexecution du script sur VPS requise pour validation runtime
  - incident historique Nginx sur cert manquant deja couvert par fallback cert

## 2026-03-23 - Hotfix release VPS: sequence de demarrage et diagnostic auto

- statut: valide localement
- zone: infrastructure + documentation
- fichiers principaux:
  - `infrastructure/scripts/vps_release.sh`
  - `docs/operations/SITE_MAINTENANCE.md`
- verification:
  - release script passe en demarrage sequentiel:
    - `api` puis verification health
    - `dashboard` puis verification `/login`
    - `nginx` seulement apres succes des deux
  - en cas d'echec API/dashboard, les logs du service sont imprimes automatiquement
  - cert fallback TLS toujours gere et valide (fichiers non vides)
- reserve:
  - reexecution du script sur VPS requise pour valider runtime
  - incident API actuel a confirmer via logs auto-emis par le script au prochain run

## 2026-03-22 - Hotfix release VPS: build dashboard + resilence TLS Nginx

- statut: valide localement
- zone: infrastructure + frontend + documentation
- fichiers principaux:
  - `frontend/Dockerfile`
  - `infrastructure/scripts/vps_release.sh`
  - `docs/operations/SITE_MAINTENANCE.md`
- verification:
  - `frontend/Dockerfile` force la creation de `/app/public` avant build (evite l'echec `COPY --from=build /app/public ./public`)
  - script release VPS:
    - genere automatiquement un certificat auto-signe si SSL absent
    - evite le crash-loop Nginx sur `fullchain.pem` manquant
  - maintenance doc mise a jour
- reserve:
  - reexecution du script de release necessaire sur VPS pour appliquer le hotfix runtime
  - certificat auto-signe = mesure de continuité, a remplacer par certificat Let's Encrypt ensuite

## 2026-03-22 - Stabilisation deploiement VPS: script canonique de release

- statut: valide localement
- zone: infrastructure + documentation
- fichiers principaux:
  - `infrastructure/scripts/vps_release.sh`
  - `docs/operations/SITE_MAINTENANCE.md`
- verification:
  - script ajoute avec controles:
    - alignement Git (`main`) ou reclonage propre si `/root/mikroserver` n'est pas un repo
    - verification fichiers critiques (dont `mock.provider.ts`)
    - build `api` + `dashboard`
    - migrations conditionnelles (`db-migrate`)
    - healthchecks API + dashboard
    - verification des routes `users/:id/profile` et `users/:id/password` dans les logs de demarrage
    - smoke test login admin optionnel via variables d'environnement
- reserve:
  - execution du script a faire depuis le shell VPS (SSH interactif requis)
  - aucune modification directe des routeurs MikroTik sur ce lot

## 2026-03-22 - Correctif build global backend: module subscriptions

- statut: valide localement
- zone: backend + documentation
- fichiers principaux:
  - `backend/src/modules/subscriptions/dto/subscription.dto.ts`
  - `backend/src/modules/subscriptions/subscriptions.service.ts`
  - `docs/modules/SUBSCRIPTIONS.md`
  - `docs/modules/README.md`
  - `docs/README.md`
- verification:
  - backend build global OK (`npm run build`)
  - frontend build OK
  - frontend type-check OK
  - commit Git: `2197919`
  - push GitHub OK (`main`)
- reserve:
  - upload SCP VPS non automatise ici (auth SSH interactive requise)
  - aucun changement direct routeur prod ou page hotspot locale

## 2026-03-22 - V2.2 auth + users: bootstrap admin coherent, edition profil et reset mot de passe

- statut: valide localement
- zone: SaaS + documentation
- fichiers principaux:
  - `backend/prisma/admin-bootstrap.config.cjs`
  - `backend/prisma/seed.ts`
  - `backend/prisma/recover_admin.js`
  - `backend/src/modules/auth/dto/login.dto.ts`
  - `backend/src/modules/users/dto/users.dto.ts`
  - `backend/src/modules/users/users.controller.ts`
  - `backend/src/modules/users/users.service.ts`
  - `backend/src/modules/users/users.service.spec.ts`
  - `frontend/src/app/(auth)/login/page.tsx`
  - `frontend/src/app/(dashboard)/resellers/page.tsx`
  - `frontend/src/lib/api.ts`
  - `docs/modules/AUTH_PERMISSIONS.md`
  - `docs/modules/USERS_RESELLERS.md`
  - `docs/modules/ROUTERS.md`
  - `docs/operations/SITE_MAINTENANCE.md`
- verification:
  - tests backend cibles OK:
    - `users/resellers`
    - `auth/utils`
    - `auth/permissions`
  - resultat: `14/14` tests verts
  - frontend build OK
  - frontend type-check OK
  - backend build global toujours bloque par des erreurs existantes et non liees dans `subscriptions`
  - commit Git: `e73900c`
  - commit doc complementaire: `e48f3db`
  - push GitHub OK (`main`)
  - archive de deploiement prete:
    - `saas-v2_2-auth-users-20260322.tar.gz`
- reserve:
  - deploiement VPS necessite une authentification SSH interactive
  - recette UI prod a faire apres push sur `/login` et `/resellers`
  - aucun changement direct routeur prod ou page hotspot locale

## 2026-03-22 - Initialisation Git propre et preparation du depot GitHub

- statut: publie sur GitHub
- zone: repo + documentation
- fichiers principaux:
  - `.gitignore`
  - `README.md`
  - `docs/operations/TASK_LOG.md`
- verification:
  - archives et artefacts de deploiement ignores
  - secrets `.env*` toujours ignores
  - migrations Prisma SQL de nouveau versionnables
  - remote `origin` configure sur `git@github.com:tru11y/mikroserver.git`
  - branche `main` poussee et trackee sur `origin/main`
- reserve:
  - aucun changement runtime SaaS
  - aucun changement direct routeur prod ou page hotspot locale

## 2026-03-16 - Stabilisation frontend proxy: login navigateur et healthcheck dashboard

- statut: valide localement
- zone: SaaS + documentation
- fichiers principaux:
  - `frontend/src/app/proxy/[...path]/route.ts`
  - `frontend/src/lib/api.ts`
  - `frontend/src/app/(auth)/login/page.tsx`
  - `frontend/next.config.js`
  - `frontend/Dockerfile`
  - `infrastructure/docker/docker-compose.prod.yml`
  - `docs/modules/FRONTEND_PROXY.md`
  - `docs/modules/README.md`
  - `docs/README.md`
  - `docs/operations/SITE_MAINTENANCE.md`
- verification:
  - frontend build OK
  - frontend type-check OK
  - recette prod a faire apres push:
    - `/login`
    - `/proxy/api/v1/health/live`
    - login admin via proxy
    - `docker compose ... ps`
- reserve:
  - aucun deploiement VPS sur ce lot a ce stade
  - aucun changement direct routeur prod ou page hotspot locale

## 2026-03-16 - V2.2 module users/resellers: garde-fous et normalisation

- statut: valide localement
- zone: SaaS + documentation
- fichiers principaux:
  - `backend/src/modules/users/dto/users.dto.ts`
  - `backend/src/modules/users/users.service.ts`
  - `backend/src/modules/users/users.controller.ts`
  - `backend/src/modules/users/users.service.spec.ts`
  - `frontend/src/app/(dashboard)/resellers/page.tsx`
  - `docs/modules/USERS_RESELLERS.md`
  - `docs/modules/README.md`
  - `docs/README.md`
- verification:
  - tests backend cibles OK:
    - `users/resellers`
    - `auth/permissions`
    - `audit`
  - resultat: `13/13` tests verts
  - backend build OK
  - frontend type-check OK
  - frontend build OK
- reserve:
  - aucun deploiement VPS sur ce lot
  - recette UI prod a faire apres push sur `/resellers`
  - aucun changement direct routeur prod ou page hotspot locale

## 2026-03-16 - V2.2 module audit: API de consultation + page dediee

- statut: valide localement
- zone: SaaS + documentation
- fichiers principaux:
  - `backend/src/modules/audit/dto/audit.dto.ts`
  - `backend/src/modules/audit/audit.controller.ts`
  - `backend/src/modules/audit/audit.service.ts`
  - `backend/src/modules/audit/audit.service.spec.ts`
  - `backend/src/modules/audit/audit.module.ts`
  - `backend/src/modules/auth/permissions/permissions.constants.ts`
  - `frontend/src/app/(dashboard)/audit/page.tsx`
  - `frontend/src/components/dashboard/sidebar.tsx`
  - `frontend/src/lib/api.ts`
  - `docs/modules/AUDIT.md`
  - `docs/modules/README.md`
  - `docs/README.md`
- verification:
  - tests backend cibles OK:
    - `audit`
    - `auth/permissions`
    - `routers`
    - `vouchers`
    - `metrics`
    - `sessions`
    - `payments/webhooks`
  - resultat: `34/34` tests verts
  - backend build OK
  - frontend type-check OK
  - frontend build OK
- reserve:
  - aucun deploiement VPS sur ce lot
  - recette UI prod a faire apres push sur `/audit`
  - aucun changement direct routeur prod ou page hotspot locale

## 2026-03-16 - V2.2 module router ops: statuts complets et edition reseau fiable

- statut: valide localement
- zone: SaaS + documentation
- fichiers principaux:
  - `backend/src/modules/routers/dto/router.dto.ts`
  - `backend/src/modules/routers/routers.service.ts`
  - `backend/src/modules/routers/routers.service.spec.ts`
  - `frontend/src/app/(dashboard)/routers/page.tsx`
  - `frontend/src/app/(dashboard)/routers/[id]/page.tsx`
  - `docs/modules/ROUTERS.md`
- verification:
  - tests backend cibles OK:
    - `routers`
  - resultat: `6/6` tests verts
  - backend build OK
  - frontend type-check OK
  - frontend build OK
- reserve:
  - aucun deploiement VPS sur ce lot a ce stade
  - aucun changement direct routeur prod ou page hotspot locale

## 2026-03-15 - Stabilisation auth: recovery admin durable

- statut: valide localement
- zone: SaaS + documentation
- fichiers principaux:
  - `backend/src/modules/auth/auth.utils.ts`
  - `backend/src/modules/auth/auth.utils.spec.ts`
  - `backend/src/modules/auth/auth.service.ts`
  - `backend/src/modules/auth/dto/login.dto.ts`
  - `backend/prisma/recover_admin.js`
  - `backend/prisma/seed.ts`
  - `backend/package.json`
  - `docs/operations/SITE_MAINTENANCE.md`
  - `docs/modules/AUTH_PERMISSIONS.md`
- verification:
  - tests backend cibles OK:
    - `auth`
    - `payments/webhooks`
    - `sessions`
    - `routers`
    - `vouchers`
    - `metrics`
  - resultat: `33/33` tests verts
  - backend build OK
- reserve:
  - aucun deploiement VPS sur ce lot
  - le script de recovery doit encore etre pousse puis execute sur le VPS

## 2026-03-15 - Stabilisation modulaire: payments webhooks

- statut: valide localement
- zone: SaaS + documentation
- fichiers principaux:
  - `backend/src/modules/payments/providers/wave.provider.spec.ts`
  - `backend/src/modules/webhooks/webhooks.controller.spec.ts`
  - `docs/modules/PAYMENTS_WEBHOOKS.md`
  - `docs/modules/README.md`
  - `docs/README.md`
- verification:
  - tests backend cibles OK:
    - `payments/webhooks`
    - `sessions`
    - `auth/permissions`
    - `routers`
    - `vouchers`
    - `metrics`
  - resultat: `32/32` tests verts
  - backend build OK
- reserve:
  - aucun deploiement VPS sur ce lot
  - aucun changement direct routeur prod ou page hotspot locale

## 2026-03-18 — Fix authentification admin: compat argon2 + upgrade automatique vers bcrypt

- statut: valide localement (docker-compose.dev + test_api.py)
- zone: backend/auth + scripts prisma
- probleme:
  - certains comptes admins ont un `passwordHash` en **argon2** (ex: script `backend/prisma/recover_admin.js`)
  - l'API vérifiait uniquement **bcrypt**, donc login impossible (401 Invalid credentials)
- correction:
  - `AuthService` vérifie maintenant **bcrypt OU argon2**
  - si argon2 valide: **upgrade automatique** du hash en bcrypt au 1er login réussi
  - `recover_admin.js` génère désormais du **bcrypt** pour éviter que le problème revienne
  - throttling désactivé temporairement (package `@nestjs/throttler` non aligné Nest v11)
- verification:
  - `docker compose -f infrastructure/docker/docker-compose.dev.yml up -d`
  - `npm -w backend run prisma:generate`
  - `npm -w backend run prisma:migrate`
  - `npm -w backend run prisma:seed` (admin: `admin@mikroserver.com` / `12345678`)
  - `npm -w backend run start:dev`
  - `python infrastructure/docker/test_api.py` => 200 OK

## 2026-03-15 - Stabilisation modulaire: sessions

- statut: valide localement
- zone: SaaS + documentation
- fichiers principaux:
  - `backend/src/modules/sessions/sessions.service.spec.ts`
  - `docs/modules/SESSIONS.md`
  - `docs/modules/README.md`
  - `docs/README.md`
- verification:
  - tests backend cibles OK:
    - `sessions`
    - `auth/permissions`
    - `routers`
    - `vouchers`
    - `metrics`
  - resultat: `25/25` tests verts
  - backend build OK
- reserve:
  - aucun deploiement VPS sur ce lot
  - aucun changement direct routeur prod ou page hotspot locale

## 2026-03-15 - Stabilisation modulaire: auth permissions, routers, vouchers, metrics

- statut: valide localement
- zone: SaaS + documentation
- fichiers principaux:
  - `backend/src/modules/auth/permissions/permissions.constants.spec.ts`
  - `backend/src/modules/routers/routers.service.spec.ts`
  - `docs/modules/README.md`
  - `docs/modules/AUTH_PERMISSIONS.md`
  - `docs/modules/ROUTERS.md`
  - `docs/modules/VOUCHERS.md`
  - `docs/modules/METRICS.md`
  - `docs/README.md`
- verification:
  - tests backend cibles OK:
    - `auth/permissions`
    - `routers`
    - `vouchers`
    - `metrics`
  - resultat: `22/22` tests verts
  - backend build OK
- reserve:
  - aucune livraison VPS sur ce lot
  - aucun changement direct routeur prod ou page hotspot locale

## 2026-03-15 - V2 reporting et incidents

- statut: deploye sur VPS
- zone: SaaS
- fichiers principaux:
  - `backend/src/modules/metrics/metrics.service.ts`
  - `backend/src/modules/metrics/metrics.controller.ts`
  - `frontend/src/app/(dashboard)/analytics/page.tsx`
  - `frontend/src/app/(dashboard)/incidents/page.tsx`
- verification:
  - backend build OK
  - frontend build OK
  - frontend type-check OK
  - production:
    - `/api/v1/health/live` OK
    - `/analytics` OK
    - `/incidents` OK
- reserve:
  - healthcheck dashboard encore sensible selon l'URL testee

## 2026-03-15 - Bouton admin supprimer definitivement + correctifs navbar

- statut: prepare et valide localement
- zone: SaaS
- fichiers principaux:
  - `backend/src/modules/vouchers/voucher.service.ts`
  - `backend/src/modules/vouchers/vouchers.controller.ts`
  - `backend/src/modules/routers/router-api.service.ts`
  - `frontend/src/components/dashboard/sidebar.tsx`
  - `frontend/src/app/(dashboard)/vouchers/verify/page.tsx`
  - `frontend/src/app/(dashboard)/sessions/page.tsx`
  - `frontend/src/app/(dashboard)/routers/[id]/page.tsx`
- verification:
  - tests backend vouchers/PDF OK
  - backend build OK
  - frontend build OK
  - frontend type-check OK
- reserve:
  - recette UI terrain encore necessaire sur VPS apres push

## 2026-03-15 - V2 routeurs: multi-site, tags, bulk actions

- statut: valide localement, archive de deploiement prete
- zone: SaaS
- fichiers principaux:
  - `backend/src/modules/routers/dto/router.dto.ts`
  - `backend/src/modules/routers/routers.controller.ts`
  - `backend/src/modules/routers/routers.service.ts`
  - `frontend/src/app/(dashboard)/routers/page.tsx`
  - `frontend/src/lib/api.ts`
- verification:
  - tests backend routeurs/vouchers/PDF OK
  - backend build OK
  - frontend build OK
  - frontend type-check OK
- reserve:
  - deploiement VPS et recette UI routeurs encore a faire

## 2026-03-15 - Hotfix IDs verification ticket et page routeur

- statut: valide localement
- zone: SaaS
- fichiers principaux:
  - `backend/src/modules/vouchers/vouchers.controller.ts`
  - `backend/src/modules/vouchers/voucher.service.ts`
  - `backend/src/modules/vouchers/voucher.service.spec.ts`
  - `frontend/src/app/(dashboard)/routers/[id]/page.tsx`
- verification:
  - tests backend vouchers OK
  - backend build OK
  - frontend build OK
- reserve:
  - hotfix pas encore redeploye au moment de cette entree

## Regle de tenue a jour

- toute nouvelle tache terminee doit ajouter une nouvelle entree ici
- si une tache est seulement locale, le statut doit le dire explicitement
- si une tache est poussee sur VPS, indiquer les checks prod confirms

## 2026-03-25 - Routeurs: profils hotspot plus robustes

- statut: valide localement, push GitHub pret a deployer
- zone: SaaS
- fichiers principaux:
  - `backend/src/modules/routers/router-api.service.ts`
  - `backend/src/modules/routers/router-hotspot-profiles.utils.ts`
  - `backend/src/modules/routers/router-hotspot-profiles.utils.spec.ts`
  - `frontend/src/app/(dashboard)/routers/[id]/page.tsx`
  - `frontend/src/app/(dashboard)/routers/[id]/hotspot-profile-change-modal.tsx`
  - `frontend/src/app/(dashboard)/routers/[id]/hotspot-profiles-section.tsx`
  - `frontend/src/app/(dashboard)/routers/[id]/router-detail.selectors.ts`
  - `frontend/src/app/(dashboard)/routers/[id]/router-detail.selectors.spec.ts`
- verification:
  - `npm test --workspace backend -- --runInBand` OK (`22 suites`, `81 tests`)
  - `npm run build --workspace backend` OK
  - `npm test --workspace frontend` OK (`3 suites`, `13 tests`)
  - `npm run lint --workspace frontend` OK
  - `npm run build --workspace frontend` OK
- resultat:
  - changement de profil user: dropdown alimentee par un catalogue multi-source au lieu du seul profil courant
  - section profils: fallback visuel si la lecture detaillee Winbox revient vide
  - edition profils: update RouterOS plus strict, uniquement sur les champs reellement modifies
  - `rate-limit (rx/tx)`: la mise a jour et le vidage volontaire des champs optionnels sont maintenant supportes cote backend
- reserve:
  - le detail routeur reste trop gros (`page.tsx` 1214 lignes)
  - le service RouterOS reste trop gros (`router-api.service.ts` 1005 lignes)
  - etat reel estime: encore en dessous de `9/10`

## 2026-03-25 - Frontend routeurs: refresh auth plus propre et overview extrait

- statut: valide localement, push GitHub pret a deployer
- zone: SaaS
- fichiers principaux:
  - `frontend/src/lib/api/auth-session.ts`
  - `frontend/src/lib/api/auth-session.spec.ts`
  - `frontend/src/lib/api/client.ts`
  - `frontend/src/app/(dashboard)/routers/[id]/router-overview-section.tsx`
  - `frontend/src/app/(dashboard)/routers/[id]/page.tsx`
- verification:
  - `npm test --workspace frontend` OK (`4 suites`, `15 tests`)
  - `npm run lint --workspace frontend` OK
  - `npm run build --workspace frontend` OK
- resultat:
  - refresh token plus proactif si le token d acces est absent ou quasi expire
  - diminution attendue des `401` parasites au chargement et au retour de focus
  - bloc `aperçu/diagnostic` routeur extrait hors de `page.tsx`
  - `page.tsx` routeur reduite de `1214` a `975` lignes
- reserve:
  - `router-api.service.ts` reste a `1120` lignes
  - etat global encore en dessous de `9/10`

## 2026-03-25 - Frontend routeurs: hook de lecture dedie

- statut: valide localement, push GitHub pret a deployer
- zone: SaaS
- fichiers principaux:
  - `frontend/src/app/(dashboard)/routers/[id]/use-router-detail-data.ts`
  - `frontend/src/app/(dashboard)/routers/[id]/page.tsx`
- verification:
  - `npm run lint --workspace frontend` OK
  - `npm test --workspace frontend` OK (`4 suites`, `15 tests`)
  - `npm run build --workspace frontend` OK
- resultat:
  - queries routeur, permissions et derivees de lecture sorties de `page.tsx`
  - `page.tsx` routeur reduite de `975` a `806` lignes
  - l orchestration UI reste encore dense, mais la lecture des donnees n est plus melangee au rendu principal
- reserve:
  - `router-api.service.ts` reste a `1120` lignes
  - `page.tsx` reste encore trop grosse pour annoncer `9/10`

## 2026-03-25 - Frontend routeurs: actions live et hotspot extraites

- statut: valide localement, push GitHub pret a deployer
- zone: SaaS
- fichiers principaux:
  - `frontend/src/app/(dashboard)/routers/[id]/use-router-live-operations.ts`
  - `frontend/src/app/(dashboard)/routers/[id]/use-router-hotspot-management.ts`
  - `frontend/src/app/(dashboard)/routers/[id]/page.tsx`
  - `frontend/src/app/(dashboard)/routers/[id]/router-detail.utils.ts`
  - `frontend/src/app/(dashboard)/routers/[id]/router-detail.selectors.ts`
  - `docs/audit/FRONTEND_UI_UX_AUDIT_2026-03-25.md`
- verification:
  - `npm run lint --workspace frontend` OK
  - `npm test --workspace frontend` OK (`4 suites`, `17 tests`)
  - `npm run build --workspace frontend` OK
- resultat:
  - `page.tsx` routeur reduite de `806` a `412` lignes
  - actions live, health check, sync, suppression ticket et tri clients extraits
  - workflows hotspot (profil/ip-binding/profil RouterOS) extraits hors de la page
  - tri uptime des clients corrige avec parsing reel du format RouterOS
  - le changement de profil bloque maintenant les faux no-op sur le profil deja actif
- reserve:
  - `use-router-hotspot-management.ts` reste encore lourd (`526` lignes)
  - `router-api.service.ts` reste a `1120` lignes
  - on n est toujours pas a `9/10`

## 2026-03-25 - Routeurs: decoupage hotspot backend + page routeur guidee par sections

- statut: valide localement, push GitHub pret a deployer
- zone: backend routers + frontend router detail + docs
- fichiers principaux:
  - `backend/src/modules/routers/router-api.service.ts`
  - `backend/src/modules/routers/router-hotspot-profiles.operations.ts`
  - `backend/src/modules/routers/router-hotspot-ip-bindings.operations.ts`
  - `backend/src/modules/routers/router-hotspot-users.operations.ts`
  - `backend/src/modules/routers/router-operations.types.ts`
  - `backend/src/modules/routers/router-hotspot-users.utils.ts`
  - `frontend/src/app/(dashboard)/routers/[id]/router-section-nav.tsx`
  - `frontend/src/app/(dashboard)/routers/[id]/use-router-detail-data.ts`
  - `frontend/src/app/(dashboard)/routers/[id]/page.tsx`
  - `docs/audit/MODULARITY_AUDIT_2026-03-24.md`
  - `docs/audit/FRONTEND_UI_UX_AUDIT_2026-03-25.md`
  - `docs/modules/ROUTERS.md`
  - `docs/operations/TASK_LOG.md`
- verification:
  - `npm test --workspace backend -- --runInBand` OK (`22 suites`, `81 tests`)
  - `npm run build --workspace backend` OK
  - `npm run lint --workspace frontend` OK
  - `npm test --workspace frontend` OK (`4 suites`, `17 tests`)
  - `npm run build --workspace frontend` OK
- resultat:
  - `router-api.service.ts` reduit a `690` lignes
  - hotspot backend decoupe en operations dediees profils / ip-bindings / users
  - type de connexion routeur partage isole hors des modules d operations
  - page routeur guidee par sections pour eviter l effet "tout sur le meme ecran"
  - chargement frontend plus cible sur les zones lourdes routeur
- reserve:
  - `use-router-hotspot-management.ts` reste encore lourd (`485` lignes)
  - `metrics.service.ts` devient un prochain gros point noir
  - note honnete encore sous `9/10`

## 2026-03-25 - Routeurs: gestion de profil rendue visible en permanence + registre de verification

- statut: valide localement, push GitHub pret a deployer
- zone: frontend router detail + gouvernance qualite + docs
- fichiers principaux:
  - `frontend/src/app/(dashboard)/routers/[id]/page.tsx`
  - `frontend/src/app/(dashboard)/routers/[id]/router-hotspot-shortcuts.tsx`
  - `docs/operations/FEATURE_VERIFICATION_LEDGER.md`
  - `docs/operations/TASK_LOG.md`
  - `docs/audit/FRONTEND_UI_UX_AUDIT_2026-03-25.md`
- verification:
  - `npm run lint --workspace frontend` OK
  - `npm test --workspace frontend` OK (`4 suites`, `17 tests`)
  - `npm run build --workspace frontend` OK
  - `npm test --workspace backend -- --runInBand` OK (`22 suites`, `81 tests`)
  - `npm run build --workspace backend` OK
- resultat:
  - la gestion de profil n est plus "cachée" par un simple changement de section
  - la page routeur ouvre maintenant par defaut la zone utile a l exploitation profil (`users`)
  - un bloc `Accès rapide hotspot` garde visibles en permanence:
    - changement de profil
    - actions sur clients connectes
    - gestion des profils RouterOS
    - gestion des IP bindings
  - registre fonctionnel ajoute pour marquer ce qui est fini et revalide
- reserve:
  - meilleure clarte, mais UI/UX routeur toujours sous `9/10`
  - il faut encore decouper `use-router-hotspot-management.ts` et raffiner le design global

## 2026-03-25 - Routeurs: catalogue profils fiabilise + hook hotspot casse en sous-hooks

- statut: valide localement, push GitHub pret a deployer
- zone: frontend router detail + registre + audit
- fichiers principaux:
  - `frontend/src/app/(dashboard)/routers/[id]/use-router-detail-data.ts`
  - `frontend/src/app/(dashboard)/routers/[id]/use-router-hotspot-management.ts`
  - `frontend/src/app/(dashboard)/routers/[id]/use-hotspot-profile-change.ts`
  - `frontend/src/app/(dashboard)/routers/[id]/use-hotspot-ip-bindings-management.ts`
  - `frontend/src/app/(dashboard)/routers/[id]/use-hotspot-profile-config-management.ts`
  - `frontend/src/app/(dashboard)/routers/[id]/page.tsx`
  - `frontend/src/app/(dashboard)/routers/[id]/router-detail.selectors.spec.ts`
  - `docs/operations/FEATURE_VERIFICATION_LEDGER.md`
  - `docs/audit/FRONTEND_UI_UX_AUDIT_2026-03-25.md`
  - `docs/modules/ROUTERS.md`
- verification:
  - `npm run lint --workspace frontend` OK
  - `npm test --workspace frontend` OK (`4 suites`, `18 tests`)
  - `npm run build --workspace frontend` OK
  - `npm test --workspace backend -- --runInBand` OK (`22 suites`, `81 tests`)
  - `npm run build --workspace backend` OK
- resultat:
  - `use-router-hotspot-management.ts` descend a `29` lignes
  - la gestion hotspot est maintenant separee en 3 briques:
    - changement de profil utilisateur
    - gestion des IP bindings
    - gestion des profils RouterOS
  - les profils issus des forfaits SaaS sont charges meme hors section `Profils`
  - la dropdown de changement de profil ne depend plus d un effet implicite qui reinitialise l etat de la modal
  - le flux de changement de profil reste visible et plus robuste face aux chargements tardifs
- reserve:
  - `use-hotspot-ip-bindings-management.ts` reste la sous-brique hotspot la plus lourde
  - l UX routeur progresse, mais ne merite toujours pas `9/10`

## 2026-03-25 - Frontend: refonte premium `resellers` + `routers`

- statut: valide localement, VPS en maintenance donc non deploye
- zone: frontend resellers/routers + audit/registre
- fichiers principaux:
  - `frontend/src/app/(dashboard)/resellers/page.tsx`
  - `frontend/src/app/(dashboard)/resellers/use-resellers-page.ts`
  - `frontend/src/app/(dashboard)/resellers/resellers-directory-section.tsx`
  - `frontend/src/app/(dashboard)/resellers/reseller-create-modal.tsx`
  - `frontend/src/app/(dashboard)/resellers/reseller-access-modal.tsx`
  - `frontend/src/app/(dashboard)/resellers/reseller-profile-modal.tsx`
  - `frontend/src/app/(dashboard)/routers/page.tsx`
  - `frontend/src/app/(dashboard)/routers/use-routers-page.ts`
  - `frontend/src/app/(dashboard)/routers/routers-fleet-section.tsx`
  - `frontend/src/app/(dashboard)/routers/router-form-panel.tsx`
  - `frontend/src/components/dashboard/dashboard-modal-shell.tsx`
  - `docs/audit/FRONTEND_UI_UX_AUDIT_2026-03-25.md`
  - `docs/audit/MODULARITY_AUDIT_2026-03-24.md`
  - `docs/operations/FEATURE_VERIFICATION_LEDGER.md`
- verification:
  - `npm run lint --workspace frontend` OK
  - `npm test --workspace frontend` OK (`8 suites`, `32 tests`)
  - `npm run build --workspace frontend` OK
- resultat:
  - `resellers/page.tsx` reduite de `952` a `185` lignes
  - `routers/page.tsx` reduite de `891` a `159` lignes
  - les deux ecrans basculent d une logique "listing/table brute" a une logique cockpit:
    - hero
    - filtres plus visibles
    - cartes plus lisibles
    - actions sensibles mieux hierarchisees
    - modales unifiees et plus presentables
  - ajout d une vraie recherche `resellers`
  - suppression du `window.confirm` brut pour les routeurs
- reserve:
  - vrai bond UX/design, mais toujours pas `9.8/10` sur l ensemble du produit
  - il faut maintenant diffuser ce niveau de finition aux autres routes majeures du SaaS

## 2026-03-25 - Routeurs: timeouts RouterOS durcis + mode degrade frontend credible

- statut: valide localement, pret pour deploiement VPS
- zone: backend routeurs + frontend detail routeur + registre
- fichiers principaux:
  - `backend/src/modules/routers/router-api.service.ts`
  - `backend/src/modules/routers/router-api.service.spec.ts`
  - `backend/src/config/configuration.ts`
  - `backend/src/config/app.config.ts`
  - `frontend/src/app/(dashboard)/routers/[id]/use-router-detail-data.ts`
  - `frontend/src/app/(dashboard)/routers/[id]/page.tsx`
  - `frontend/src/app/(dashboard)/routers/[id]/router-overview-section.tsx`
  - `frontend/src/app/(dashboard)/routers/[id]/router-section-nav.tsx`
  - `frontend/src/app/(dashboard)/routers/[id]/router-hotspot-shortcuts.tsx`
  - `frontend/src/app/(dashboard)/routers/[id]/hotspot-users-section.tsx`
  - `frontend/src/app/(dashboard)/routers/[id]/hotspot-profile-change-modal.tsx`
  - `frontend/src/app/(dashboard)/routers/[id]/router-detail.selectors.ts`
  - `frontend/src/app/(dashboard)/routers/[id]/router-detail.selectors.spec.ts`
  - `docs/operations/FEATURE_VERIFICATION_LEDGER.md`
- verification:
  - `npm test --workspace backend -- --runInBand router-api.service.spec.ts` OK
  - `npm test --workspace frontend -- router-detail.selectors.spec.ts` OK
  - `npm test --workspace backend -- --runInBand` OK (`26 suites`, `97 tests`)
  - `npm run build --workspace backend` OK
  - `npm run lint --workspace frontend` OK
  - `npm test --workspace frontend` OK (`8 suites`, `33 tests`)
  - `npm run build --workspace frontend` OK
- resultat:
  - backend:
    - timeouts RouterOS differencies par type d operation:
      - `health`
      - `live`
      - `heavy-read`
      - `write`
    - les timeouts `live/sync` sont maintenant remontes en erreurs HTTP explicites au lieu de `500` opaques
    - un timeout live/sync marque le routeur `DEGRADED` et enregistre l erreur de sync
  - frontend:
    - la vue routeur n affiche plus des `0` trompeurs partout quand une section lourde tombe en erreur
    - les badges de section passent en `!` quand la donnee est indisponible
    - le compteur live peut reutiliser le dernier nombre connu au lieu de tomber a `0`
    - la recherche utilisateur hotspot ne charge plus la table complete tant qu aucun terme precis n est saisi
    - les requetes lourdes routeur ont maintenant `retry` limite + `placeholderData` pour moins casser l UX
    - la dropdown de changement de profil reintegre toujours le profil courant meme si le catalogue charge est incomplet
- reserve:
  - on a rendu la plateforme plus fiable et moins trompeuse, mais pas encore `9.8/10`
  - `backend/src/modules/routers/router-api.service.ts` remonte a `828 lignes` avec ce durcissement; prochaine etape: re-extraire la politique timeout/erreurs hors du service principal
  - `voucher.service.ts` reste le prochain gros monolithe backend
  - l identite visuelle produit globale demande encore une passe premium sur d autres routes

## 2026-03-28 - Deploy prod: diagnostic Redis plus explicite

- statut: valide localement, pret a pousser
- zone: infrastructure de deploiement
- fichiers principaux:
  - `infrastructure/docker/deploy.sh`
- verification:
  - lecture du diff OK
- resultat:
  - le script de deploiement attend maintenant explicitement l etat `healthy/running` de `postgres` puis `redis`
  - si `redis` tombe en `unhealthy`, `exited` ou `dead`, le script imprime automatiquement les derniers logs du conteneur avant d echouer
  - on evite ainsi les deploys "opaques" ou l API/dashboard restent bloques sans vrai diagnostic runtime
- extension:
  - si l echec survient plus tard pendant `api + dashboard`, le script imprime aussi l etat compose courant et les derniers logs Redis avant de sortir
- reserve:
  - ce lot n est pas le correctif Redis lui-meme
  - il fiabilise surtout le diagnostic du prochain run VPS

## 2026-03-28 - Incident prod Redis: script de reparation AOF

- statut: valide par analyse des logs VPS, pret a pousser
- zone: infrastructure Redis / reprise incident
- fichiers principaux:
  - `infrastructure/docker/repair_redis_aof.sh`
- preuve:
  - logs VPS: `Bad file format reading the append only file appendonly.aof.2.incr.aof`
  - cause racine confirmee: corruption AOF incrémentale, pas un mot de passe Redis ni un build dashboard
- resultat:
  - ajout d un script dedie qui:
    - stoppe `api/dashboard/redis`
    - sauvegarde le volume Redis avant toute modification
    - inspecte `appendonlydir`
    - lance `redis-check-aof --fix` sur le manifest multi-part
    - redemarre Redis et attend son etat `healthy/running`
  - la reprise peut se faire sans toucher PostgreSQL
- reserve:
  - si la reparation AOF echoue elle aussi, le prochain cran sera un reset controle du volume Redis

## 2026-03-28 - Deploy prod: forcer le rebuild des migrations + logs API

- statut: pret a pousser
- zone: infrastructure de deploiement
- fichiers principaux:
  - `infrastructure/docker/deploy.sh`
- constat:
  - le script lancait `db-migrate` sans rebuild, ce qui peut reutiliser une image stale et masquer une migration Prisma manquante
  - quand l API tombait en boucle, le diagnostic n imprimait pas encore ses logs
- resultat:
  - `db-migrate` est maintenant lance avec `--build`
  - en cas d echec sur `api/dashboard`, le script imprime aussi les derniers logs API
  - le script attend explicitement la sante de l API apres demarrage

## 2026-03-28 - Boot backend: providers paiement externes rendus optionnels

- statut: en cours de validation locale
- zone: backend config + providers paiement + transactions
- fichiers principaux:
  - `backend/src/config/configuration.ts`
  - `backend/src/config/configuration.spec.ts`
  - `backend/src/modules/payments/providers/wave.provider.ts`
  - `backend/src/modules/payments/providers/cinetpay.provider.ts`
  - `backend/src/modules/payments/providers/mock.provider.ts`
  - `backend/src/modules/payments/providers/wave.provider.spec.ts`
  - `backend/src/modules/transactions/transactions.service.ts`
- constat:
  - l API mourait au bootstrap si `WAVE_*` / `CINETPAY_*` etaient absents ou vides
  - `WaveProvider` et `CinetPayProvider` utilisaient `getOrThrow` au constructeur, meme quand le provider n etait pas utilise
  - `transactions.service` dependait encore implicitement de `wave.successUrl/errorUrl`
- resultat attendu:
  - Wave et CinetPay peuvent etre absents sans empecher le boot du backend
  - un provider externe non configure echoue seulement au moment ou on l invoque
  - les URLs de retour paiement ont maintenant des fallbacks generiques
