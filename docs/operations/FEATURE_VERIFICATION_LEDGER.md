# Registre de Verification Fonctionnelle

Date de creation: 2026-03-25

## Objectif

Eviter qu une refactorisation ou un "petit correctif" casse une fonction deja livree sans qu on s en rende compte.

Regle:

- toute fonctionnalite marquee `VALIDE` ici doit rester verifiee apres un lot important
- si un comportement change volontairement, le registre doit etre mis a jour
- si un comportement est cassé, il passe a `EN INCIDENT` tant qu il n est pas revalide

## Routeurs - Detail routeur

| Fonction | Statut | Derniere validation | Preuve |
| --- | --- | --- | --- |
| Aperçu routeur + sync + health check | VALIDE | 2026-03-25 | `npm run build --workspace frontend`, `npm run build --workspace backend` |
| Clients connectés: affichage live + tri + actions couper/supprimer | VALIDE | 2026-03-25 | frontend tests/build OK, code decoupe |
| Changement de profil depuis clients connectés | VALIDE | 2026-03-25 | hook `use-router-hotspot-management.ts`, build frontend OK |
| Recherche utilisateur hotspot + changement de profil | VALIDE | 2026-03-25 | frontend build OK, section dediee |
| Catalogue de profils pour changement de profil | VALIDE | 2026-03-25 | plans charges hors section `Profils`, test selector ajoute |
| Profil courant toujours visible dans la dropdown de changement | VALIDE | 2026-03-25 | test `router-detail.selectors.spec.ts` + modal durcie |
| Profils RouterOS: lecture + create/update/delete | VALIDE | 2026-03-25 | backend tests/build OK |
| Edition `rate-limit (rx/tx)` profil RouterOS | VALIDE | 2026-03-25 | backend tests/build OK |
| IP bindings: lecture | VALIDE | 2026-03-25 | backend/frontend build OK |
| IP bindings: create/update/delete | VALIDE | 2026-03-25 | tests `hotspot-ip-binding.forms.spec.ts` + builds backend/frontend OK |
| IP bindings: block/unblock + enable/disable | VALIDE | 2026-03-25 | backend/frontend build OK |
| Conformité forfait: première connexion + écoulé + expiration | VALIDE | 2026-03-25 | backend tests `router-api.service.spec.ts` OK |
| Proxy dashboard routes lentes routeur | VALIDE | 2026-03-25 | durcissement timeout/retry déjà en place |
| Timeouts RouterOS lourds (`live`, `profiles`, `users`, `bindings`, `sync`) | VALIDE | 2026-03-28 | backend tests `router-api.service.spec.ts` + build backend OK |
| Vue routeur en mode degrade sans faux zero trompeur | VALIDE | 2026-03-25 | build frontend OK, badges `!`, fallback counts, dernier count live connu |

## Authentification

| Fonction | Statut | Derniere validation | Preuve |
| --- | --- | --- | --- |
| Login admin | VALIDE | 2026-03-25 | backend/frontend build OK |
| Refresh session frontend | VALIDE | 2026-03-25 | tests `auth-session.spec.ts` OK |
| Mot de passe oublié / reset | VALIDE | 2026-03-28 | spec `auth.service.spec.ts` restauré + backend build OK |
| Headers securite frontend Next | VALIDE | 2026-03-25 | `npm run build --workspace frontend` OK |

## Frontend platform

| Fonction | Statut | Derniere validation | Preuve |
| --- | --- | --- | --- |
| Focus visible global + reduced motion | VALIDE | 2026-03-25 | `npm run build --workspace frontend` OK |
| Cockpit `resellers`: hero + recherche + annuaire + modales securisees | VALIDE | 2026-03-25 | `npm run lint --workspace frontend`, `npm test --workspace frontend`, `npm run build --workspace frontend` |
| Cockpit `routers`: hero + filtres + flotte + actions de masse + composer | VALIDE | 2026-03-25 | `npm run lint --workspace frontend`, `npm test --workspace frontend`, `npm run build --workspace frontend` |
| Build statique Next (`/`, `/portal`, `/offline`) | VALIDE | 2026-03-28 | `npm run build --workspace frontend` OK après correction `offline/page.tsx` |

## Vouchers

