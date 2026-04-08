# 🧪 ÉTAPE 4 — Tester que tout fonctionne

> Ces tests confirment que le MVP marche correctement.
> L'API doit être démarrée (voir `03-demarrer.md`)

---

## TEST 1 — Vérifier que l'API répond

Ouvre PowerShell et tape :

```powershell
curl http://localhost:3000/api/v1/health/live
```

✅ Résultat attendu :
```json
{"success":true,"data":{"status":"alive"}}
```

---

## TEST 2 — Se connecter en tant qu'admin

```powershell
curl -X POST http://localhost:3000/api/v1/auth/login `
  -H "Content-Type: application/json" `
  -d '{"email":"admin@mikroserver.ci","password":"ChangeMe123!@#"}'
```

✅ Résultat attendu :
```json
{
  "success": true,
  "data": {
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    },
    "user": {
      "email": "admin@mikroserver.ci",
      "role": "SUPER_ADMIN"
    }
  }
}
```

📋 **Copie le `accessToken`** — tu en auras besoin pour les tests suivants.

---

## TEST 3 — Voir les forfaits WiFi

Remplace `TON_TOKEN_ICI` par le token copié au test 2 :

```powershell
curl http://localhost:3000/api/v1/plans `
  -H "Authorization: Bearer TON_TOKEN_ICI"
```

✅ Résultat attendu : liste des 5 forfaits (200 FCFA, 300 FCFA, etc.)

---

## TEST 4 — Voir le tableau de bord dans le navigateur

Va sur : `http://localhost:3001`

Tu dois voir la page de connexion MikroServer.

Connecte-toi avec :
- Email : `admin@mikroserver.ci`
- Mot de passe : `ChangeMe123!@#`

✅ Tu dois voir le tableau de bord avec les KPIs (revenus, routeurs, etc.)

---

## TEST 5 — Documentation API interactive

Va sur : `http://localhost:3000/docs`

Tu dois voir la documentation Swagger avec toutes les routes de l'API.
Tu peux tester les routes directement depuis cette page.

---

## TEST 6 — Simuler un paiement (sans Wave)

```powershell
curl -X POST http://localhost:3000/api/v1/transactions/initiate `
  -H "Content-Type: application/json" `
  -d '{"planId":"REMPLACE_PAR_UN_ID_DE_FORFAIT","customerPhone":"+22507000000"}'
```

Pour trouver un `planId`, utilise d'abord le TEST 3 et copie l'`id` d'un forfait.

---

## ✅ Si tous les tests passent → ton MVP fonctionne !

---

## ❓ Problèmes courants

| Erreur | Solution |
|--------|----------|
| `ECONNREFUSED` sur le port 3000 | L'API n'est pas démarrée — reprends `03-demarrer.md` |
| `invalid credentials` | Vérifie email et mot de passe |
| `Cannot find module` | Refais `npm install` dans le dossier backend |
| Page blanche sur localhost:3001 | Attends encore 30 secondes que Next.js compile |
| Token expiré | Refais le TEST 2 pour obtenir un nouveau token |
