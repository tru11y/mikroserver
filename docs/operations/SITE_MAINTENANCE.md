# Maintenance et Exploitation du Site

## Objectif

Ce document sert de base de maintien du SaaS MikroServer en production.

Il couvre:

- verification quotidienne
- deploiement
- sauvegardes
- incidents connus
- hygiene des secrets et de la configuration

## Verifications quotidiennes

### API

- verifier `GET /api/v1/health/live`
- verifier que `docker-api-*` est `healthy`
- verifier les logs `api` pour:
  - erreurs Prisma
  - erreurs Redis
  - erreurs RouterOS
  - erreurs de configuration env

### Dashboard

- verifier que `/login` et `/dashboard` chargent
- verifier les pages critiques:
  - tickets
  - plans
  - routeurs
  - verification tickets

### Routeurs

- verifier `health-check`
- verifier `live-stats`
- verifier les tickets legacy critiques si necessaire

## Checklist avant deploiement

- sauvegarder `/root/mikroserver`
- verifier `infrastructure/docker/.env.prod`
- ne pas changer les secrets `POSTGRES_PASSWORD` et `REDIS_PASSWORD` sans migration volontaire
- verifier `WAVE_WEBHOOK_SECRET` si la validation backend l'exige
- rebuild `api` et `dashboard`
- verifier `health/live`
- tester login admin
- tester au moins un flux ticket

## Procedure canonique de deploiement VPS

Cette procedure est la reference pour eviter les derive entre le code local et le code VPS.

Important:

- executer ces commandes dans le shell du VPS (`root@...`), pas dans PowerShell local
- `127.0.0.1` doit etre teste depuis le VPS, pas depuis Windows

Commandes:

```bash
cd /root/mikroserver
chmod +x infrastructure/scripts/vps_release.sh
ADMIN_EMAIL='admin@mikroserver.com' \
ADMIN_PASSWORD='CHANGER_MOI_IMMEDIATEMENT' \
bash infrastructure/scripts/vps_release.sh
```

Ce script:

- repare automatiquement le cas `/root/mikroserver` sans `.git`
- aligne le code sur `origin/main`
- rebuild `api` + `dashboard`
- lance les migrations si `db-migrate` existe
- genere un certificat auto-signe de secours si `fullchain.pem`/`privkey.pem` sont absents
- demarre en sequence `api` puis `dashboard`, et `nginx` ensuite
- en cas d'echec API/dashboard, affiche automatiquement les logs du service en erreur
- inclut un nettoyage Docker non destructif si disque faible (containers/images/cache build inutilises)
- verifie `health/live` et `/login`
- confirme que les routes `users/:id/profile` et `users/:id/password` sont presentes
- effectue un smoke test login admin si les variables `ADMIN_EMAIL` et `ADMIN_PASSWORD` sont fournies

Variables utiles:

- `FULL_REBUILD=true` pour forcer un rebuild sans cache
- `MIN_FREE_MB=3000` pour ajuster le seuil de nettoyage disque automatique

Compatibilite:

- la phase migration utilise `docker compose run --rm db-migrate` sans flag additionnel pour rester compatible avec les versions Compose plus anciennes sur VPS

## Checklist apres deploiement

- `curl http://127.0.0.1:3000/api/v1/health/live`
- `docker compose ... ps`
- verification manuelle:
  - login
  - liste tickets
  - verification ticket
  - PDF ticket
  - routeur detail
- mettre a jour `docs/operations/TASK_LOG.md`

## Regle de livraison

- toute tache doit suivre `docs/operations/DELIVERY_PROTOCOL.md`
- ne jamais pousser une archive contenant `.env.prod`
- ne jamais declarer un lot "pret" sans verification reelle du backend et du frontend touches

## Sauvegardes

Minimum recommande:

- archive applicative avant chaque deploiement
- dump PostgreSQL regulier
- copie securisee de `.env.prod`

## Incidents connus et lecons

### 1. Derive entre `.env.prod` et les conteneurs existants

Incident observe:

- les mots de passe PostgreSQL et Redis du fichier `.env.prod` ne correspondaient plus aux conteneurs deja en production

Bonne pratique:

- ne jamais "redeviner" les secrets prod
- lors d'un incident, realigner `.env.prod` sur les secrets reels des conteneurs ou refaire un redeploiement complet maitrise

### 2. Validation Wave trop stricte pour le demarrage global

Incident observe:

- `WAVE_WEBHOOK_SECRET` trop court a empeche l'API de demarrer

Bonne pratique:

- garder un secret Wave valide meme si le paiement n'est pas le focus
- a moyen terme, rendre la partie paiement plus decouplee si desactivee

### 3. Dashboard parfois `unhealthy`

Observation:

- le dashboard peut rester `unhealthy` alors que les pages principales repondent

Action recommandee:

- verifier que le serveur Next est bien lance avec `HOSTNAME=0.0.0.0` au niveau de la commande finale
- ne pas compter sur la variable Docker `HOSTNAME` definie dans `compose`, car elle est reservee par le runtime
- tester aussi `GET /proxy/api/v1/health/live`, pas seulement `/login`

## Commandes utiles

### Etat compose

```bash
docker compose -f infrastructure/docker/docker-compose.prod.yml --env-file infrastructure/docker/.env.prod ps
```

### Logs API

```bash
docker compose -f infrastructure/docker/docker-compose.prod.yml --env-file infrastructure/docker/.env.prod logs api --tail 200
```

### Health API

```bash
curl http://127.0.0.1:3000/api/v1/health/live
```

### Reset admin

```bash
docker compose -f infrastructure/docker/docker-compose.prod.yml --env-file infrastructure/docker/.env.prod exec api node prisma/recover_admin.js
```

### Lister les admins

```bash
docker compose -f infrastructure/docker/docker-compose.prod.yml --env-file infrastructure/docker/.env.prod exec api node prisma/recover_admin.js --list
```

### Reset admin avec email ou mot de passe specifiques

```bash
docker compose -f infrastructure/docker/docker-compose.prod.yml --env-file infrastructure/docker/.env.prod exec \
  -e ADMIN_RECOVERY_EMAIL=admin@mikroserver.com \
  -e ADMIN_RECOVERY_PASSWORD='12345678' \
  api node prisma/recover_admin.js
```

Notes:

- la commande normalise l'email en minuscules
- elle reactive le compte, le deverrouille et revoque les refresh tokens actifs
- la commande par defaut recree ou reinitialise `admin@mikroserver.com`
- `seed.ts` et `recover_admin.js` partagent desormais la meme source de verite via `backend/prisma/admin-bootstrap.config.cjs`
- si tu veux changer l'admin bootstrap canonique, surcharge:
  - `DEFAULT_SUPER_ADMIN_EMAIL`
  - `DEFAULT_SUPER_ADMIN_PASSWORD`
  - ou les variables `SEED_*` / `ADMIN_RECOVERY_*`

## Priorites de maintien

### Securite

- durcir la gestion des cookies admin
- reduire les secrets stockes en clair
- tracer les acces admin sensibles

### Exploitation

- clarifier healthchecks
- ajouter alertes email ou Telegram
- documenter les incidents dans ce fichier

### Produit

- tout nouveau flux critique doit avoir:
  - un smoke test minimal
  - une note de deploiement
  - une note de rollback