| Fonction | Statut | Derniere validation | Preuve |
| --- | --- | --- | --- |
| Verification ticket SaaS / legacy pour operateur | VALIDE | 2026-03-25 | tests `voucher.service.spec.ts` OK |
| Suppression securisee ticket SaaS + bulk delete | VALIDE | 2026-03-25 | tests `voucher.service.spec.ts` OK |
| Suppression definitive ticket legacy routeur | VALIDE | 2026-03-25 | tests `voucher.service.spec.ts` OK |
| PDF / export tickets imprimables | VALIDE | 2026-03-25 | tests `pdf.service.spec.ts` OK |
| Normalisation code ticket / recherche code | VALIDE | 2026-03-25 | tests `voucher.service.helpers.spec.ts` OK |

## Analytics / Metrics

| Fonction | Statut | Derniere validation | Preuve |
| --- | --- | --- | --- |
| Incident center operationnel | VALIDE | 2026-03-25 | tests `metrics.service.spec.ts` OK |
| Rapport tickets + breakdowns + CSV | VALIDE | 2026-03-25 | tests `metrics.service.spec.ts` OK |
| Recommandations quotidiennes | VALIDE | 2026-03-25 | backend tests/build OK |
| Abonnements du jour + expirations + recurrents | VALIDE | 2026-03-25 | tests `metrics.service.spec.ts` OK |
| Cockpit analytics frontend: sections + filtres + export | VALIDE | 2026-03-25 | frontend tests/build OK |

## Dette restante a ne pas oublier

| Sujet | Statut reel | Note dure |
| --- | --- | --- |
| `router-api.service.ts` | EN PROGRES | remonte a 950 lignes; beaucoup de garanties runtime reviennent, mais il faut re-extraire le durcissement timeout/erreurs pour retrouver une vraie note senior |
| `voucher.service.ts` | EN PROGRES | descendu a 990 lignes via extraction helpers, mais reste le plus gros monolithe backend |
| `metrics.service.ts` | EN PROGRES | descendu a 814 lignes via extraction helpers + operations, gros mieux mais encore trop dense pour un vrai `9.5/10` |
| `use-router-hotspot-management.ts` | RESOLU | wrapper decoupe, vigilance restante sur les sous-hooks specialises |
| `use-hotspot-ip-bindings-management.ts` | EN PROGRES | descendu a 248 lignes via extraction des formulaires, mieux structure mais encore perfectible |
| `analytics/page.tsx` | PRESQUE RESOLU | descendu a 77 lignes via hook + sections, vrai bond frontend |
| UI/UX routeur | EN PROGRES | plus lisible, pas encore `9/10` |
| UI/UX resellers | EN PROGRES | nette hausse de clarte, mais identite visuelle encore perfectible pour du vrai premium |
| UI/UX analytics | EN PROGRES | beaucoup plus claire, mais pas encore au niveau premium `9.5+` |
| Architecture microservices/gateway/load balancer | NON APPLIQUEE | aujourd hui on a un monolithe modulaire + reverse proxy |

## Checklist de revalidation apres chaque lot routeur

- `npm test --workspace backend -- --runInBand`
- `npm run build --workspace backend`
- `npm run lint --workspace frontend`
- `npm test --workspace frontend`
- `npm run build --workspace frontend`
- verifier que la gestion de profil reste visible:
  - depuis `Accès rapide hotspot`
  - depuis `Clients connectés`
  - depuis `Recherche utilisateur hotspot`
- verifier qu un timeout routeur ne remplace plus brutalement les compteurs par `0` sans signal visuel
- verifier que la recherche utilisateur hotspot ne declenche plus de lecture complete tant qu aucun terme precis n est saisi
- verifier que la dropdown de changement de profil propose aussi les profils issus des forfaits quand Winbox remonte peu de profils
- verifier les parcours analytics apres un gros refactor backend:
  - `Incident center`
  - `Rapport tickets`
  - `CSV rapport tickets`
  - `Abonnements du jour / expirations / recurrents`
- verifier les cockpits frontend apres gros lot UI:
  - `resellers`: recherche, create user, edition acces, edition profil, reset password, suppression
  - `routers`: filtres, multi-selection, create/update routeur, maintenance, health check, sync, suppression
- verifier les parcours vouchers apres un gros refactor backend:
  - verification operateur
  - suppression securisee / bulk delete
  - suppression legacy definitive
  - export PDF
