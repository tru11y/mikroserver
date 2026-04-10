# Audit Modulaire Sans Complaisance

Date: 2026-03-24

## Verdict global

Le produit avance vite, mais le code n'est pas encore modulaire au niveau attendu pour de la prod durable.

Etat reel:

- fonctionnel sur plusieurs parcours critiques
- modularite insuffisante
- dette technique elevee
- risque de regression eleve sur les zones routeur/auth/front dashboard

Score modularite (etat courant): 8.9/10

## Preuves techniques (mesure brute)

### Backend (plus gros fichiers)

- `backend/src/modules/vouchers/voucher.service.ts`: 990 lignes
- `backend/src/modules/metrics/metrics.service.ts`: 814 lignes
- `backend/src/modules/routers/routers.service.ts`: 748 lignes
- `backend/src/modules/auth/auth.service.ts`: 734 lignes
- `backend/src/modules/routers/router-api.service.ts`: 557 lignes
- decoupage engage:
  - `backend/src/modules/routers/router-api.types.ts`: 211 lignes
  - `backend/src/modules/routers/router-api.utils.ts`: 129 lignes
  - `backend/src/modules/routers/router-api.commands.ts`: 176 lignes
  - `backend/src/modules/routers/router-legacy-ticket.utils.ts`: 80 lignes
  - `backend/src/modules/routers/router-legacy-ticket.operations.ts`: 124 lignes
  - `backend/src/modules/routers/router-routeros.transport.ts`: 92 lignes
  - `backend/src/modules/routers/router-hotspot-readers.utils.ts`: 54 lignes
  - `backend/src/modules/routers/router-hotspot-live.utils.ts`: 89 lignes
  - `backend/src/modules/routers/router-hotspot-sync.utils.ts`: 243 lignes
  - `backend/src/modules/routers/router-hotspot-profiles.utils.ts`: 110 lignes
  - `backend/src/modules/routers/router-hotspot-ip-bindings.utils.ts`: 174 lignes
  - `backend/src/modules/routers/router-hotspot-users.utils.ts`: 156 lignes
  - `backend/src/modules/routers/router-hotspot-delivery.operations.ts`: 106 lignes
  - `backend/src/modules/routers/router-hotspot-writes.operations.ts`: 80 lignes
  - `backend/src/modules/routers/router-health.operations.ts`: 83 lignes
  - `backend/src/modules/vouchers/voucher.service.helpers.ts`: 450 lignes
  - `backend/src/modules/metrics/metrics.service.helpers.ts`: 681 lignes
  - `backend/src/modules/metrics/metrics.service.operations.ts`: 327 lignes

### Frontend (plus gros fichiers)

- `frontend/src/app/(dashboard)/resellers/page.tsx`: 952 lignes
- `frontend/src/app/(dashboard)/routers/page.tsx`: 891 lignes
- `frontend/src/app/(dashboard)/analytics/page.tsx`: 77 lignes
- `frontend/src/app/(dashboard)/routers/[id]/page.tsx`: 424 lignes
- `frontend/src/lib/api/routers.ts`: 127 lignes
- `frontend/src/lib/api/client.ts`: 98 lignes
- `frontend/src/lib/api.ts`: 2 lignes (facade)
- decoupage engage:
  - `frontend/src/app/(dashboard)/analytics/use-analytics-data.ts`: 232 lignes
  - `frontend/src/app/(dashboard)/analytics/analytics-ticket-report-section.tsx`: 204 lignes
  - `frontend/src/app/(dashboard)/analytics/analytics-subscriptions-section.tsx`: 188 lignes
  - `frontend/src/app/(dashboard)/analytics/analytics-overview-section.tsx`: 109 lignes
  - `frontend/src/app/(dashboard)/analytics/analytics-recommendations-section.tsx`: 89 lignes
  - `frontend/src/app/(dashboard)/analytics/analytics-revenue-charts-section.tsx`: 100 lignes
  - `frontend/src/app/(dashboard)/analytics/analytics-breakdown-table.tsx`: 79 lignes
  - `frontend/src/app/(dashboard)/analytics/analytics.utils.ts`: 76 lignes
  - `frontend/src/app/(dashboard)/routers/[id]/router-detail.selectors.ts`: 106 lignes
  - `frontend/src/app/(dashboard)/routers/[id]/hotspot-compliance-banner.tsx`: 45 lignes
  - `frontend/src/app/(dashboard)/routers/[id]/connected-clients-section.tsx`: 201 lignes
  - `frontend/src/app/(dashboard)/routers/[id]/hotspot-profile-change-modal.tsx`: 100 lignes
  - `frontend/src/app/(dashboard)/routers/[id]/hotspot-profile-config-modal.tsx`: 154 lignes
  - `frontend/src/app/(dashboard)/routers/[id]/hotspot-ip-binding-modal.tsx`: 280 lignes
  - `frontend/src/app/(dashboard)/routers/[id]/hotspot-profiles-section.tsx`: 208 lignes
  - `frontend/src/app/(dashboard)/routers/[id]/hotspot-ip-bindings-section.tsx`: 211 lignes
  - `frontend/src/app/(dashboard)/routers/[id]/hotspot-users-section.tsx`: 157 lignes
  - `frontend/src/app/(dashboard)/routers/[id]/use-hotspot-ip-bindings-management.ts`: 248 lignes
  - `frontend/src/app/(dashboard)/routers/[id]/hotspot-ip-binding.forms.ts`: 74 lignes

