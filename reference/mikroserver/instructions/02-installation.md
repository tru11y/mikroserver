# 🛠️ ÉTAPE 2 — Installation (une seule fois)

> ⚠️ Ces commandes se tapent **une seule fois**.
> La prochaine fois, va directement au fichier `03-demarrer.md`

---

## 📌 AVANT DE COMMENCER

Assure-toi que **Docker Desktop est ouvert** et que la baleine est verte 🐋

---

## Commande 1 — Aller dans le dossier du projet

Copie-colle exactement dans PowerShell :

```powershell
cd "C:\Users\PC\OneDrive - Epitech\amy\PROJETS-TERMINES\mikroserver"
```

---

## Commande 2 — Démarrer la base de données et Redis

```powershell
docker compose -f infrastructure/docker/docker-compose.dev.yml up -d
```

✅ Résultat attendu :
```
✓ Container mikroserver-postgres-1  Started
✓ Container mikroserver-redis-1     Started
✓ Container mikroserver-pgadmin-1   Started
```

Attends **10 secondes** avant de continuer.

---

## Commande 3 — Aller dans le dossier backend

```powershell
cd "C:\Users\PC\OneDrive - Epitech\amy\PROJETS-TERMINES\mikroserver\backend"
```

---

## Commande 4 — Installer les dépendances backend

```powershell
npm install
```

✅ Résultat attendu : beaucoup de texte, puis `added XXXX packages`
⏱️ Attends 2-3 minutes

---

## Commande 5 — Générer le client Prisma (base de données)

```powershell
npx prisma generate
```

✅ Résultat attendu : `✔ Generated Prisma Client`

---

## Commande 6 — Créer les tables dans la base de données

```powershell
npx prisma migrate dev --name init
```

✅ Résultat attendu :
```
Applying migration `20240101000000_init`
Your database is now in sync with your schema.
```

---

## Commande 7 — Créer le compte admin et les forfaits par défaut

```powershell
npx tsx prisma/seed.ts
```

✅ Résultat attendu :
```
✓ Super admin created: admin@mikroserver.ci
✓ Plan: 30 Minutes (200 FCFA)
✓ Plan: 1 Heure (300 FCFA)
✓ Plan: 3 Heures (700 FCFA)
✓ Plan: 24 Heures (2000 FCFA)
✓ Plan: 7 Jours (10000 FCFA)
Seed complete!
```

---

## Commande 8 — Aller dans le dossier frontend

```powershell
cd "C:\Users\PC\OneDrive - Epitech\amy\PROJETS-TERMINES\mikroserver\frontend"
```

---

## Commande 9 — Installer les dépendances frontend

```powershell
npm install
```

✅ Résultat attendu : `added XXXX packages`
⏱️ Attends 2-3 minutes

---

## ✅ Installation terminée !

Tes identifiants admin :
- **Email :** `admin@mikroserver.ci`
- **Mot de passe :** `ChangeMe123!@#`

---

## → Passe maintenant au fichier `03-demarrer.md`
