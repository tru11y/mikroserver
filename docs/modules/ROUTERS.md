# Module Routers

## Responsabilite

Gerer le parc routeurs et les operations techniques associees:

- listing, filtres, tags et sites
- statuts `ONLINE / DEGRADED / OFFLINE / MAINTENANCE`
- health-check
- sync
- live stats
- maintenance
- actions de masse
- edition reseau (`wireguardIp`, `apiPort`, identifiants API)

## Fichiers coeur

- `backend/src/modules/routers/routers.service.ts`
- `backend/src/modules/routers/routers.controller.ts`
- `backend/src/modules/routers/router-api.service.ts`
- `backend/src/modules/routers/router-api.commands.ts`
- `backend/src/modules/routers/router-api.types.ts`
- `backend/src/modules/routers/router-api.utils.ts`
- `backend/src/modules/routers/router-legacy-ticket.utils.ts`
- `backend/src/modules/routers/router-legacy-ticket.operations.ts`
- `backend/src/modules/routers/router-routeros.transport.ts`
- `backend/src/modules/routers/router-hotspot-readers.utils.ts`
- `backend/src/modules/routers/router-hotspot-live.utils.ts`
- `backend/src/modules/routers/router-hotspot-sync.utils.ts`
- `backend/src/modules/routers/router-hotspot-profiles.utils.ts`
- `backend/src/modules/routers/router-hotspot-ip-bindings.utils.ts`
- `backend/src/modules/routers/router-hotspot-users.utils.ts`
- `backend/src/modules/routers/router-hotspot-delivery.operations.ts`
- `backend/src/modules/routers/router-hotspot-writes.operations.ts`
- `backend/src/modules/routers/router-health.operations.ts`
- `backend/src/modules/routers/dto/router.dto.ts`
- `frontend/src/app/(dashboard)/routers/page.tsx`
- `frontend/src/app/(dashboard)/routers/[id]/page.tsx`
- `frontend/src/app/(dashboard)/routers/[id]/router-detail.selectors.ts`
- `frontend/src/app/(dashboard)/routers/[id]/hotspot-compliance-banner.tsx`
- `frontend/src/app/(dashboard)/routers/[id]/connected-clients-section.tsx`
- `frontend/src/app/(dashboard)/routers/[id]/hotspot-profile-change-modal.tsx`
- `frontend/src/app/(dashboard)/routers/[id]/hotspot-profile-config-modal.tsx`
- `frontend/src/app/(dashboard)/routers/[id]/hotspot-ip-binding-modal.tsx`
- `frontend/src/app/(dashboard)/routers/[id]/hotspot-profiles-section.tsx`
- `frontend/src/app/(dashboard)/routers/[id]/hotspot-ip-bindings-section.tsx`
- `frontend/src/app/(dashboard)/routers/[id]/hotspot-users-section.tsx`

## Dependances autorisees

- `prisma` pour la persistence routeur
- `router-api.service` pour les appels MikroTik
- `audit.service` pour tracer les actions critiques

## A ne pas faire

- Ne pas embarquer ici la logique de verification ticket.
- Ne pas supprimer l'historique metier tickets depuis ce module.
- Ne pas exposer `apiPasswordHash` au front.

## Contrats stables

- `findAll` retourne une vue sure sans secret routeur.
- `bulkAction` doit:
  - continuer meme si un routeur echoue
  - distinguer `processed` et `failed`
  - signaler les ids introuvables
- `sync` et `healthCheck` restent idempotents cote SaaS.
- le front doit reconnaitre tous les statuts Prisma, y compris `DEGRADED`.
- l'edition routeur doit accepter les memes champs reseau que le formulaire expose.
- hotspot users:
  - la liste doit remonter actifs + inactifs
  - doit exposer `firstConnectionAt` et `elapsedSinceFirstConnectionMinutes` pour suivi forfait
  - doit remonter `remainingMinutes`, `isTariffExpired`, `enforcementStatus`
  - la vue `Clients connectes` doit afficher ces indicateurs quand un client est lie a un voucher SaaS connu
- hotspot lecture terrain:
  - les lectures RouterOS multi-tables doivent privilegier la fiabilite a la parallelisation
  - si le routeur repond mal, le front doit afficher une erreur claire plutot qu un chargement infini
  - les timeouts et le polling du dashboard doivent rester coherents avec la latence terrain:
    - `live-stats` peut prendre plusieurs secondes
    - `hotspot/users` peut depasser `20s` sur certains routeurs reels
    - le proxy dashboard doit donc tolerer des reponses lentes et journaliser proprement les echecs reseau