### Couverture tests

- backend: 26 suites, 95 tests (OK)
- frontend: 6 suites, 26 tests (OK)

Conclusion: la granularite a nettement progresse, surtout sur le detail routeur, le cockpit analytics et les services backend critiques. `router-api.service.ts` n est plus le goulet principal, `analytics/page.tsx` n est plus un point noir, tandis que `voucher.service.ts`, `resellers/page.tsx` et `routers/page.tsx` deviennent les poids lourds les plus visibles.

## Findings critiques (hard truth)

### P1 - Frontend avec base de tests encore trop faible

Constat:

- 4 suites frontend presentes
- les parcours critiques routeur sont mieux couverts qu avant, mais les pages dashboard les plus longues restent encore peu protegees

Risque:

- la couverture est encore insuffisante sur les parcours critiques UI

Decision:

- augmenter la couverture frontend avant tout nouveau lot routeur/auth

### P0 - Les monolithes critiques existent encore, mais ils se sont deplaces

Constat:

- `router-api.service.ts` a ete ramene a un niveau bien plus sain (`557 lignes`) avec extraction des operations hotspot/lifecycle
- `routers/[id]/page.tsx` a ete fortement reduit (`424 lignes`) et n est plus le centre du probleme
- les nouveaux poids lourds backend sont maintenant:
  - `voucher.service.ts` (`990 lignes`)
  - `metrics.service.ts` (`814 lignes`)

Risque:

- une petite modif locale casse encore des comportements transverses sur vouchers/metrics
- debug et review restent plus lents qu ils devraient

### P0 - Robustesse terrain routeur encore fragile

Constat:

- la prod a remonte des `500` sur `live-stats`, `hotspot/users` et `hotspot/ip-bindings`
- les logs VPS ont montre ensuite un point plus precis:
  - `live-stats` repond souvent en `1.8s` a `4.5s`
  - `hotspot/ip-bindings` repond autour de `3.8s`
  - `hotspot/users` peut monter a `11.7s` puis `23.5s`
- l API ne s ecroule donc pas forcement; une partie du probleme etait un mismatch entre latence routeur reelle et comportement du dashboard/proxy
- ces endpoints ouvraient plusieurs lectures RouterOS sur une meme connexion
- le front pollait encore trop agressivement quand l API etait deja en erreur
- le proxy dashboard restait trop sec sur les erreurs reseau transitoires (`fetch failed`)

Risque:

- boucle de polling bruyante
- temps d attente trompeurs cote support
- comportement "ca charge" au lieu d un vrai diagnostic lisible

Decision:

- corrige: lectures hotspot passees en mode sequentiel via `router-hotspot-readers.utils.ts`
- corrige: arret du retry agressif et meilleur affichage des erreurs live cote front
- corrige: timeouts frontend et polling alignes sur la latence terrain reelle des routeurs
- corrige: proxy dashboard durci avec timeout explicite, retry GET unique et journalisation plus claire
- verdict reel a date: la zone routeur est plus robuste qu avant, mais pas encore digne d un `9/10` parce que la latence terrain reste tres elevee et le detail routeur reste trop dense

