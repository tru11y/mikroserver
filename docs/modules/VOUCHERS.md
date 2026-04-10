# Module Vouchers

## Responsabilite

Piloter tout le cycle de vie ticket:

- creation
- verification SaaS et legacy
- export PDF/CSV
- suppression sure
- suppression definitive admin

## Fichiers coeur

- `backend/src/modules/vouchers/voucher.service.ts`
- `backend/src/modules/vouchers/vouchers.controller.ts`
- `backend/src/modules/vouchers/pdf.service.ts`
- `backend/src/modules/vouchers/voucher.service.spec.ts`
- `frontend/src/app/(dashboard)/vouchers/page.tsx`
- `frontend/src/app/(dashboard)/vouchers/verify/page.tsx`
- `frontend/src/app/(dashboard)/vouchers/generate/page.tsx`

## Dependances autorisees

- `router-api.service` uniquement pour verifier, couper ou retirer un ticket du routeur
- `audit.service`
- `queue.service` pour les operations asynchrones de delivery

## A ne pas faire

- Ne pas confondre `couper` et `supprimer definitivement`.
- Ne pas effacer l'historique SaaS d'un ticket deja utilise.
- Ne pas imposer un format unique de ticket si le legacy existe encore.

## Contrats stables

- verification:
  - supporte les tickets SaaS
  - supporte les tickets legacy
  - respecte `routerId` quand il est fourni
- suppression lot:
  - supprime seulement les tickets encore surs a retirer
  - retourne un resume `deleted/skipped`
- suppression definitive admin:
  - demande confirmation cote UI
  - retire le ticket cote routeur
  - preserve l'historique metier si le ticket a deja servi

## Tests a lancer

- `backend/src/modules/vouchers/voucher.service.spec.ts`
- `backend/src/modules/vouchers/pdf.service.spec.ts`

## Risque principal

Une regression ici impacte directement le terrain, la caisse, la verification manuelle et l'exploitation du routeur.
