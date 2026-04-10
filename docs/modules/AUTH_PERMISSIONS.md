# Module Auth Permissions

## Responsabilite

Centraliser les droits applicatifs du SaaS:

- roles `SUPER_ADMIN`, `ADMIN`, `RESELLER`, `VIEWER`
- catalogue de permissions
- profils de permissions
- resolution finale des droits utilisateur

## Fichiers coeur

- `backend/src/modules/auth/auth.utils.ts`
- `backend/src/modules/auth/auth.utils.spec.ts`
- `backend/src/modules/auth/permissions/permissions.constants.ts`
- `backend/src/modules/auth/guards/permissions.guard.ts`
- `backend/src/modules/auth/decorators/permissions.decorator.ts`
- `frontend/src/lib/permissions.ts`

## Dependances autorisees

- `@prisma/client` pour `UserRole`
- guards/decorators auth
- front `permissions.ts` pour lecture simple des droits

## A ne pas faire

- Ne pas mettre de logique metier tickets/routeurs ici.
- Ne pas dupliquer les permissions dans plusieurs fichiers.
- Ne pas faire dependre ce module d'un module fonctionnel comme `vouchers` ou `routers`.

## Contrats stables

- `sanitizePermissions` ne retourne que des permissions supportees, uniques et triees.
- `normalizePermissionProfile` accepte les variantes de casse et espaces.
- `normalizeAuthEmail` doit supprimer les espaces parasites et imposer la casse basse.
- le bootstrap admin et le recovery admin doivent partager la meme source de verite:
  - email par defaut `admin@mikroserver.com`
  - mot de passe par defaut `12345678`
  - surcharge possible via variables d'environnement dediees
- `resolveUserPermissions` suit cette priorite:
  - super admin
  - permissions explicites
  - profil
  - role par defaut

## Parcours auth attendus

- login:
  - email normalise
  - verrouillage apres echecs repetes
  - compatibilite legacy hash si necessaire
- recovery admin:
  - recree ou reinitialise le super admin canonique
  - revoque les refresh tokens actifs
  - remet l'etat du compte a `ACTIVE`
- reset mot de passe d'un utilisateur gere:
  - reserve a `users.manage`
  - doit revoquer les refresh tokens actifs
  - ne doit jamais exposer le mot de passe en audit ou en reponse API

- self-service password reset (mot de passe oublie):
  - `POST /auth/password-reset/request` (public)
  - `POST /auth/password-reset/confirm` (public)
  - token de reset + code OTP 6 chiffres
  - expiration courte (30 min)
  - revoque les refresh tokens actifs apres confirmation
  - reinitialise `failedLoginAttempts` et `lockedUntil`

## Verite securite (etat 2026-03-24)

- change password utilisateur connecte: implemente (`POST /auth/change-password`)
- reset password email+OTP: implemente
- 2FA de connexion (TOTP/app authenticator): non implemente
- variables email reset (`RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `PASSWORD_RESET_APP_URL`):
  - utilisees dans `auth.service.ts`
  - non validees strictement dans `configuration.ts` (a corriger)

## Decision produit ferme

- ne pas presenter "double authentication activee" tant que le parcours TOTP de login n'est pas livre et teste.

## Tests a lancer

- `backend/src/modules/auth/auth.utils.spec.ts`
- `backend/src/modules/auth/permissions/permissions.constants.spec.ts`
- `backend/src/modules/vouchers/voucher.service.spec.ts`

## Risque principal

Une petite regression ici peut masquer la navbar, exposer trop d'actions, ou bloquer des operations terrain.
