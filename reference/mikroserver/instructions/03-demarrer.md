# 🚀 ÉTAPE 3 — Démarrer le projet (chaque fois)

> Ces commandes sont à taper **à chaque fois** que tu veux tester.
> Tu auras besoin de **2 fenêtres PowerShell ouvertes en même temps**.

---

## 📌 AVANT DE COMMENCER

Assure-toi que **Docker Desktop est ouvert** 🐋

---

## FENÊTRE POWERSHELL N°1 — Démarrer la base de données

### Commande 1

```powershell
cd "C:\Users\PC\OneDrive - Epitech\amy\PROJETS-TERMINES\mikroserver"
```

### Commande 2

```powershell
docker compose -f infrastructure/docker/docker-compose.dev.yml up -d
```

✅ Résultat attendu :
```
✓ Container mikroserver-postgres-1  Running
✓ Container mikroserver-redis-1     Running
```

### Commande 3 — Démarrer l'API

```powershell
cd "C:\Users\PC\OneDrive - Epitech\amy\PROJETS-TERMINES\mikroserver\backend"
```

```powershell
npm run start:dev
```

✅ Attends ce message (environ 15 secondes) :
```
[Nest] LOG  MikroServer API listening on port 3000
```

> ⚠️ **Laisse cette fenêtre ouverte** — ne la ferme pas !

---

## FENÊTRE POWERSHELL N°2 — Démarrer le tableau de bord

Ouvre **une nouvelle fenêtre PowerShell** (appuie sur `Windows + X` → Terminal)

### Commande 1

```powershell
cd "C:\Users\PC\OneDrive - Epitech\amy\PROJETS-TERMINES\mikroserver\frontend"
```

### Commande 2

```powershell
npm run dev
```

✅ Attends ce message :
```
▲ Next.js 14
- Local: http://localhost:3001
✓ Ready
```

> ⚠️ **Laisse cette fenêtre ouverte aussi** — ne la ferme pas !

---

## 🌐 Ouvrir dans le navigateur

Une fois les 2 fenêtres prêtes, ouvre Chrome ou Firefox et va sur :

| Quoi | Adresse à taper dans le navigateur |
|------|-------------------------------------|
| 🖥️ Tableau de bord | `http://localhost:3001` |
| 📖 Documentation API | `http://localhost:3000/docs` |
| 🗄️ Voir la base de données | `http://localhost:5050` |

---

## 🔐 Connexion au tableau de bord

- **Email :** `admin@mikroserver.ci`
- **Mot de passe :** `ChangeMe123!@#`

---

## ⛔ Pour tout arrêter

Dans une 3ème fenêtre PowerShell :

```powershell
cd "C:\Users\PC\OneDrive - Epitech\amy\PROJETS-TERMINES\mikroserver"
```

```powershell
docker compose -f infrastructure/docker/docker-compose.dev.yml down
```

Et ferme les 2 autres fenêtres avec `Ctrl + C` puis ferme la fenêtre.

---

## → Passe maintenant au fichier `04-tester.md`
