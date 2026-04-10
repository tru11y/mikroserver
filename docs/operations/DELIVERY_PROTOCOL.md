# Protocole de Livraison et Verification

Date de reference: 2026-03-15

## Objectif

Ce document fixe la regle de travail a suivre avant toute livraison SaaS MikroServer.

La regle est simple:

- ne pas livrer un changement non verifie
- ne pas pousser un hotfix sans identifier la cause reelle
- mettre a jour la documentation apres chaque tache terminee

## Regle obligatoire avant livraison

Chaque tache doit passer par ces 4 etapes:

1. implementation
2. verification locale
3. note de livraison
4. mise a jour de la documentation

Une tache n'est pas consideree comme terminee tant que les etapes 2, 3 et 4 ne sont pas faites.

## Verification minimale obligatoire

### Backend

- executer les tests cibles lies au domaine touche
- executer `npm run build`
- verifier les routes critiques si le changement touche des DTO, permissions, IDs, suppression ou export

### Frontend

- executer `npm run build`
- executer `npm run type-check` si des pages, hooks, params ou composants ont change
- verifier les flux visuels critiques si la tache touche:
  - navigation
  - pages `[id]`
  - modals de confirmation
  - suppression
  - exports

### Production

Avant tout redeploiement:

- sauvegarder l'application
- ne jamais ecraser `infrastructure/docker/.env.prod`
- verifier que l'archive de deploiement n'embarque ni secrets, ni `node_modules`, ni `.next`, ni `dist`

Apres deploiement:

- verifier `GET /api/v1/health/live`
- verifier le `docker compose ps`
- verifier au moins la ou les pages directement touchees

## Cas ou la verification doit etre renforcee

Verification renforcee obligatoire si la tache touche:

- les IDs et params d'URL
- la suppression de tickets, sessions ou routeurs
- les permissions
- les tickets legacy
- les routeurs et actions MikroTik
- les PDF et exports
- les healthchecks et le deploiement

Dans ces cas, il faut ajouter au moins:

- un test backend cible ou un test supplementaire
- une recette fonctionnelle explicite

## Mise a jour documentation obligatoire

Apres chaque tache terminee, mettre a jour au minimum:

- `docs/operations/TASK_LOG.md`

Et selon le type de changement:

- `docs/operations/SITE_MAINTENANCE.md` si impact exploitation/deploiement
- `docs/audit/CURRENT_STATE_2026-03-14.md` si le changement modifie l'etat reel du produit ou un risque majeur
- `docs/roadmap/V1_2_MARKET_GAPS.md` si le changement avance ou deplace une priorite roadmap

## Format standard d'une entree de tache

Chaque entree de journal doit indiquer:

- date
- tache
- statut
- fichiers principaux
- verification faite
- deploiement ou non
- risques/reserves restants

## Regles produit sensibles

- `Couper` une session ne vaut jamais `Supprimer`
- toute `Suppression definitive` doit demander confirmation
- un ticket deja utilise peut etre retire du routeur, mais son historique SaaS doit etre conserve si necessaire
- les changements SaaS ne doivent pas etre presentes comme des changements routeur si le MikroTik n'a pas ete modifie directement

## Regle de communication

Toute livraison doit dire clairement:

- ce qui a ete change
- ce qui a ete verifie
- ce qui n'a pas encore ete verifie
- si la prod a ete touchee ou non
- si le routeur prod ou la page hotspot locale ont ete modifies ou non
