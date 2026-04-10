# V4.5 - Plan de Preparation

Date: 2026-03-23

## Objectif V4.5

Passer d'une V3 focalisee "permissions + supervision" a une release orientee **operations multi-sites et fiabilite business**:

- incidents exploitables avec workflow clair
- reporting actionnable pour pilotage quotidien
- operations de masse robustes (routeurs + tickets)
- process de release plus court et plus predictable

## Perimetre fonctionnel V4.5

## P1 - Incidents operationnels complets

- enrichir le centre d'incidents (filtres, etat, acquittement, commentaires courts)
- priorisation standardisee (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`) partout
- liens rapides incident -> routeur/ticket/ecran concerne

## P2 - Reporting decisionnel terrain

- rapports par routeur, revendeur, operateur et forfait
- export CSV/PDF homogene (colonnes stables, timezone explicite)
- synthese journaliere: creation, activation, echec delivery, incidents majeurs

## P3 - Operations de masse

- actions de masse routeurs (sync, health-check, maintenance) avec recapitulatif d'execution
- actions de masse tickets (suppression sure, relivraison, export) avec feedback detaille
- garde-fous supplementaires sur actions irreversibles

## P4 - Fiabilite livraison / exploitation

- hardening release script (checks pre/post deploy standardises)
- verification systematique des services clefs:
  - api live/ready
  - dashboard login
  - nginx config/test
- rollback documente en moins de 10 minutes

## Plan de lots V4.5

## Lot 1 - Incidents V2

- backend:
  - modele incident enrichi
  - endpoints listing + acknowledge
- frontend:
  - centre incidents avec filtres severite/type/statut
  - detail incident + action rapide

## Lot 2 - Reporting V2

- backend:
  - aggregation par routeur/revendeur/forfait
  - export robuste CSV/PDF
- frontend:
  - page rapports avec filtres persistants
  - cartes KPI + breakdown comparatif

## Lot 3 - Bulk Ops V2

- backend:
  - execution en lot avec retour success/failure explicite
- frontend:
  - UX unifiee pour actions de masse
  - historique d'execution recent

## Definition de done V4.5

- backend build OK
- frontend build OK
- frontend type-check OK
- tests cibles du lot OK
- docs mises a jour:
  - `docs/operations/TASK_LOG.md`
  - document module impacte
- verification VPS post-release:
  - `docker compose ... ps`
  - `GET /api/v1/health/live`
  - smoke login admin

## Hors perimetre V4.5

- refonte mobile complete
- migration majeure payment provider
- changement direct routeur MikroTik prod sans plan rollback detaille

## Demarrage recommande

Demarrage immediat: **Lot 1 - Incidents V2**.

Raison: meilleure reduction du risque operationnel avec impact direct support/exploitation.
