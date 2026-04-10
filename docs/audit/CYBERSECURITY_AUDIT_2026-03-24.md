# Audit Cybersécurité Sans Complaisance

Date: 2026-03-24

## Verdict

Etat reel actuel: fonctionnel, mais pas encore durci au niveau attendu pour une plateforme d'exploitation routeur + authentification admin.

Score securite actuel: 4.5/10

Conclusion brute:

- le produit n'est pas "ouvert" au sens catastrophique
- mais il reste plusieurs failles structurelles serieuses
- une compromission front ou base de donnees aurait aujourd hui un impact trop large

## Findings critiques

### P0 - Secrets routeur stockes en clair en base

Constat:

- le champ Prisma `Router.apiPasswordHash` contient en pratique le mot de passe RouterOS brut
- le nom du champ laisse croire a un hash, mais le code l ecrit et le relit comme un secret reversible

Preuves code:

- `backend/prisma/schema.prisma`
- `backend/src/modules/routers/routers.service.ts`
- `backend/src/modules/routers/router-api.service.ts`

Impact:

- si la base est compromise, l attaquant recupere l acces API aux routeurs
- impact possible: lecture, coupure sessions, modification hotspot, sabotage config

Verdict:

- c est un vrai sujet P0

Correction recommande:

- chiffrer les secrets routeur au repos
- sortir la cle de chiffrement de la base
- prevoir rotation et re-enregistrement des credentials

### P0 - Tokens d authentification lisibles par JavaScript

Constat:

- `access_token` et `refresh_token` sont geres via `js-cookie`
- ils ne sont donc pas `HttpOnly`

Preuves code:

- `frontend/src/lib/api/client.ts`

Impact:

- la moindre XSS front permet le vol de session
- un token de refresh vole vaut takeover complet de compte

Verdict:

- c est une faiblesse structurelle majeure

Correction recommande:

- passer aux cookies `HttpOnly` poses par le backend
- durcir CSP et hygiene HTML pour reduire la surface XSS

## Findings eleves

### P1 - Throttling login non actif

Constat:

- le commentaire de throttling est present, mais la protection n est pas active sur `POST /auth/login`

Preuves code:

- `backend/src/modules/auth/auth.controller.ts`

Impact:

- le lock applicatif par utilisateur aide un peu
- mais il ne remplace pas un vrai rate limiting IP / route / fingerprint

### P1 - 2FA de connexion non livree

Constat:

- le schema utilisateur expose `twoFactorSecret` et `twoFactorEnabledAt`
- le flow de login n applique pourtant aucun second facteur

Preuves code:

- `backend/prisma/schema.prisma`
- `backend/src/modules/auth/auth.service.ts`

Impact:

- la promesse "double auth" n est pas tenue au login
- un mot de passe vole suffit

### P1 - Reset password peut repondre succes sans email reellement envoye

Constat:

- si le provider email n est pas configure, le backend loggue un warning puis retourne une reponse generique

Preuves code:

- `backend/src/modules/auth/auth.service.ts`

Impact:

- produit trompeur pour l exploitation
- support complique
- securite percue meilleure que la securite reelle

### P1 - Actions routeur sensibles sans step-up auth

Constat:

- hotspot manage, sync, health-check, suppression ticket routeur ne demandent ni re-auth ni second facteur

Impact:

- toute session admin/revendeur privilegiee compromise donne un levier operatoire fort

## Findings moyens

### P2 - La page detail routeur concentre trop d operations sensibles

Constat:

- une seule page concentre sync, health-check, suppression ticket, gestion profils, IP bindings, sessions

Impact:

- erreur operateur favorisee
- review securite UI plus difficile

### P2 - Signalement de conformite forfait encore dependant du mapping SaaS

Constat:

- la plateforme sait calculer `firstConnectionAt`, `elapsedSinceFirstConnectionMinutes`, `voucherExpiresAt` et l etat d expiration uniquement pour les clients relies a un voucher SaaS connu

Impact:

- si un client actif reste "non gere", la plateforme ne peut pas garantir l ejection automatique
- ce n est pas un bug d affichage: c est une limite de la source de verite

## Protections deja presentes

- permissions metier par profil et permissions explicites
- rotation refresh token cote API
- lock utilisateur apres echecs login repetes
- reset password avec token + OTP
- audit log sur plusieurs actions critiques
- sync routeur coupe deja les sessions actives de vouchers expiress et marques en base

## Priorites obligatoires

1. Chiffrer les credentials routeur au repos.
2. Migrer les tokens auth vers cookies `HttpOnly` emis par le backend.
3. Activer un vrai rate limit sur login, refresh et reset password.
4. Livrer une vraie 2FA de connexion.
5. Ajouter une separation UI plus stricte entre supervision et actions destructrices routeur.

## Verite produit

Aujourd hui, dire que la plateforme est "securisee" au niveau attendu d une console d administration reseau serait faux.

La bonne formulation est:

- securite de base presente
- securite avancee insuffisante
- durcissement obligatoire avant confiance forte en prod multi-admin
