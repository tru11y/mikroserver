# Runbook MVP VPS + MikroTik

## Objectif

Tester le MVP `MikroServer` en conditions proches du réel, sans paiement.

Périmètre cible:
- connexion dashboard admin
- ajout d'un routeur MikroTik via WireGuard
- health check routeur
- création de forfaits
- création de revendeurs
- génération manuelle de tickets
- livraison des tickets sur MikroTik
- visualisation des clients connectés
- coupure de session
- révocation de ticket

## Pré-requis

- un VPS Ubuntu avec Docker et Docker Compose
- WireGuard fonctionnel entre le VPS et le MikroTik
- accès WinBox au MikroTik via l'IP VPN
- API RouterOS activée sur le MikroTik
- un utilisateur API MikroTik avec accès hotspot
- un domaine ou sous-domaine pour le dashboard si test web public

## Vérifications MikroTik

Sur le MikroTik:

1. Vérifier WireGuard:
```routeros
/interface/wireguard/print
/interface/wireguard/peers/print
/ip/address/print
```

2. Vérifier l'API:
```routeros
/ip/service/print
```

Le service `api` doit être activé sur `8728`.

3. Restreindre l'API au VPS:
```routeros
/ip/firewall/filter/add chain=input src-address=10.66.66.1 protocol=tcp dst-port=8728 action=accept comment="API from VPS"
/ip/firewall/filter/add chain=input protocol=tcp dst-port=8728 action=drop comment="Block public API"
```

4. Vérifier le hotspot:
```routeros
/ip/hotspot/print
/ip/hotspot/user/profile/print
```

Noter:
- le nom du serveur hotspot
- le nom du profil utilisateur hotspot

## Variables à préparer

Créer ou compléter:
- `backend/.env`
- `infrastructure/docker/.env.prod`

Pour le MVP sans paiement, remplir au minimum:

### Backend
- `NODE_ENV=production`
- `PORT=3000`
- `API_PREFIX=api/v1`
- `CORS_ORIGINS=https://dashboard.ton-domaine.tld,http://IP_VPS:3001`
- `DATABASE_URL=...`
- `REDIS_HOST=redis`
- `REDIS_PORT=6379`
- `REDIS_PASSWORD=...`
- `JWT_ACCESS_SECRET=...`
- `JWT_REFRESH_SECRET=...`
- `MIKROTIK_VOUCHER_PREFIX=MS`
- `MIKROTIK_DEFAULT_PROFILE=default`

### Docker prod
- `POSTGRES_DB=mikroserver`
- `POSTGRES_USER=mikroserver`
- `POSTGRES_PASSWORD=...`
- `REDIS_PASSWORD=...`
- `JWT_ACCESS_SECRET=...`
- `JWT_REFRESH_SECRET=...`
- `API_URL=https://api.ton-domaine.tld`

Les variables Wave peuvent rester factices si le paiement n'est pas testé, mais l'app ne doit pas recevoir de vrai trafic Wave.

## Déploiement VPS

Depuis le dossier `infrastructure`:

```bash
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

Si besoin de premier démarrage manuel:

```bash
docker compose -f docker/docker-compose.prod.yml --env-file docker/.env.prod up -d postgres redis
docker compose -f docker/docker-compose.prod.yml --env-file docker/.env.prod run --rm db-migrate
docker compose -f docker/docker-compose.prod.yml --env-file docker/.env.prod up -d
```

## Contrôles après déploiement

### API

```bash
curl http://127.0.0.1:3000/api/v1/health/live
curl http://127.0.0.1:3000/api/v1/health
```

### Dashboard

Ouvrir:
- `http://IP_VPS:3001`
- ou le domaine du dashboard derrière Nginx

### Logs

```bash
docker compose -f infrastructure/docker/docker-compose.prod.yml --env-file infrastructure/docker/.env.prod logs -f api
docker compose -f infrastructure/docker/docker-compose.prod.yml --env-file infrastructure/docker/.env.prod logs -f dashboard
```