- hotspot ip bindings:
  - la liste doit exposer `resolvedUser` et `hostName` (jointure active + hosts)
  - actions terrain attendues:
    - block/unblock
    - enable/disable
    - update
    - edition des champs de base (`server`, `address`, `macAddress`, `type`, `comment`, `toAddress`, `addressList`, `disabled`)
    - delete
  - un changement de type simple (`blocked -> regular/bypassed`) ne doit pas reenvoyer inutilement des champs vides a RouterOS
- changement de profil utilisateur:
  - sur la page routeur, l action doit etre disponible a la fois:
    - depuis `Clients connectes` pour les sessions actives
    - depuis la recherche utilisateur hotspot pour retrouver un utilisateur precis actif ou inactif
  - le choix du nouveau profil doit passer par une vraie selection de profils charges, pas par une saisie libre par defaut

## Alignement marche Winbox-like

Les solutions hotspot solides ne cherchent pas a cloner tout Winbox. Elles couvrent surtout les operations quotidiennes a fort impact:

- supervision:
  - statut du routeur
  - derniers incidents
  - health-check
  - clients actifs
- operations d'exploitation:
  - sync
  - deconnexion d'un client
  - suppression d'un ticket du routeur
  - maintenance planifiee ou manuelle
- configuration utile au support:
  - hotspot server
  - hotspot profile
  - acces API
  - edition reseau

Fonctions Winbox-like a prioriser ensuite plutot qu'en vrac:

- gestion des users Hotspot
- gestion des IP bindings / bypass staff
- reboot et maintenance guidee
- horloge / NTP / timezone
- DNS et services exposes
- sauvegarde / export configuration routeur

Principe produit:

- inclure ce qui sert tous les jours
- auditer les actions destructrices
- ne pas exposer des fonctions routeur risquant de casser tout le site sans garde-fou

## Endpoints hotspot actuellement exposes

- `GET /api/v1/routers/:id/hotspot/user-profiles`
- `POST /api/v1/routers/:id/hotspot/user-profiles`
- `PATCH /api/v1/routers/:id/hotspot/user-profiles/:profileId`
- `DELETE /api/v1/routers/:id/hotspot/user-profiles/:profileId`
- `GET /api/v1/routers/:id/hotspot/ip-bindings`
- `POST /api/v1/routers/:id/hotspot/ip-bindings`
- `PATCH /api/v1/routers/:id/hotspot/ip-bindings/:bindingId`
- `DELETE /api/v1/routers/:id/hotspot/ip-bindings/:bindingId`
- `POST /api/v1/routers/:id/hotspot/ip-bindings/:bindingId/block`
- `POST /api/v1/routers/:id/hotspot/ip-bindings/:bindingId/unblock`
- `POST /api/v1/routers/:id/hotspot/ip-bindings/:bindingId/enable`
- `POST /api/v1/routers/:id/hotspot/ip-bindings/:bindingId/disable`
- `GET /api/v1/routers/:id/hotspot/users`
- `PATCH /api/v1/routers/:id/hotspot/users/profile`

## Verite terrain

- si `firstConnectionAt` ou `elapsedSinceFirstConnectionMinutes` restent vides pour un client actif, cela signifie generalement que le client n est pas relie a un voucher SaaS connu en base
- la plateforme ne peut pas garantir l ejection automatique d un client "non gere" tant que ce mapping n existe pas

## Risque principal (mise a jour 2026-03-24)