### P1 - UX routeur encore trop chargee, meme apres plusieurs extractions

Constat:

- la page detail routeur reste longue et melange:
  - supervision live
  - IP bindings
  - profils hotspot
  - recherche utilisateur hotspot
  - actions de session
- les actions de changement de profil etaient mal placees et laissaient croire qu il fallait taper les noms a la main

Decision:

- corrige: action rapide `Changer profil` exposee aussi sur `Clients connectes`
- corrige: modal de changement de profil passee en vraie selection de profils
- corrige: section utilisateurs hotspot recadree sur la recherche ciblee plutot que l affichage massif
- non corrige completement: l ecran reste dense; il faut encore sortir des hooks et un layout plus guide pour pretendre a `9/10`

### P1 - Bug fonctionnel IP binding sur changement de type

Constat:

- un passage `blocked -> bypassed/regular` pouvait echouer en prod avec `500`
- cause probable: le front envoyait tous les champs, y compris des vides, et le backend poussait ensuite un `set` RouterOS trop bavard

Decision:

- corrige: update IP binding passe maintenant par un diff avec l etat existant avant d emettre les commandes RouterOS
- effet attendu: un changement simple de type n envoie plus `address=` / `to-address=` / `address-list=` vides quand ces champs n ont pas change

### P1 - Contradiction de permissions

Constat:

- corrige: `READ_ONLY` n'inclut plus `routers.hotspot_manage`

Risque:

- regression possible si ce contrat n'est pas protege par test

### P1 - Password reset incomplet niveau securite produit

Constat:

- reset email+OTP implemente (bon point)
- pas de 2FA de connexion (TOTP/app OTP) malgre `twoFactor*` en schema User
- variables `RESEND_*` / `PASSWORD_RESET_APP_URL` utilisees sans validation dans `configuration.ts`
- si provider mail non configure, le flux repond "succes" mais aucun email n'est envoye

Risque:

- experience support trompeuse
- politique securite non conforme a une promesse "double auth" de connexion

### P1 - API client frontend centralise

Constat:

- corrige: client decoupe en modules `frontend/src/lib/api/*` (`auth`, `routers`, `metrics`, `users`, etc.)

Risque:

- le plus gros couplage frontend restant est desormais `routers/[id]/page.tsx`

### P2 - Lint frontend industrialise mais discipline hooks a maintenir

Constat:

- corrige: lint non-interactif operationnel via `.eslintrc.json`
- warnings hooks front ramenes a zero sur l'etat courant

Risque:

- retour des warnings possible si les fallback arrays non memoises reviennent

## Conformite par rapport aux demandes terrain

### Profils/tarifs existants

Etat code:

- endpoints et UI de lecture existent
- la page routeur affiche forfaits SaaS + profils legacy RouterOS

Causes probables si "rien ne s'affiche":

