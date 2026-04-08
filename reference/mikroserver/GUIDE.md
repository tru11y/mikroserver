# 📡 MikroServer — Guide Complet en Français

---

## C'est quoi ce projet ?

MikroServer est une **plateforme de gestion WiFi payant** pour les opérateurs de hotspot MikroTik en Côte d'Ivoire.

**Avant (l'ancien problème) :**
- Tu imprimais des vouchers papier manuellement
- Tu gérais les revendeurs à la main
- C'était lent, coûteux, et difficile à contrôler

**Après (avec MikroServer) :**
1. Le client se connecte au WiFi
2. Il voit une page (portail captif) avec les forfaits
3. Il choisit son forfait et paie avec **Wave** (Mobile Money)
4. Le paiement est vérifié automatiquement
5. Un voucher est créé automatiquement
6. Le voucher est envoyé au routeur MikroTik automatiquement
7. Le client a Internet — **tout ça en moins de 30 secondes, sans toi !**

---

## 🗂️ Structure du projet

```
mikroserver/
│
├── backend/          ← L'API (NestJS) — le cerveau du système
│   ├── prisma/       ← La base de données (schéma + migrations)
│   └── src/
│       ├── modules/
│       │   ├── auth/           ← Connexion / sécurité
│       │   ├── plans/          ← Gestion des forfaits WiFi
│       │   ├── transactions/   ← Suivi des paiements
│       │   ├── payments/       ← Intégration Wave CI
│       │   ├── vouchers/       ← Création des vouchers
│       │   ├── routers/        ← Connexion aux routeurs MikroTik
│       │   ├── sessions/       ← Sessions actives des clients
│       │   ├── metrics/        ← Statistiques et revenus
│       │   ├── queue/          ← File d'attente (tâches automatiques)
│       │   ├── webhooks/       ← Réception des paiements Wave
│       │   └── health/         ← Vérification que tout fonctionne
│       └── common/             ← Sécurité globale, filtres, intercepteurs
│
├── frontend/         ← Le tableau de bord web (Next.js)
│   └── src/
│       ├── app/      ← Pages (dashboard, login)
│       └── components/
│           ├── dashboard/  ← KPI, routeurs, transactions
│           └── charts/     ← Graphiques de revenus
│
├── infrastructure/   ← Déploiement serveur
│   ├── docker/       ← Docker Compose (production)
│   ├── nginx/        ← Serveur web sécurisé
│   ├── scripts/      ← Script de déploiement automatique
│   └── wireguard/    ← Tunnel sécurisé vers les routeurs
│
└── docs/
    └── ARCHITECTURE.md  ← Explications techniques détaillées
```

---

## ✅ Ce que tu peux faire avec ce système

### 💰 Gestion des paiements
- Créer des forfaits WiFi (30 min, 1h, 3h, 24h, 7 jours…)
- Fixer le prix en **FCFA** pour chaque forfait
- Recevoir les paiements via **Wave Mobile Money** automatiquement
- Voir toutes les transactions en temps réel

### 🎟️ Vouchers automatiques
- Les vouchers sont créés **automatiquement** après chaque paiement
- Chaque voucher a un code unique et sécurisé (ex: `MS-A3K9-P2W8-XZ4V`)
- Le voucher est envoyé **directement** au routeur MikroTik sans intervention humaine

### 📡 Gestion des routeurs MikroTik
- Ajouter plusieurs routeurs (différents quartiers, différentes villes)
- Voir si chaque routeur est **en ligne ou hors ligne**
- Le système détecte automatiquement si un routeur tombe en panne

### 📊 Tableau de bord
- Voir les **revenus du jour / du mois / total**
- Voir le **nombre de clients uniques**
- Voir le **taux de succès** des paiements
- Graphiques de revenus sur 30 jours
- Liste des dernières transactions en temps réel

### 🔐 Sécurité
- Connexion sécurisée avec email et mot de passe
- Système de rôles : Super Admin, Admin, Lecteur seul
- Toutes les communications chiffrées (HTTPS + WireGuard)

---

## 🚀 Comment démarrer ?

### Étape 1 — Copier le fichier de configuration
```bash
cp backend/.env.example backend/.env
```
Puis ouvre `backend/.env` et remplis les informations :
- Ton mot de passe base de données
- Ta clé API Wave
- Tes secrets JWT (génère-les avec : `openssl rand -hex 64`)

### Étape 2 — Démarrer la base de données et Redis
```bash
docker compose -f infrastructure/docker/docker-compose.prod.yml up -d postgres redis
```

### Étape 3 — Préparer la base de données
```bash
npm run prisma:generate
npm run prisma:migrate
```

### Étape 4 — Créer le premier compte administrateur
```bash
SEED_ADMIN_EMAIL=toi@exemple.ci SEED_ADMIN_PASSWORD=TonMotDePasse123! npm run prisma:seed
```
⚠️ **Change le mot de passe immédiatement après !**

### Étape 5 — Démarrer l'API
```bash
npm run dev:api
```

### Étape 6 — Démarrer le tableau de bord web
```bash
npm run dev:web
```

### Étape 7 — Ouvrir dans le navigateur
- **Tableau de bord :** `http://localhost:3001`
- **Documentation API :** `http://localhost:3000/docs`

---

## 📋 Les forfaits par défaut (créés automatiquement)

| Forfait | Durée | Prix |
|---------|-------|------|
| 30 Minutes | 30 min | 200 FCFA |
| 1 Heure | 1h | 300 FCFA |
| 3 Heures | 3h | 700 FCFA |
| 24 Heures | 24h | 2 000 FCFA |
| 7 Jours | 7 jours | 10 000 FCFA |

Tu peux modifier ces forfaits directement dans le tableau de bord.

---

## 🌐 Pour mettre en production (sur ton VPS Ubuntu)

### 1. Configurer WireGuard (tunnel sécurisé vers MikroTik)
Lis le fichier : `infrastructure/wireguard/README.md`

### 2. Déployer avec Docker
```bash
chmod +x infrastructure/scripts/deploy.sh
./infrastructure/scripts/deploy.sh
```

### 3. Configurer Nginx + SSL
Installe Let's Encrypt pour avoir HTTPS gratuit :
```bash
certbot certonly --standalone -d api.mikroserver.ci -d dashboard.mikroserver.ci
```
Copie les certificats dans `infrastructure/nginx/ssl/`

---

## 🔧 Choses importantes à configurer

### Sur Wave (portail développeur Wave)
1. Crée un compte développeur Wave
2. Récupère ta clé API (`WAVE_API_KEY`)
3. Configure l'URL du webhook : `https://api.tondomaine.ci/api/v1/webhooks/wave`
4. Récupère le secret du webhook (`WAVE_WEBHOOK_SECRET`)

### Sur MikroTik (RouterOS)
1. Active l'API MikroTik : `IP → Services → API → activé`
2. Crée un utilisateur API avec les permissions `hotspot`
3. Configure le tunnel WireGuard (voir `infrastructure/wireguard/README.md`)

---

## ❓ Ce que tu peux me demander maintenant

Maintenant que le projet est créé, tu peux me demander :

- **"Explique-moi le fichier X"** — Je t'explique n'importe quel fichier
- **"Ajoute la fonctionnalité Y"** — J'ajoute ce que tu veux
- **"Comment déployer sur mon VPS ?"** — Je t'aide étape par étape
- **"Comment configurer Wave ?"** — Je t'explique la configuration
- **"Comment ajouter un routeur MikroTik ?"** — Je t'explique
- **"Crée l'application mobile"** — Je code l'app React Native
- **"Ajoute Orange Money"** — J'intègre un nouveau fournisseur de paiement
- **"Montre-moi comment tester l'API"** — Je t'explique avec des exemples concrets
- **"Le tableau de bord ne s'affiche pas"** — Je t'aide à déboguer

---

## ⚠️ Points d'attention importants

1. **Ne jamais mettre le fichier `.env` sur GitHub** — il contient tes secrets
2. **Changer le mot de passe admin par défaut** immédiatement après installation
3. **Sauvegarder la base de données** régulièrement (PostgreSQL)
4. **Le fichier `ARCHITECTURE.md`** dans le dossier `docs/` explique toutes les décisions techniques

---

*Fichier généré automatiquement par Claude — MikroServer v1.0.0*
