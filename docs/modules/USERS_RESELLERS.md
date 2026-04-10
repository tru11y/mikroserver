# USERS RESELLERS

## Objectif

Le module `users/resellers` gere les comptes internes du SaaS:

- creation de comptes revendeurs et viewers
- lecture des comptes utilisateurs
- edition du profil utilisateur:
  - email
  - prenom
  - nom
  - telephone
- suspension et reactivation
- suppression logique reservee au super admin
- attribution d'un profil d'acces ou de permissions explicites
- reinitialisation admin du mot de passe avec revocation des sessions

Le but n'est pas seulement d'afficher des comptes, mais de proteger les operations sensibles de delegation terrain.

## Responsabilites

- normaliser les entrees critiques:
  - email
  - prenom
  - nom
  - telephone optionnel
- appliquer les garde-fous de role:
  - pas de creation de `SUPER_ADMIN` via la gestion standard
  - un `ADMIN` ne cree pas un autre `ADMIN`
  - un `SUPER_ADMIN` ne peut pas etre personnalise, suspendu ou supprime via le flux standard
  - un utilisateur ne peut pas suspendre ou supprimer son propre compte
  - seul un `SUPER_ADMIN` peut modifier ou reinitialiser un compte `ADMIN`
- ecrire les evenements sensibles dans l'audit

## API exposee

- `GET /api/v1/users`
- `GET /api/v1/users/resellers`
- `GET /api/v1/users/permission-options`
- `GET /api/v1/users/:id`
- `POST /api/v1/users`
- `PUT /api/v1/users/:id/profile`
- `PUT /api/v1/users/:id/access`
- `PUT /api/v1/users/:id/password`
- `POST /api/v1/users/:id/suspend`
- `POST /api/v1/users/:id/activate`
- `DELETE /api/v1/users/:id`

## Regles de securite

- `DELETE /users/:id` reste reserve au `SUPER_ADMIN`
- le front ne doit pas afficher le bouton de suppression a un simple `ADMIN`
- le backend reste la source de verite et doit rejeter:
  - les creations de `SUPER_ADMIN`
  - les creations de `ADMIN` par un simple admin
  - la personnalisation d'un `SUPER_ADMIN`
  - la modification d'un `ADMIN` par un simple admin
  - la suspension ou suppression de son propre compte
  - la reinitialisation de son propre mot de passe via le flux admin
  - tout doublon d'email ou de telephone

## Alignement marche

Les solutions matures de guest WiFi et hotspot pro se retrouvent sur les points suivants:

- separation nette entre:
  - identite operateur
  - droits d'acces
  - reinitialisation d'identifiants
- audit des changements critiques
- reset mot de passe qui coupe les sessions existantes
- controle fort sur les comptes les plus puissants

Le module suit cette logique:

- modal profil pour l'identite
- modal acces pour les permissions
- reset mot de passe distinct avec revocation des refresh tokens
- protection speciale des comptes `ADMIN` et `SUPER_ADMIN`

## Dependances autorisees

- `AuthModule`
- `AuditModule`
- `normalizeAuthEmail`
- `permissions.constants`

## Front associe

- page: `frontend/src/app/(dashboard)/resellers/page.tsx`
- API client: `frontend/src/lib/api.ts`

Points UX importants:

- masquer les actions non autorisees plutot que provoquer un faux parcours
- garder une confirmation avant suppression
- distinguer clairement:
  - consultation
  - edition du profil
  - gestion des acces
  - reinitialisation du mot de passe
  - suppression reservee super admin

## Verification minimale a relancer si ce module change

### Backend

- `npm test -- --runInBand src/modules/users/users.service.spec.ts`
- `npm run build`

### Frontend

- `npm run type-check`
- `npm run build`

### Recette fonctionnelle

- ouvrir `/resellers` avec un admin
- verifier qu'un admin voit:
  - creation
  - edition profil d'un revendeur
  - reset mot de passe d'un revendeur
  - suspension/reactivation
  - gestion des acces
  - pas de bouton de suppression
- verifier qu'un super admin voit aussi la suppression
- creer un revendeur avec email en majuscules + espaces et confirmer la normalisation
- modifier un email et un telephone puis confirmer la normalisation et l'unicite
- reinitialiser le mot de passe et confirmer que la session precedente est invalidee
- tenter une action interdite sur un compte critique et verifier le rejet

## Risques connus

- toute regression ici peut casser la delegation terrain ou exposer des actions trop puissantes
- la suppression est logique cote SaaS, pas une purge physique de l'historique
- les profils d'acces doivent rester synchronises avec `permissions.constants`
