# MikroServer — Déploiement CI/CD

## Architecture

```
Push → main
  └── CI (ci.yml)
        ├── secret-scan (gitleaks — full history)
        ├── backend: lint + type-check + tests (postgres:16 + redis:7 services)
        ├── frontend: lint + type-check + build (NEXT_PUBLIC_VAPID_PUBLIC_KEY baked)
        ├── docker-security: Trivy scan (HIGH/CRITICAL → exit 1)
        └── build-push: push GHCR (GITHUB_TOKEN, packages:write)
              → ghcr.io/<repo>/api:<sha7> + :latest
              → ghcr.io/<repo>/migrations:<sha7> + :latest
              → ghcr.io/<repo>/dashboard:<sha7> + :latest
                    └── CD (cd.yml) — déclenché par CI success sur main uniquement
                          ├── SSH VPS (appleboy/ssh-action)
                          ├── docker login ghcr.io (GHCR_TOKEN via envs)
                          ├── docker compose pull api dashboard db-migrate
                          ├── docker compose run --rm db-migrate
                          ├── docker compose up -d --no-deps api dashboard
                          ├── health check : docker inspect {{.State.Health.Status}} × 24
                          └── rollback automatique si unhealthy (IMAGE_TAG précédent)
```

**Garanties :**
- Le déploiement ne se déclenche jamais si CI échoue
- Les images sont buildées une seule fois en CI, jamais sur le VPS
- Port 3000 API jamais accessible depuis internet — uniquement `127.0.0.1:3000` sur le VPS

---

## Secrets GitHub à configurer

`Settings → Secrets and variables → Actions → New repository secret`

| Secret | Obligatoire | Description |
|--------|-------------|-------------|
| `SSH_HOST` | ✅ | IP ou hostname du VPS (`139.84.241.27`) |
| `SSH_USER` | ✅ | Utilisateur SSH (`deploy` recommandé, `root` possible pour MVP) |
| `SSH_PRIVATE_KEY` | ✅ | Clé privée ED25519 — générée sur machine locale, voir section SSH |
| `SSH_PORT` | ✅ | Port SSH (généralement `22`) |
| `GHCR_TOKEN` | ✅ | PAT GitHub `read:packages` uniquement — voir section GHCR |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | ⚠️ optionnel | Clé publique VAPID — nécessaire uniquement si push notifications activées |

---

## Préparation SSH — clé de déploiement

> **Générer la clé sur votre machine locale (admin), jamais sur le VPS.**
> La clé privée ne doit pas rester sur le VPS après configuration.

### Méthode recommandée (machine locale → VPS)

```bash
# 1. Sur votre machine locale — générer une paire de clés dédiée au déploiement
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/github_deploy -N ""
# Crée : ~/.ssh/github_deploy (privée) + ~/.ssh/github_deploy.pub (publique)

# 2. Copier la clé PUBLIQUE sur le VPS
ssh-copy-id -i ~/.ssh/github_deploy.pub deploy@<VPS_IP>
# Ou manuellement :
cat ~/.ssh/github_deploy.pub | ssh deploy@<VPS_IP> "cat >> ~/.ssh/authorized_keys"

# 3. Tester la connexion
ssh -i ~/.ssh/github_deploy deploy@<VPS_IP> "echo OK"

# 4. Copier la clé PRIVÉE dans GitHub Secret SSH_PRIVATE_KEY
cat ~/.ssh/github_deploy
# → Copier le contenu entier (BEGIN OPENSSH PRIVATE KEY...END OPENSSH PRIVATE KEY)
# → GitHub → Settings → Secrets → SSH_PRIVATE_KEY → Paste

# 5. La clé privée reste uniquement sur votre machine locale et dans GitHub Secrets
#    Ne pas laisser ~/.ssh/github_deploy sur le VPS
```

### Alternative MVP (générer sur le VPS — moins recommandé)

