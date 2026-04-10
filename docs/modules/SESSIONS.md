# Module Sessions

## Responsabilite

Gerer la vue exploitation des sessions actives hotspot:

- aggregation des clients actifs par routeur
- remontee des erreurs routeur sans casser toute la page
- coupure manuelle d'une session active

## Fichiers coeur

- `backend/src/modules/sessions/sessions.service.ts`
- `backend/src/modules/sessions/sessions.controller.ts`
- `backend/src/modules/sessions/sessions.service.spec.ts`
- `frontend/src/app/(dashboard)/sessions/page.tsx`

## Dependances autorisees

- `prisma` pour synchroniser l'etat local des sessions
- `router-api.service` pour lire les sessions live et en couper une
- `vouchers` uniquement via appels front separes pour la suppression definitive admin

## A ne pas faire

- Ne pas melanger `couper une session` et `supprimer un ticket`.
- Ne pas mettre ici la logique de verification ticket.
- Ne pas rendre indisponible toute la page si un routeur ne repond pas.

## Contrats stables

- `findActive` doit:
  - agreger les sessions de tous les routeurs cibles
  - retourner `routerErrors`
  - continuer si un routeur echoue
  - trier les sessions pour garder la vue utile terrain
- `terminate` doit:
  - couper la session cote routeur
  - marquer seulement les sessions locales encore `ACTIVE` comme `TERMINATED`

## Tests a lancer

- `backend/src/modules/sessions/sessions.service.spec.ts`
- `backend/src/modules/routers/routers.service.spec.ts`
- `backend/src/modules/vouchers/voucher.service.spec.ts`

## Risque principal

Une regression ici fausse l'etat temps reel terrain ou coupe mal une session sans nettoyer correctement l'etat SaaS.