## Seed admin

Créer un compte admin si nécessaire:

```bash
cd backend
$env:SEED_ADMIN_EMAIL="admin@ton-domaine.tld"
$env:SEED_ADMIN_PASSWORD="MotDePasseFort123!"
npm run prisma:seed
```

## Plan de test fonctionnel

### 1. Connexion dashboard

- se connecter avec le compte admin
- vérifier accès aux pages `Routeurs`, `Forfaits`, `Revendeurs`, `Vouchers`, `Sessions`, `Analytics`

### 2. Ajout du routeur

Dans `Routeurs`:
- nom: libre
- IP WireGuard: ex `10.66.66.2`
- utilisateur API: utilisateur MikroTik
- mot de passe API: mot de passe MikroTik
- profil hotspot: profil RouterOS réel
- serveur hotspot: serveur hotspot réel

Puis:
- lancer `Ping`/`Health check`
- vérifier que le routeur passe `ONLINE`

### 3. Création des forfaits

Créer au moins:
- 30 min
- 1 h
- 1 jour

Vérifier:
- prix
- durée
- profil hotspot
- débit
- quota éventuel

### 4. Création d'un revendeur

Créer un compte revendeur.

Vérifier:
- connexion possible
- accès aux écrans tickets
- impossibilité d'accéder aux réglages super admin

### 5. Génération manuelle de tickets

Depuis `Générer des tickets`:
- choisir un forfait
- choisir le routeur
- générer 3 à 5 tickets

Vérifier dans `Vouchers`:
- statut `GENERATED` puis `DELIVERED`
- nom du routeur correct
- absence d'erreur de livraison

### 6. Vérification MikroTik

Sur le routeur:
```routeros
/ip/hotspot/user/print
```

Contrôler que les utilisateurs générés existent bien.

### 7. Test client réel

Depuis un téléphone ou un PC connecté au hotspot:
- entrer un ticket généré
- vérifier l'accès Internet

Puis contrôler dans le dashboard:
- client visible dans `Sessions`
- client visible dans le détail du routeur

### 8. Coupure de session

Depuis:
- la page `Sessions`, ou
- la page détail routeur

Cliquer sur `Couper`.

Vérifier:
- disparition de la session active
- coupure réelle côté client

### 9. Révocation de ticket

Depuis `Vouchers`:
- cliquer `Révoquer`

Vérifier:
- suppression côté MikroTik
- impossibilité de réutiliser le ticket

### 10. Export PDF

Depuis `Vouchers`:
- sélectionner plusieurs tickets
- exporter PDF

Vérifier:
- code
- mot de passe
- forfait
- lisibilité à l'impression

## Critères de validation MVP

Le MVP est prêt à être testé terrain si:
- le routeur passe online depuis le dashboard
- les tickets se livrent bien dans MikroTik
- un client peut se connecter avec un ticket
- les sessions live remontent
- la coupure de session fonctionne
- la révocation de ticket fonctionne
- les revendeurs peuvent générer des tickets sans casser la prod

## Problèmes bloquants typiques

### Routeur toujours offline

Vérifier:
- ping VPS -> `10.66.66.x`
- firewall MikroTik
- service API activé
- identifiants API

### Ticket en `DELIVERY_FAILED`

Causes fréquentes:
- mauvais `hotspotServer`
- mauvais `userProfile`
- API inaccessible
- identifiants faux

Action:
- lire l'erreur dans la page `Vouchers`
- corriger le routeur
- cliquer `Relivrer`

### Session non visible

Vérifier:
- client bien connecté sur le bon routeur
- hotspot actif sur RouterOS
- accès API en lecture

## Hors périmètre actuel

Pas encore requis pour ce run:
- paiement Wave réel
- portail captif public
- application mobile
- multi-tenant SaaS complet