```bash
# Sur le VPS
ssh-keygen -t ed25519 -C "github-actions-deploy" -f /tmp/github_deploy -N ""
cat /tmp/github_deploy.pub >> ~/.ssh/authorized_keys
# Copier le contenu de /tmp/github_deploy dans GitHub Secret SSH_PRIVATE_KEY
cat /tmp/github_deploy
# Puis supprimer la clé privée du VPS :
rm /tmp/github_deploy
```

---

## Utilisateur deploy dédié (recommandé) vs root

> **Production : utiliser un utilisateur `deploy` au lieu de `root`.**
> Root reste acceptable pour un MVP rapide.

### Créer l'utilisateur deploy (sur le VPS en tant que root)

```bash
# 1. Créer l'utilisateur sans mot de passe interactif
adduser --disabled-password --gecos "" deploy

# 2. Ajouter au groupe docker (accès docker sans sudo)
usermod -aG docker deploy

# 3. Créer le répertoire SSH
mkdir -p /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
chown deploy:deploy /home/deploy/.ssh

# 4. Ajouter la clé publique de déploiement
echo "ssh-ed25519 AAAA... github-actions-deploy" >> /home/deploy/.ssh/authorized_keys
chmod 600 /home/deploy/.ssh/authorized_keys
chown deploy:deploy /home/deploy/.ssh/authorized_keys

# 5. Vérifier l'accès SSH depuis votre machine locale
ssh -i ~/.ssh/github_deploy deploy@<VPS_IP> "docker ps && echo 'docker OK'"

# 6. Cloner le repo en tant que deploy
su - deploy -c "git clone https://github.com/<owner>/mikroserver.git ~/mikroserver"

# 7. Créer .env.prod
su - deploy -c "cp ~/mikroserver/backend/.env.example ~/mikroserver/.env.prod && chmod 600 ~/mikroserver/.env.prod"
```

Mettre `SSH_USER = deploy` dans les secrets GitHub.

---

## GHCR_TOKEN — Pourquoi et comment

### Pourquoi deux tokens ?

| Token | Qui l'utilise | Où | Scope |
|-------|--------------|-----|-------|
| `GITHUB_TOKEN` (automatique) | GitHub Actions runner (CI) | `ci.yml → build-push` | `packages: write` — push vers GHCR |
| `GHCR_TOKEN` (PAT manuel) | Le VPS via SSH | `cd.yml`, `rollback.yml` | `read:packages` — pull depuis GHCR |

Le `GITHUB_TOKEN` est scoped au runner GitHub Actions. Il ne peut pas être partagé avec un VPS externe. Le VPS a besoin d'un PAT dédié pour s'authentifier.

### Créer le GHCR_TOKEN (PAT Fine-grained)

```
GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens
→ Generate new token
→ Resource owner : votre compte ou org
→ Repository access : uniquement ce repo (ou All repositories)
→ Permissions : Contents → Read-only, Packages → Read-only
→ Expiration : 1 an (à renouveler — noter la date)
→ Generate → Copier dans GitHub Secret GHCR_TOKEN
```

Le token est injecté via `envs: GHCR_TOKEN,...` dans l'action SSH et consommé via `--password-stdin` — il n'apparaît **jamais** dans les logs.

### Alternative : rendre les packages GHCR publics

Si le repo GitHub est public, les packages GHCR sont publics par défaut → `docker pull` sans auth → `GHCR_TOKEN` non nécessaire.

```
GitHub → Packages → [image] → Package settings → Change visibility → Public
```

Si packages publics : supprimer `GHCR_TOKEN` des secrets et retirer `docker login / docker logout` du cd.yml et rollback.yml.

### Tester le login GHCR depuis le VPS

```bash
# Sur le VPS — ne jamais écrire le token en clair dans l'historique shell
read -s GHCR_TOKEN_TEST
echo "$GHCR_TOKEN_TEST" | docker login ghcr.io -u <github_username> --password-stdin
docker pull ghcr.io/<owner>/mikroserver/api:latest
docker logout ghcr.io
unset GHCR_TOKEN_TEST
```

---

## NEXT_PUBLIC_VAPID_PUBLIC_KEY — Flux complet

### Comprendre le rôle