- `router-api.service.ts` reste trop volumineux (999 lignes) meme apres extraction des types/utils/commands/legacy-utils/transport/readers/live-utils/sync-utils/users-utils/profiles-utils/ip-bindings-utils.
- `routers/[id]/page.tsx` reste trop volumineux (1172 lignes) meme apres extraction des selectors, du bandeau compliance, des sections profiles/IP bindings/users, des clients connectes et des principales modales hotspot.
- extraction deja livree:
  - `router-api.types.ts` (contrats et records RouterOS)
  - `router-api.utils.ts` (normalisation/mapping/parse uptime)
  - `router-api.commands.ts` (primitives RouterOS: run command, parse, add/update/remove)
  - `router-legacy-ticket.utils.ts` (normalisation + matching de tickets legacy)
  - `router-legacy-ticket.operations.ts` (orchestration lookup legacy cross-routeurs)
  - `router-routeros.transport.ts` (connexion, execution et identity-check RouterOS)
  - `router-hotspot-readers.utils.ts` (lectures hotspot sequentielles pour ip-bindings/users)
  - `router-hotspot-live.utils.ts` (calcul des stats live et debit delta)
  - `router-hotspot-sync.utils.ts` (sync active clients, sessions, vouchers et metadata)
  - `router-hotspot-profiles.utils.ts` (mapping + tri + commandes CRUD user profiles)
  - `router-hotspot-ip-bindings.utils.ts` (mapping + tri + commandes CRUD IP bindings)
  - `router-hotspot-users.utils.ts` (mapping + enrichissement + tri/filtre hotspot users)
  - `router-hotspot-delivery.operations.ts` (push hotspot user + statut voucher/routeur)
  - `router-hotspot-writes.operations.ts` (suppression user + deconnexion sessions actives)
  - `router-health.operations.ts` (health check + persistence statut/metadata)
  - `hotspot-compliance-banner.tsx` (synthese terrain sur conformite forfaits)
  - `connected-clients-section.tsx` (vue live des clients connectes)
  - `hotspot-profile-change-modal.tsx` (formulaire isole pour changement de profil user)
  - `hotspot-profile-config-modal.tsx` (formulaire isole pour create/update profile)
  - `hotspot-ip-binding-modal.tsx` (formulaire isole pour create/update IP binding)
  - `hotspot-profiles-section.tsx` (profils RouterOS + vue tarifs/legacy)
  - `hotspot-ip-bindings-section.tsx` (listing + actions IP bindings)
  - `hotspot-users-section.tsx` (listing + recherche + suivi forfait utilisateur)
- une correction rapide sur ip-binding ou user-profile peut casser sync/session sans signal fort en review.
- un faux "correctif" frontend qui renvoie tous les champs vides sur un IP binding peut produire un `500` terrain meme si l intention n etait que de changer le type.
- les endpoints lecture hotspot restent sensibles au comportement reel de la librairie MikroTik; une validation VPS reste indispensable apres ce lot.

## Mise a jour 2026-03-25

- changement de profil hotspot user:
  - la dropdown ne depend plus uniquement de `GET /api/v1/routers/:id/hotspot/user-profiles`
  - fallback catalogue construit depuis:
    - profils RouterOS charges
    - profils vus sur les utilisateurs hotspot
    - profils references par les forfaits SaaS
    - profil hotspot par defaut du routeur
- consequence:
  - meme si la lecture detaillee Winbox est vide ou lente, l operateur peut encore choisir un profil coherent pour un utilisateur
  - la page affiche explicitement quand elle fonctionne en mode fallback et non sur le detail complet RouterOS
- edition de profil RouterOS:
  - `rate-limit`, `session-timeout`, `idle-timeout`, `keepalive-timeout` et `address-pool` sont maintenant envoyes a RouterOS seulement s ils ont reellement change
  - les champs texte optionnels peuvent etre vides volontairement lors d un update, ce qui permet de nettoyer une configuration au lieu de conserver une ancienne valeur fantome
- verite dure:
  - ce lot ameliore la fiabilite produit, mais ne suffit toujours pas pour annoncer `9/10`
  - monolithes restants:
    - `backend/src/modules/routers/router-api.service.ts`: 1005 lignes
    - `frontend/src/app/(dashboard)/routers/[id]/page.tsx`: 1214 lignes
- les logs VPS du `2026-03-24` ont montre que le probleme principal n etait pas un crash API permanent mais la lenteur reelle des appels:
  - `live-stats` autour de `1.8s` a `4.5s`
  - `hotspot/ip-bindings` autour de `3.8s`
  - `hotspot/users` jusqu a `23.5s`
- consequence produit:
  - le client frontend et le proxy dashboard doivent etre regles avec des timeouts plus longs que la latence routeur observee
  - les retries doivent etre rares et avec backoff, pas en boucle agressive
- priorite: sortir maintenant le circuit-breaker/push hotspot user et les derniers helpers health/lifecycle du service principal avant d'ajouter de nouvelles features routeur.

## Mise a jour 2026-03-25 - auth session et overview

- auth frontend:
  - `frontend/src/lib/api/auth-session.ts` centralise le decodage JWT et la decision de refresh proactif
  - `frontend/src/lib/api/client.ts` partage un `refreshPromise` unique pour eviter les rafales de refresh concurrents
- effet attendu:
  - moins de `401` parasites sur `auth/me`, `routers`, `plans` et les ecrans routeurs quand le token approche de l expiration
  - moins de courses entre polling React Query et rafraichissement de session
- modularite frontend:
  - extraction de `router-overview-section.tsx`
  - `frontend/src/app/(dashboard)/routers/[id]/page.tsx` descend a `975` lignes
