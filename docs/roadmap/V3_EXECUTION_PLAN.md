# V3 - Plan d'Execution

Date: 2026-03-23

## Objectif V3

Passer de la plateforme "stable en production" a une plateforme "operable a grande echelle":

- delegation plus fine des droits
- supervision proactive et exploitable
- reporting orientee operations multi-sites
- deploiement plus robuste et moins couteux

## Perimetre V3 (priorite)

## P1 - Delegation et controle

- finaliser les permissions fines par domaine (users, vouchers, plans, routers, metrics)
- ajouter des profils operateur predefinis (caissier, superviseur, technicien, revendeur)
- aligner toutes les routes sensibles avec les permissions metier

## P2 - Centre d'incidents

- creer un module incidents exploitable dans le dashboard
- capter et classer les incidents runtime:
  - routeur offline
  - sync failed
  - voucher delivery failed
  - backlog queue critique
- ajouter statuts + acquittement + historique minimal

## P3 - Reporting operations

- rapports filtres par periode, routeur, revendeur
- exports fiables CSV/PDF
- indicateurs incidents + echecs delivery
- base pour resume quotidien

## P4 - Hardening exploitation

- garder le workflow de release canonique VPS comme source unique
- completer les checks post-release (api, dashboard, nginx, login admin)
- nettoyer les warnings Nginx non critiques restants au fil des runs
- documenter rollback court (services + image precedente)

## Lot initial V3.0 (propose)

## Lot A - Permissions metier end-to-end

- backend:
  - verifier la couverture des guards sur routes critiques
  - ajouter/mettre a jour tests permission par module
- frontend:
  - masquer actions interdites selon permissions
  - bloquer actions sensibles cote UI avec message explicite

## Lot B - Incidents MVP

- backend:
  - entite Incident
  - service de creation depuis erreurs techniques ciblees
  - endpoints liste + acquittement
- frontend:
  - page incidents avec filtres basiques
  - detail minimal (source, severite, date, statut)

## Critere de "done" V3 par lot

- backend build OK
- frontend build OK
- frontend type-check OK
- tests cibles du domaine OK
- documentation mise a jour:
  - `docs/operations/TASK_LOG.md`
  - module doc concerne
- verification production apres release:
  - `GET /api/v1/health/live`
  - `docker compose ... ps`
  - smoke login admin

## Hors perimetre immediat

- refonte mobile complete
- chantier paiement massif
- changement routeur MikroTik prod sans plan rollback documente

## Decision de demarrage

Demarrage recommande: **Lot A (permissions metier end-to-end)**.
Raison: impact direct securite + delegation, faible risque infra, valeur immediate terrain.
