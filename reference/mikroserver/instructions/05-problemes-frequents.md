# 🔧 Problèmes fréquents et solutions

---

## ❌ "Cannot connect to the Docker daemon"

**Cause :** Docker Desktop n'est pas ouvert.

**Solution :**
1. Ouvre Docker Desktop depuis le menu Démarrer
2. Attends que la baleine 🐋 soit verte dans la barre des tâches
3. Réessaie la commande

---

## ❌ "Port 5432 already in use" ou "address already allocated"

**Cause :** PostgreSQL tourne déjà sur ton PC.

**Solution :**
```powershell
docker compose -f infrastructure/docker/docker-compose.dev.yml down
docker compose -f infrastructure/docker/docker-compose.dev.yml up -d
```

---

## ❌ "Cannot find module '@nestjs/core'" ou "Cannot find module 'prisma'"

**Cause :** `npm install` n'a pas été fait.

**Solution :**
```powershell
cd "C:\Users\PC\OneDrive - Epitech\amy\PROJETS-TERMINES\mikroserver\backend"
npm install
```

---

## ❌ "prisma: command not found" ou "'prisma' n'est pas reconnu"

**Solution :**
```powershell
cd "C:\Users\PC\OneDrive - Epitech\amy\PROJETS-TERMINES\mikroserver\backend"
npx prisma generate
```

---

## ❌ "tsx: command not found" pour le seed

**Solution :**
```powershell
cd "C:\Users\PC\OneDrive - Epitech\amy\PROJETS-TERMINES\mikroserver\backend"
npx tsx prisma/seed.ts
```

Si ça ne marche pas :
```powershell
npm install tsx --save-dev
npx tsx prisma/seed.ts
```

---

## ❌ "nest: command not found" quand tu fais `npm run start:dev`

**Cause :** `npm install` pas fait ou `@nestjs/cli` manquant.

**Solution :**
```powershell
cd "C:\Users\PC\OneDrive - Epitech\amy\PROJETS-TERMINES\mikroserver\backend"
npm install
npm run start:dev
```

---

## ❌ La page `http://localhost:3001` ne s'ouvre pas

**Cause :** Le frontend n'est pas démarré.

**Solution :** Ouvre une 2ème fenêtre PowerShell et tape :
```powershell
cd "C:\Users\PC\OneDrive - Epitech\amy\PROJETS-TERMINES\mikroserver\frontend"
npm run dev
```

---

## ❌ Erreur de base de données "P1001: Can't reach database"

**Cause :** PostgreSQL n'est pas démarré.

**Solution :**
```powershell
cd "C:\Users\PC\OneDrive - Epitech\amy\PROJETS-TERMINES\mikroserver"
docker compose -f infrastructure/docker/docker-compose.dev.yml up -d
```

---

## ❌ "Environment variable not found: JWT_ACCESS_SECRET"

**Cause :** Le fichier `.env` n'existe pas.

**Vérifie :**
```powershell
ls "C:\Users\PC\OneDrive - Epitech\amy\PROJETS-TERMINES\mikroserver\backend\.env"
```

Si le fichier n'existe pas, copie `.env.example` :
```powershell
cd "C:\Users\PC\OneDrive - Epitech\amy\PROJETS-TERMINES\mikroserver\backend"
copy .env.example .env
```

---

## 💬 Aucune de ces solutions ne marche ?

Copie le message d'erreur exact et envoie-le à Claude pour obtenir de l'aide.