- verite dure:
  - c est une amelioration reelle de robustesse et de lisibilite
  - ce lot ne suffit toujours pas pour annoncer `9/10`
  - le point noir principal reste `backend/src/modules/routers/router-api.service.ts` a `1120` lignes

## Mise a jour 2026-03-25 - hook de lecture routeur

- `frontend/src/app/(dashboard)/routers/[id]/use-router-detail-data.ts` concentre maintenant:
  - permissions de lecture
  - queries routeur/live/hotspot/plans
  - derivees de lecture (catalogue profils, fallback profils, users filtres, compliance, clients live enrichis)
- consequence:
  - `frontend/src/app/(dashboard)/routers/[id]/page.tsx` tombe a `806` lignes
  - la page garde encore trop d etat local et de mutations, mais on a retire le melange lecture + rendu + actions dans le meme fichier
- verite dure:
  - gain modulaire net
  - toujours insuffisant pour annoncer `9/10`

## Mise a jour 2026-03-25 - extraction des actions

- `frontend/src/app/(dashboard)/routers/[id]/use-router-live-operations.ts` concentre maintenant:
  - sync routeur
  - health check
  - tri clients live
  - coupure session
  - suppression ticket
- `frontend/src/app/(dashboard)/routers/[id]/use-router-hotspot-management.ts` concentre maintenant:
  - changement de profil utilisateur
  - CRUD profils RouterOS
  - CRUD IP bindings
  - etat des modales et formulaires hotspot
- consequence:
  - `frontend/src/app/(dashboard)/routers/[id]/page.tsx` tombe a `412` lignes
  - les bugs de tri sur la duree live et le faux changement vers le meme profil sont corriges
- verite dure:
- le composant page est enfin beaucoup plus propre
- mais `use-router-hotspot-management.ts` reste encore trop massif pour une finition senior totale
- le gros point noir backend reste `router-api.service.ts`

## Mise a jour 2026-03-25 - operations hotspot backend + navigation par sections

- backend:
  - `router-api.service.ts` est maintenant ramene a `690` lignes
  - les operations hotspot sont sorties vers:
    - `backend/src/modules/routers/router-hotspot-profiles.operations.ts`
    - `backend/src/modules/routers/router-hotspot-ip-bindings.operations.ts`
    - `backend/src/modules/routers/router-hotspot-users.operations.ts`
    - `backend/src/modules/routers/router-operations.types.ts`
- frontend:
  - la page routeur ne montre plus toutes les sections metier en meme temps
  - navigation par sections:
    - `Clients connectes`
    - `Utilisateurs hotspot`
    - `Profils`
    - `IP bindings`
  - chargement plus cible:
    - `IP bindings` uniquement quand l onglet est ouvert
    - `plans` uniquement pour la vue `Profils`
    - `utilisateurs hotspot` seulement pour les vues live/users ou un changement de profil
- consequence:
  - moins de charge cognitive
  - moins de pression inutile sur le routeur
  - meilleure separation entre supervision live et configuration hotspot

## Mise a jour 2026-03-25 - catalogue profils et sous-hooks hotspot

- frontend:
  - `frontend/src/app/(dashboard)/routers/[id]/use-router-detail-data.ts` charge maintenant les forfaits SaaS meme hors section `Profils`
  - objectif: garder un catalogue de profils complet quand on change un profil depuis `Clients connectes` ou `Recherche utilisateur hotspot`
  - `frontend/src/app/(dashboard)/routers/[id]/use-router-hotspot-management.ts` devient un simple composeur
  - decoupage interne:
    - `use-hotspot-profile-change.ts`
    - `use-hotspot-ip-bindings-management.ts`
    - `use-hotspot-profile-config-management.ts`
- consequence:
  - moins de logique cachee dans des `useEffect`
  - moins de risque de reinitialiser silencieusement une modal hotspot
  - meilleure lisibilite pour les prochains lots de finition

## Mise a jour 2026-03-25 - lifecycle routeur et modal IP binding

- backend:
  - `backend/src/modules/routers/router-api.service.ts` tombe a `607` lignes
  - les flux critiques restants du service principal ont ete sortis vers:
    - `router-hotspot-delivery.operations.ts`
    - `router-hotspot-writes.operations.ts`
    - `router-health.operations.ts`
    - `router-legacy-ticket.operations.ts`
- frontend:
  - `frontend/src/app/(dashboard)/routers/[id]/hotspot-ip-binding-modal.tsx` devient plus guidee:
    - choix visuel du type `regular / blocked / bypassed`
    - aide de contexte sur l effet du type
    - champs avances caches par defaut
    - message explicite si ni IP ni MAC ne sont fournis
