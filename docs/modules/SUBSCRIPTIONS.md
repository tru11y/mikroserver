# Module Subscriptions

## Responsabilite

Gerer le cycle de vie des abonnements:

- creation
- consultation
- mise a jour
- annulation
- renouvellement
- lecture de l'abonnement courant

## Fichiers coeur

- `backend/src/modules/subscriptions/subscriptions.service.ts`
- `backend/src/modules/subscriptions/subscriptions.controller.ts`
- `backend/src/modules/subscriptions/dto/subscription.dto.ts`

## Contrats stables

- les champs `Plan` et `User` doivent suivre les noms Prisma camelCase dans les `select`:
  - `durationMinutes`
  - `priceXof`
  - `firstName`
  - `lastName`
- les champs du modele `subscriptions` restent en snake_case (definition Prisma actuelle):
  - `user_id`
  - `plan_id`
  - `price_xof`
  - `updated_at`
- la relation d'abonnement courant cote `User` est:
  - `subscriptions_users_current_subscription_idTosubscriptions`

## Verification minimale

### Backend

- `npm run build`

### Recette fonctionnelle

- creer un abonnement
- lire l'abonnement courant
- renouveler puis annuler un abonnement
- verifier la mise a jour du `current_subscription_id` utilisateur

## Risque principal

Le risque principal est la derive entre schema Prisma et noms de champs utilises dans le service, ce qui bloque le build global et donc les deploiements.
