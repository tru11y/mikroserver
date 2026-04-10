# Module Metrics

## Responsabilite

Donner une vue d'exploitation fiable:

- rapports tickets
- chiffres cles
- centre d'incidents
- breakdowns routeurs / operateurs / forfaits
- exports de rapports

## Fichiers coeur

- `backend/src/modules/metrics/metrics.service.ts`
- `backend/src/modules/metrics/metrics.controller.ts`
- `backend/src/modules/metrics/metrics.service.spec.ts`
- `frontend/src/app/(dashboard)/analytics/page.tsx`
- `frontend/src/app/(dashboard)/incidents/page.tsx`

## Dependances autorisees

- `prisma`
- `queue.service` pour l'etat operationnel
- modules de presentation front `analytics` et `incidents`

## A ne pas faire

- Ne pas recalculer des permissions ici.
- Ne pas modifier l'etat des tickets depuis un endpoint de rapport.
- Ne pas melanger supervision routeur et actions destructives.

## Contrats stables

- `getIncidentCenter` doit distinguer severites et totaliser proprement les incidents.
- `getTicketReport` doit produire:
  - resume
  - breakdowns
  - derniers echecs de delivery
- l'absence d'incident doit retourner un resultat propre, pas une erreur.

## Tests a lancer

- `backend/src/modules/metrics/metrics.service.spec.ts`
- `backend/src/modules/routers/routers.service.spec.ts`

## Risque principal

Une regression ici fausse le pilotage exploitation sans toujours etre visible immediatement sur le front.
