# Module Frontend Proxy

## Responsabilite

Assurer la communication fiable entre le dashboard Next.js et l'API NestJS:

- proxy navigateur vers l'API via `/proxy/...`
- resolution interne de l'API cote serveur
- contraintes de binding du serveur Next en conteneur
- healthcheck frontend de production

## Fichiers coeur

- `frontend/src/app/proxy/[...path]/route.ts`
- `frontend/src/lib/api.ts`
- `frontend/next.config.js`
- `frontend/Dockerfile`
- `infrastructure/docker/docker-compose.prod.yml`

## Dependances autorisees

- `NextRequest` et route handlers `app/`
- `fetch` serveur natif
- variables d'environnement `API_INTERNAL_URL` et `NEXT_PUBLIC_API_URL`

## A ne pas faire

- Ne pas faire reposer le login navigateur sur un acces direct au port `3000`.
- Ne pas utiliser `HOSTNAME` comme simple variable Docker dans `compose` pour forcer le binding Next.
- Ne pas remettre une rewrite opaque si un proxy applicatif explicite existe deja.

## Contrats stables

- le navigateur parle a l'API uniquement via `/proxy/api/v1/...`
- le serveur Next utilise `API_INTERNAL_URL` pour joindre l'API en reseau interne
- le proxy doit transmettre:
  - la methode HTTP
  - les headers utiles, dont `Authorization`
  - les corps JSON et binaires
- le proxy doit repondre `502` explicite si l'API est injoignable
- le conteneur dashboard doit binder `0.0.0.0` via la commande de lancement, car Docker reserve deja `HOSTNAME`

## Tests a lancer

- `frontend`: `npm run type-check`
- `frontend`: `npm run build`
- recette prod:
  - `GET /login`
  - `GET /proxy/api/v1/health/live`
  - `POST /proxy/api/v1/auth/login`
  - `docker compose ... ps`

## Risque principal

Si ce module regresse, la page `/login` peut charger alors que toute authentification navigateur echoue en `500`, la navbar peut se vider faute de `auth/me`, et le dashboard peut sembler `unhealthy` alors que le site sert encore des pages.
