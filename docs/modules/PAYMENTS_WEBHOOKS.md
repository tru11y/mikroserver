# Module Payments Webhooks

## Responsabilite

Isoler toute la chaine paiement entrante et sortante:

- creation d'intention de paiement
- verification HMAC des callbacks
- protection anti-replay
- stockage securise des evenements webhook
- mise en file pour traitement asynchrone

## Fichiers coeur

- `backend/src/modules/payments/interfaces/payment-provider.interface.ts`
- `backend/src/modules/payments/providers/wave.provider.ts`
- `backend/src/modules/payments/providers/wave.provider.spec.ts`
- `backend/src/modules/webhooks/webhooks.controller.ts`
- `backend/src/modules/webhooks/webhooks.controller.spec.ts`

## Dependances autorisees

- `ConfigService`
- `axios` pour le provider
- `crypto` pour HMAC
- `prisma` pour les evenements webhook
- `queue.service` pour le traitement asynchrone

## A ne pas faire

- Ne pas traiter toute la logique transactionnelle dans le controller webhook.
- Ne pas stocker les signatures webhook en clair.
- Ne pas coupler la verification webhook a un module front ou tickets.

## Contrats stables

- `WaveProvider.verifyAndParseWebhook` doit:
  - verifier la signature HMAC
  - proteger contre le replay par timestamp
  - mapper proprement les statuts externes vers les statuts internes
- `WebhooksController.handleWaveWebhook` doit:
  - refuser les webhooks invalides sans ecrire en base
  - etre idempotent sur `externalEventId`
  - enregistrer un evenement valide avec headers/signature redacts
  - deleguer le traitement metier a la queue

## Tests a lancer

- `backend/src/modules/payments/providers/wave.provider.spec.ts`
- `backend/src/modules/webhooks/webhooks.controller.spec.ts`

## Risque principal

Une regression ici peut casser les paiements, provoquer des doublons, ou ouvrir une faille de securite sur les callbacks externes.
