# AUDIT

## Objectif

Le module `audit` centralise la tracabilite des actions sensibles du SaaS:

- creations, mises a jour et suppressions
- operations critiques sur tickets, routeurs et utilisateurs
- evenements de securite
- contexte technique utile a l'analyse d'incident

Il ne sert pas a annuler les actions. Il sert a comprendre qui a fait quoi, quand, depuis ou, et sur quelle entite.

## Entrees

- appels a `AuditService.log(...)` depuis les modules metier
- utilisateur courant ou acteur technique
- identifiant routeur si l'action est liee a un MikroTik
- metadonnees techniques:
  - `ipAddress`
  - `userAgent`
  - `requestId`
  - valeurs avant/apres

## Sorties

- ecriture en base dans `AuditLog`
- lecture paginee via `GET /api/v1/audit/logs`
- synthese pour le front:
  - resume
  - pagination
  - filtres disponibles
  - lignes enrichies avec acteur, routeur et libelle d'entite

## API exposee

- `GET /api/v1/audit/logs`

Filtres supportes:

- `page`
- `limit`
- `action`
- `entityType`
- `entityId`
- `actorId`
- `routerId`
- `search`
- `startDate`
- `endDate`

## Permissions

- permission requise: `audit.view`
- acces prevu:
  - `ADMIN_STANDARD`
  - `SUPERVISOR`
  - profils explicites autorises

Le backend reste la source de verite. Le front ne fait qu'un masquage d'interface.

## Dependances autorisees

- `PrismaModule`
- decorateurs d'acces `Roles` et `Permissions`
- `AuditAction` Prisma
- front:
  - `api.auth.me()`
  - `api.audit.logs()`

## Verification minimale a relancer si ce module change

### Backend

- `npm test -- --runInBand src/modules/audit/audit.service.spec.ts`
- `npm run build`

### Frontend

- `npm run type-check`
- `npm run build`

### Recette fonctionnelle

- ouvrir `/audit` avec un compte autorise
- filtrer par action et type d'entite
- verifier la pagination
- verifier l'affichage des details avant/apres
- verifier qu'un compte sans `audit.view` ne voit pas la page

## Risques connus

- le journal d'audit n'annule pas les operations deja appliquees
- certains libelles d'entite sont derives a partir des references encore presentes en base
- si une entite a ete supprimee totalement, l'audit garde l'ID mais peut perdre le libelle enrichi

## Contrat inter-module

- `users`, `routers`, `plans`, `vouchers`, `auth` peuvent ecrire dans l'audit
- le module `audit` ne doit pas contenir de logique metier de suppression, synchronisation ou paiement
- toute nouvelle action sensible ajoutee dans un autre module doit:
  - appeler `AuditService.log(...)`
  - documenter la nature de l'entite et du contexte enregistre