- **Frontend** (`src/hooks/use-push-notifications.ts`) : lit `process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY` — variable **baked au build** par Next.js. Si vide → push notifications silencieusement désactivées, l'app fonctionne normalement.
- **Backend** (`notifications.service.ts`) : lit `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_EMAIL` au **runtime** depuis `.env.prod`.
- Les deux clés sont générées ensemble par `infrastructure/scripts/setup_vapid.sh`.

### Flux de génération (à faire une seule fois)

```bash
# Sur le VPS — après le premier déploiement réussi (api container running)
cd ~/mikroserver
bash infrastructure/scripts/setup_vapid.sh
# → génère VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY dans .env.prod
# → relance api + dashboard localement (fallback pré-GHCR)
```

**Avec le flux CI/CD GHCR, les étapes correctes sont :**

```bash
# 1. Générer les clés (api container doit tourner)
bash infrastructure/scripts/setup_vapid.sh

# 2. Lire la clé publique générée dans .env.prod
grep NEXT_PUBLIC_VAPID_PUBLIC_KEY ~/mikroserver/.env.prod
# → NEXT_PUBLIC_VAPID_PUBLIC_KEY=BN...

# 3. Copier cette valeur dans GitHub Secret NEXT_PUBLIC_VAPID_PUBLIC_KEY

# 4. Push sur main → CI rebuild le dashboard image avec la clé baked → CD déploie
```

> `setup_vapid.sh` a un mode fallback local (`docker compose build dashboard`) qui est hors flux GHCR.
> Avec GHCR : toujours passer par GitHub Secret + push → CI rebuild.

### Si les push notifications ne sont pas utilisées

Laisser `NEXT_PUBLIC_VAPID_PUBLIC_KEY` vide dans GitHub Secrets. L'app fonctionne. Le hook loggue un warning dans la console navigateur uniquement.

---

## Préparer le VPS (première fois)

```bash
# Pré-requis sur le VPS
apt update && apt install -y docker.io git curl
systemctl enable --now docker

# En tant que deploy (ou root pour MVP)
git clone https://github.com/<owner>/mikroserver.git ~/mikroserver
cd ~/mikroserver

# .env.prod à la RACINE du repo — chemin exact attendu par CD et deploy_prod.sh
cp backend/.env.example .env.prod
chmod 600 .env.prod
nano .env.prod
# Remplir :
#   POSTGRES_PASSWORD  → openssl rand -hex 32
#   REDIS_PASSWORD     → openssl rand -hex 32
#   JWT_ACCESS_SECRET  → openssl rand -hex 64
#   JWT_REFRESH_SECRET → openssl rand -hex 64  (DIFFÉRENT du précédent)
#   ENCRYPTION_KEY     → openssl rand -hex 64
#   WAVE_API_KEY, WAVE_WEBHOOK_SECRET → depuis dashboard Wave CI
#   VPS_PUBLIC_IP      → 139.84.241.27

# TLS — certificat auto-signé pour démarrer (remplacer par Let's Encrypt ensuite)
mkdir -p infrastructure/nginx/ssl
openssl req -x509 -nodes -newkey rsa:2048 -days 365 \
  -subj "/CN=mikroserver.ci" \
  -keyout infrastructure/nginx/ssl/privkey.pem \
  -out infrastructure/nginx/ssl/fullchain.pem

# Démarrer l'infra de base avant le premier CD
docker compose -f infrastructure/docker/docker-compose.prod.yml --env-file .env.prod \
  up -d postgres redis nginx

# Vérifier
docker compose -f infrastructure/docker/docker-compose.prod.yml --env-file .env.prod ps
```

---

## Déclencher un déploiement

**Automatique** : tout push sur `main` déclenche CI puis CD si CI réussit.

**Manuel via GitHub CLI** :
```bash
gh workflow run cd.yml -f image_tag=a1b2c3d   # SHA 7 chars
# Ou avec latest :
gh workflow run cd.yml
```

---

## Rollback

**Automatique** : health check échec → CD revient au tag stocké dans `~/mikroserver/.image_tag`.