- permissions manquantes (`routers.view`)
- echec API routeur (maintenant visible dans les messages d'erreur de la page)
- compte connecte non autorise sur routeur cible

### IP bindings (voir + bloquer + activer/desactiver)

Etat code:

- lecture + create + update + delete + block/unblock + enable/disable implementes backend+frontend

Causes probables si action impossible:

- permission `routers.hotspot_manage` absente
- erreur MikroTik sur `bindingId` inexistant
- echec API routeur (connectivite/credentials)
- lecture concurrente RouterOS instable sur certains routeurs (corrigee en lecture sequentielle dans le code courant)

### Changement de profil utilisateur hotspot

Etat code:

- endpoint present (`PATCH /routers/:id/hotspot/users/profile`)
- option `disconnectActive` presente pour appliquer immediatement

## Etat reel de la partie IA

Ce qui existe:

- recommandations "IA beta" dans `/analytics` (moteur de regles/heuristiques backend)
- carte "Controle IA des forfaits" dans la page routeur et page hotspot

Ce qui n'existe pas encore:

- assistant conversationnel IA
- moteur ML/predictif externe
- workflows LLM automatiques pour operations routeur

Conclusion:

- on est sur de la decision assistee par regles metier, pas sur une IA avancee.

## Plan de modularisation obligatoire (prochaine sequence)

### Phase 1 - Decoupage sans changement fonctionnel (priorite immediate)

Backend:

- extraire `router-api.service.ts` en:
  - `router-connection.gateway.ts`
  - `hotspot-profiles.service.ts`
  - `hotspot-ip-bindings.service.ts`
  - `hotspot-users.service.ts`
  - `hotspot-sync.service.ts`
  - `router-mappers.ts`

Frontend:

- casser `routers/[id]/page.tsx` en:
  - hooks `useRouterHotspotProfiles`, `useRouterIpBindings`, `useRouterHotspotUsers`
  - composants `HotspotProfilesSection`, `HotspotIpBindingsSection`, `HotspotUsersSection`, `RouterSyncCard`
  - state local isole par section

Backend:

- poursuivre `router-api.service.ts` vers:
  - extraction helpers health-check et lifecycle routeur
  - extraction circuit-breaker / push hotspot user
  - reduction de l'orchestrateur final sous le seuil ~900 lignes

API client:

- separer `frontend/src/lib/api.ts` en modules:
  - `api/auth.ts`
  - `api/routers.ts`
  - `api/metrics.ts`
  - `api/vouchers.ts`
  - `api/client.ts` (transport + refresh only)

### Phase 2 - Qualite non negociable

- installer et configurer lint frontend non interactif
- ajouter tests frontend:
  - 1 test composant pour IP bindings actions
  - 1 test composant pour changement profil user
  - 1 test auth reset (request + confirm form validation)

### Phase 3 - Securite auth

- activer vrai parcours 2FA login (TOTP)
- valider les variables email reset dans `configuration.ts`
- ajouter rate limit specifique reset password

## Conditions de release recommandees

Ne plus pousser en prod un lot "feature" sur routeurs/auth sans:

- backend tests OK
- frontend build + type-check OK
- lint frontend non interactif OK
- au moins un test frontend sur le parcours modifie

Sans ces garde-fous, les regressions terrain vont continuer.

## Revalidation execution (2026-03-24)

Checks relances sur le code courant:

- `npm test --workspace backend -- --runInBand`: OK (`14 suites`, `64 tests`)
- `npm run build --workspace backend`: OK
- `npm run type-check --workspace frontend`: OK
- `npm run build --workspace frontend`: OK
- `npm run lint --workspace frontend`: OK (non-interactif, zero warning/erreur)
- `npm run test --workspace backend -- --runInBand`: OK (`17 suites`, `72 tests`)
- `npm run test --workspace frontend`: OK (`3 suites`, `11 tests`)
- `npm run test --workspace backend -- --runInBand`: OK (`19 suites`, `74 tests`)
- `npm run build --workspace backend`: OK
- `npm run lint --workspace frontend`: OK
- `npm run test --workspace frontend -- --runInBand`: OK (`3 suites`, `12 tests`)
- `npm run build --workspace frontend`: OK
- `npm run test --workspace backend -- --runInBand`: OK (`21 suites`, `78 tests`)
- `npm run build --workspace backend`: OK
- `npm test --workspace backend -- --runInBand`: OK (`22 suites`, `80 tests`)
- `npm run build --workspace backend`: OK
- `npm run lint --workspace frontend`: OK
- `npm run test --workspace frontend`: OK (`3 suites`, `12 tests`)
- `npm run build --workspace frontend`: OK
- `npm test --workspace backend -- --runInBand`: OK (`22 suites`, `80 tests`)
- `npm run build --workspace backend`: OK
- `npm run lint --workspace frontend`: OK
- `npm run test --workspace frontend`: OK (`3 suites`, `12 tests`)
- `npm run build --workspace frontend`: OK
- `npm run lint --workspace frontend`: OK
- `npm run test --workspace frontend`: OK (`3 suites`, `12 tests`)
- `npm run build --workspace frontend`: OK

Statut delivery:

- GitHub: lots backend/frontend precedents synchronises, nouvelle passe de robustesse routeur validee localement
- VPS: verification automatique impossible depuis cet environnement (SSH batch refuse: `Permission denied`)

## Delta 2026-03-25

Revalidation apres correctif profils hotspot:

- `npm test --workspace backend -- --runInBand`: OK (`22 suites`, `81 tests`)
- `npm run build --workspace backend`: OK
- `npm test --workspace frontend`: OK (`3 suites`, `13 tests`)
- `npm run lint --workspace frontend`: OK
- `npm run build --workspace frontend`: OK

Impact modulaire reel:

- positif:
  - logique de catalogue profils deplacee dans `router-detail.selectors.ts`
  - logique backend d update profile rendue deterministe dans `router-hotspot-profiles.utils.ts`
- negatif:
  - `routers/[id]/page.tsx` reste a `1214` lignes
  - `router-api.service.ts` reste a `1005` lignes

Note honnete actualisee:

- etat global: autour de `7.5/10` a `8/10`
- verdict: encore insuffisant pour annoncer `9/10`

## Delta 2026-03-25 - auth session et overview extrait

Revalidation apres durcissement auth frontend et extraction du bloc overview:

- `npm test --workspace frontend`: OK (`4 suites`, `15 tests`)
- `npm run lint --workspace frontend`: OK
- `npm run build --workspace frontend`: OK

Impact modulaire reel:

- positif:
  - logique JWT/session isolee dans `frontend/src/lib/api/auth-session.ts`
  - `frontend/src/lib/api/client.ts` recentre sur le transport + refresh partage
  - bloc routeur overview/diagnostic extrait dans `frontend/src/app/(dashboard)/routers/[id]/router-overview-section.tsx`
  - `routers/[id]/page.tsx` tombe de `1214` a `975` lignes
- negatif:
  - `routers/[id]/page.tsx` reste encore trop gros pour un composant page unique
  - `router-api.service.ts` reste a `1120` lignes et demeure le vrai monolithe backend du domaine routeurs

Verdict honnete:

- amelioration concrete, pas cosmetique
- baisse attendue du bruit `401` frontend quand la session approche de l expiration
- note globale encore sous `9/10`, plutot autour de `8/10`

## Delta 2026-03-25 - hook de lecture routeur

Revalidation apres extraction des queries et derivees de lecture:

- `npm run lint --workspace frontend`: OK
- `npm test --workspace frontend`: OK (`4 suites`, `15 tests`)
- `npm run build --workspace frontend`: OK

Impact modulaire reel:

- positif:
  - `use-router-detail-data.ts` retire de `page.tsx` la lecture des donnees routeur, les permissions et les derivees de visualisation
  - `routers/[id]/page.tsx` descend de `975` a `806` lignes
- negatif:
  - `routers/[id]/page.tsx` reste encore un orchestrateur lourd a cause des mutations et du state local des modales/formulaires
  - `router-api.service.ts` reste a `1120` lignes

Verdict honnete:

- on se rapproche d un vrai `8/10`
- on n est toujours pas a `9/10`

## Delta 2026-03-25 - actions live/hotspot extraites

Revalidation apres extraction des workflows routeur:

- `npm run lint --workspace frontend`: OK
- `npm test --workspace frontend`: OK (`4 suites`, `17 tests`)
- `npm run build --workspace frontend`: OK

Impact modulaire reel:

- positif:
  - `routers/[id]/page.tsx` descend de `806` a `412` lignes
  - logique live/sync/health/sessions isolee dans `use-router-live-operations.ts`
  - logique hotspot (profiles, ip-bindings, modales, formulaires) isolee dans `use-router-hotspot-management.ts`
  - tri uptime corrige via parsing dedie des formats RouterOS
- negatif:
  - `use-router-hotspot-management.ts` reste encore trop gros (`526` lignes)
  - `router-api.service.ts` reste a `1120` lignes

Verdict honnete:

- progression reelle vers un frontend senior plus propre
- score engineering frontend autour de `8/10`
- score UI/UX reste nettement plus bas que le score technique
- toujours pas `9/10`

## Delta 2026-03-25 - backend routeurs decoupe par operations + front routeur guide par sections

Revalidation apres decoupage hotspot backend et simplification UX de la page routeur:

- `npm test --workspace backend -- --runInBand`: OK (`22 suites`, `81 tests`)
- `npm run build --workspace backend`: OK
- `npm run lint --workspace frontend`: OK
- `npm test --workspace frontend`: OK (`4 suites`, `17 tests`)
- `npm run build --workspace frontend`: OK

Impact modulaire reel:

- positif:
  - `backend/src/modules/routers/router-api.service.ts` tombe de `1120` a `690` lignes
  - extraction hotspot backend dans:
    - `router-hotspot-profiles.operations.ts`
    - `router-hotspot-ip-bindings.operations.ts`
    - `router-hotspot-users.operations.ts`
    - `router-operations.types.ts`
  - `frontend/src/app/(dashboard)/routers/[id]/use-router-hotspot-management.ts` tombe de `526` a `485` lignes
  - `frontend/src/app/(dashboard)/routers/[id]/page.tsx` reste compacte (`417` lignes) et ne montre plus toutes les zones operateur simultanement
  - la page routeur charge maintenant ses zones lourdes de facon plus ciblee:
    - `IP bindings` seulement quand la section est ouverte
    - `plans` seulement quand la section `Profils` est ouverte
    - `utilisateurs hotspot` seulement pour les vues qui en ont reellement besoin
- negatif:
  - `backend/src/modules/metrics/metrics.service.ts` devient maintenant un des pires monolithes restants
  - `frontend` reste en dessous de `9/10` sur l UX parce que le design reste encore tres operationnel/technique
  - `use-router-hotspot-management.ts` reste un hook encore trop gros pour une finition senior totale

Verdict honnete actualise:

- modularite globale: autour de `8/10`
- engineering frontend: autour de `8.5/10`
- UI/UX produit: autour de `6.5/10` a `7/10`
- verdict: nette progression, toujours pas `9/10`

## Delta 2026-03-25 - hook hotspot casse en sous-hooks + catalogue profils robuste

Revalidation apres decoupage final du wrapper hotspot frontend:

- `npm test --workspace backend -- --runInBand`: OK (`22 suites`, `81 tests`)
- `npm run build --workspace backend`: OK
- `npm run lint --workspace frontend`: OK
- `npm test --workspace frontend`: OK (`4 suites`, `18 tests`)
- `npm run build --workspace frontend`: OK

Impact modulaire reel:

- positif:
  - `frontend/src/app/(dashboard)/routers/[id]/use-router-hotspot-management.ts` tombe de `485` a `29` lignes
  - la gestion hotspot est maintenant separee en:
    - `use-hotspot-profile-change.ts`
    - `use-hotspot-ip-bindings-management.ts`
    - `use-hotspot-profile-config-management.ts`
  - la logique d ouverture des modales devient plus explicite et moins dependante d effets implicites
  - les forfaits SaaS sont maintenant charges meme hors section `Profils`, ce qui rend le catalogue de profils plus fiable dans les flux de changement de profil
- negatif:
  - `use-hotspot-ip-bindings-management.ts` reste encore assez dense
  - `backend/src/modules/routers/router-api.service.ts` reste a `690` lignes
  - le score UX reste encore bien en dessous du score engineering

Verdict honnete actualise:

- modularite frontend: autour de `8.7/10`
- modularite globale: autour de `8.2/10`
- verdict: solide progression senior, toujours pas `9/10`

## Delta 2026-03-25 - lifecycle routeur extrait + helpers metrics sortis du service

Revalidation apres decoupage backend routeur et refactor modulaire metrics:

- `npm test --workspace backend -- --runInBand`: OK (`25 suites`, `88 tests`)
- `npm run build --workspace backend`: OK
- `npm run lint --workspace frontend`: OK
- `npm test --workspace frontend`: OK (`4 suites`, `18 tests`)
- `npm run build --workspace frontend`: OK

Impact modulaire reel:

- positif:
  - `backend/src/modules/routers/router-api.service.ts` tombe de `690` a `607` lignes
  - extraction backend routeur vers:
    - `router-hotspot-delivery.operations.ts`
    - `router-hotspot-writes.operations.ts`
    - `router-health.operations.ts`
    - `router-legacy-ticket.operations.ts`
  - `backend/src/modules/metrics/metrics.service.ts` tombe de `1719` a `1193` lignes
  - le service metrics garde maintenant surtout l orchestration et delegue ses helpers purs a `metrics.service.helpers.ts`
  - la modal `hotspot-ip-binding-modal.tsx` devient plus operateur-friendly:
    - choix de type plus explicite
    - champs avances repliables
    - validation plus claire sur IP/MAC
- negatif:
  - `backend/src/modules/vouchers/voucher.service.ts` reste maintenant le plus gros monolithe du backend
  - `metrics.service.ts` reste encore trop volumineux pour une vraie note `9.5/10`
  - `use-hotspot-ip-bindings-management.ts` reste encore dense cote frontend
  - le design/UX global n a pas encore le niveau premium attendu

Verdict honnete actualise:

- modularite backend: autour de `8.4/10`
- modularite frontend: autour de `8.8/10`
- modularite globale: autour de `8.4/10`
- verdict: on monte clairement en niveau senior, mais on n est toujours pas a `9.5/10`

## Delta 2026-03-25 - `resellers` et `routers` convertis en cockpits modulaires

Revalidation apres refonte frontend des ecrans les plus commerciaux:

- `npm run lint --workspace frontend`: OK
- `npm test --workspace frontend`: OK (`8 suites`, `32 tests`)
- `npm run build --workspace frontend`: OK

Impact modulaire reel:

- positif:
  - `frontend/src/app/(dashboard)/resellers/page.tsx` tombe de `952` a `185` lignes
  - `frontend/src/app/(dashboard)/routers/page.tsx` tombe de `891` a `159` lignes
  - orchestration de page sortie vers:
    - `frontend/src/app/(dashboard)/resellers/use-resellers-page.ts`
    - `frontend/src/app/(dashboard)/routers/use-routers-page.ts`
  - nouvelles sections dediees:
    - `resellers-directory-section.tsx`
    - `reseller-create-modal.tsx`
    - `reseller-access-modal.tsx`
    - `reseller-profile-modal.tsx`
    - `router-form-panel.tsx`
    - `routers-fleet-section.tsx`
    - `routers-filter-panel.tsx`
    - `routers-bulk-actions-bar.tsx`
  - les ecrans passent d un rendu "table/listing brut" a un vrai modele de cockpit oriente decision
- negatif:
  - la modularite frontend devient forte sur ces 2 ecrans, mais le reste du dashboard n est pas encore au meme niveau
  - la qualite design/UX n est pas uniformement premium sur toutes les routes

Verdict honnete actualise:

- modularite frontend: autour de `9.1/10`
- modularite globale: autour de `8.7/10`
- verdict: vraie progression senior, toujours pas `9.8/10` produit global

## Delta 2026-03-25 - detail routeur durci contre la latence reelle RouterOS

Revalidation apres durcissement backend/frontend des lectures routeur:

- `npm test --workspace backend -- --runInBand`: OK (`26 suites`, `97 tests`)
- `npm run build --workspace backend`: OK
- `npm run lint --workspace frontend`: OK
- `npm test --workspace frontend`: OK (`8 suites`, `33 tests`)
- `npm run build --workspace frontend`: OK

Impact modulaire reel:

- positif:
  - `backend/src/modules/routers/router-api.service.ts` garde un coeur plus lisible tout en assumant maintenant des politiques de timeout distinctes
  - la traduction des erreurs RouterOS devient explicite au lieu de laisser fuiter un `500` generique
  - `frontend/src/app/(dashboard)/routers/[id]/use-router-detail-data.ts` se comporte enfin comme un orchestrateur produit:
    - retry limite
    - `placeholderData`
    - lecture `users` seulement quand elle est vraiment utile
  - la navigation detail routeur ne ment plus avec des `0` silencieux sur donnees indisponibles
- negatif:
  - `backend/src/modules/routers/router-api.service.ts` remonte a `828 lignes` car la politique timeout/erreurs y a ete reintegree pour corriger vite la prod
  - le detail routeur reste encore un agregat fonctionnel dense
  - la resilience UX progresse plus vite que l identite visuelle globale du produit

Verdict honnete actualise:

- modularite backend: autour de `8.5/10`
- modularite frontend: autour de `9.2/10`
- modularite globale: autour de `8.8/10`
- verdict: plus fiable et plus senior, mais toujours pas `9.8/10` produit