- verite dure:
  - la zone routeur est maintenant beaucoup plus senior qu au debut du chantier
  - elle n est toujours pas a `9.5/10` car:
    - `use-hotspot-ip-bindings-management.ts` reste dense
    - l UX globale reste encore tres technique
    - la validation VPS doit continuer a confirmer les parcours terrain

## Mise a jour 2026-03-25 - formulaires IP binding et verification stricte

- frontend:
  - `frontend/src/app/(dashboard)/routers/[id]/hotspot-ip-binding.forms.ts` centralise maintenant:
    - etat vide create
    - mapping edit depuis un binding existant
    - validation identite `IP / MAC`
    - construction des payloads create/update
  - `frontend/src/app/(dashboard)/routers/[id]/use-hotspot-ip-bindings-management.ts` descend a `248 lignes`
  - un test dedie couvre ce mapping via `hotspot-ip-binding.forms.spec.ts`
- consequence:
  - moins de duplication entre creation et edition
  - moins de risque de renvoyer un payload incoherent a RouterOS
  - meilleure base pour les prochains durcissements UX sur `IP bindings`

## Mise a jour 2026-03-25 - cockpit flotte routeurs

- frontend list page:
  - `frontend/src/app/(dashboard)/routers/page.tsx` devient un composeur leger (`159 lignes`)
  - orchestration sortie dans `frontend/src/app/(dashboard)/routers/use-routers-page.ts`
  - nouvelles briques:
    - `routers-hero-section.tsx`
    - `routers-filter-panel.tsx`
    - `routers-bulk-actions-bar.tsx`
    - `routers-fleet-section.tsx`
    - `router-form-panel.tsx`
    - `router-delete-modal.tsx`
- consequence:
  - le listing routeur est maintenant pense comme un cockpit commercialisable
  - les actions de masse et operations critiques sont plus lisibles
  - la page liste n est plus un gros bloc JSX difficile a faire evoluer

## Mise a jour 2026-03-25 - detail routeur: latence reelle et mode degrade

- backend:
  - `backend/src/modules/routers/router-api.service.ts` applique maintenant des timeouts RouterOS distincts selon l operation:
    - `health`
    - `live`
    - `heavy-read`
    - `write`
  - objectif: eviter qu un timeout uniforme trop agressif fasse tomber en meme temps:
    - `live-stats`
    - `hotspot/user-profiles`
    - `hotspot/users`
    - `hotspot/ip-bindings`
    - `sync`
  - les lectures live/sync lentes sont traduites en erreurs HTTP explicites plutot qu en `500` opaques
- frontend:
  - `frontend/src/app/(dashboard)/routers/[id]/use-router-detail-data.ts` ne charge plus `hotspot/users` en vue `users` tant qu aucun terme de recherche precis n est saisi
  - les requetes detail routeur ont maintenant:
    - retry limite sur erreurs serveur / timeout
    - `placeholderData` pour moins casser l ecran sur erreur transitoire
  - `router-section-nav.tsx` et `router-hotspot-shortcuts.tsx` utilisent un badge `!` quand une section est indisponible au lieu de simuler un faux `0`
  - `hotspot-profile-change-modal.tsx` reintegre toujours le profil courant dans la liste selectionnable, meme si le catalogue charge est partiel
- consequence:
  - moins de timeouts inutiles sur les recherches hotspot
  - moins de confusion operateur quand le routeur est lent ou degrade
  - meilleure continuite des parcours profils / live / bindings pendant les incidents terrain

## Architecture de deploiement actuelle

Verite dure:

- nous avons aujourd hui:
  - un monolithe modulaire NestJS
  - un dashboard Next.js
  - Nginx en reverse proxy / terminaison TLS
  - un proxy applicatif Next.js sur `/proxy/*`
- nous n avons pas encore:
  - de vrais microservices metier independants
  - un API gateway dedie au sens architecture microservices
  - un vrai load balancing multi-instances en prod pour l API

Conclusion:

- il ne faut pas "appliquer microservices + API gateway + load balancer" juste parce que le pattern est populaire
- la priorite reste:
  - finir le decoupage interne du monolithe
  - fiabiliser les parcours routeur/auth
  - isoler les domaines lourds avant de split en services reseau separes

## Tests a lancer

- `backend/src/modules/routers/routers.service.spec.ts`
- `backend/src/modules/metrics/metrics.service.spec.ts`
- `frontend`: verifier les filtres de statut et le detail routeur

## Risque historique

Un bug ici casse la supervision terrain, les operations de masse, ou le diagnostic live sans forcement casser l'API globale.