**Manuel via GitHub CLI** :
```bash
gh workflow run rollback.yml -f image_tag=a1b2c3d -f reason="regression paiement"
```

**Urgence (SSH direct)** :
```bash
ssh deploy@<VPS_IP>
cd ~/mikroserver
IMAGE_TAG=a1b2c3d \
  docker compose -f infrastructure/docker/docker-compose.prod.yml --env-file .env.prod \
  up -d --no-deps api dashboard
echo "a1b2c3d" > .image_tag
```

> Migrations Prisma : additive-only, pas de down migration. Un rollback de code après une migration de schema nécessite une vérification manuelle de compatibilité.

---

## Vérifier les logs

```bash
# Alias pratique — ajouter dans ~/.bashrc sur le VPS
alias ms='docker compose -f ~/mikroserver/infrastructure/docker/docker-compose.prod.yml --env-file ~/mikroserver/.env.prod'
# Usage : ms logs -f api | ms ps | ms exec api sh

# Health de l'API (port 3000 accessible uniquement depuis localhost VPS)
curl -sf http://127.0.0.1:3000/api/v1/health/ready | python3 -m json.tool

# Health status Docker du container API
docker inspect --format='{{.State.Health.Status}}' \
  $(docker compose -f ~/mikroserver/infrastructure/docker/docker-compose.prod.yml \
    --env-file ~/mikroserver/.env.prod ps -q api)

# Logs GitHub Actions
gh run list --workflow=cd.yml --limit=5
gh run view <run-id> --log
```

---

## Checklist avant premier push sur main

- [ ] Utilisateur `deploy` créé sur VPS, dans le groupe `docker`
- [ ] Clé SSH générée sur machine locale, clé publique dans `~/.ssh/authorized_keys` du VPS
- [ ] Clé privée SSH dans GitHub Secret `SSH_HOST`, `SSH_USER`, `SSH_PRIVATE_KEY`, `SSH_PORT`
- [ ] `GHCR_TOKEN` (PAT `read:packages`) dans GitHub Secrets
- [ ] GitHub Environment `production` créé (Settings → Environments)
- [ ] `.env.prod` présent sur VPS à `~/mikroserver/.env.prod`, `chmod 600`
- [ ] JWT secrets ≥ 64 chars hex, valeurs différentes
- [ ] TLS certs dans `infrastructure/nginx/ssl/` (auto-signés OK pour démarrer)
- [ ] Postgres + Redis up sur VPS (`ms ps`)
- [ ] Test SSH depuis GitHub : `gh workflow run cd.yml` → vérifier Actions tab
- [ ] `NEXT_PUBLIC_VAPID_PUBLIC_KEY` configuré si push notifications souhaitées

---

## Troubleshooting

### CI : "connection refused" sur tests backend
`postgres` service manque `ports: ["5432:5432"]` dans `ci.yml`. Déjà corrigé.

### CD : "container not found" / "unhealthy"
```bash
ms logs api --tail=50
# Chercher : ConfigValidationError, ECONNREFUSED, MODULE_NOT_FOUND
```
Cause probable : `.env.prod` manquant ou variable vide → Zod validation fail.

### GHCR : "unauthorized" / "pull access denied"
```bash
# Tester manuellement sur VPS
read -s T && echo "$T" | docker login ghcr.io -u <owner> --password-stdin && unset T
```
Cause : GHCR_TOKEN expiré ou scope insuffisant. Regénérer avec `read:packages`.

### Nginx 502 après déploiement
Dashboard démarre seulement quand API est `healthy` (`depends_on: service_healthy`).
`start_period: 60s` → attendre 90s avant de s'inquiéter.
```bash
ms ps   # chercher "(health: starting)"
```

### restore-iptables.sh échoue au boot
Vérifie que `api` est healthy et que `127.0.0.1:3000` répond :
```bash
curl -sf http://127.0.0.1:3000/api/v1/health/live
systemctl status hotspotflow-iptables.service
```
Port 3000 est bindé sur `127.0.0.1` uniquement dans `docker-compose.prod.yml` — jamais public.
