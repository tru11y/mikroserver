# Audit Frontend / UI-UX - 2026-03-25

## Verdict global

- note frontend engineering: `8/10`
- note UI/UX produit: `6/10`
- note design visuel: `6.5/10`
- note accessibilite/clarte operationnelle: `5/10`

Conclusion franche:

- le frontend n est plus dans un etat amateur pur
- il reste cependant trop dense, trop technique et pas encore assez guide pour un usage operations terrain
- on peut dire "correct et en progression", pas "senior finalise" ni "9/10"

## Points forts

- base visuelle coherentente:
  - palette, cards, badges et tables restent globalement coherents
- feedback systeme present:
  - loaders, erreurs, badges de statut et actions critiques existent
- modularite frontend en nette progression:
  - `routers/[id]/page.tsx` est descendue a `412` lignes
  - la lecture des donnees, les actions live et la gestion hotspot sont maintenant separees en hooks/composants
- logique produit plus honnete:
  - les etats fallback sont expliques au lieu de masquer le manque de donnees

## Faiblesses severes

- information architecture encore trop lourde:
  - la page routeur empile beaucoup de blocs metier complexes sur le meme ecran
  - la densite reste forte pour un operateur non technique
- vocabulaire encore trop Winbox/API:
  - `rate-limit`, `shared-users`, `address-pool`, `to-address`, `address-list`, `blocked`, `bypassed`
  - peu d aide inline traduit l impact metier reelle de ces champs
- parcours utilisateur trop peu guide:
  - plusieurs actions critiques reposent encore sur la comprehension du modele MikroTik
  - il manque des garde-fous et du contexte avant l execution de certaines operations
- tables tres denses:
  - surcharge cognitive notable dans `Profils`, `IP bindings`, `Clients connectes`, `Utilisateurs hotspot`
  - mobile et petits ecrans restent fragiles a cause des tableaux larges
- accessibilite encore insuffisante:
  - pas d evidence visible de focus state fort, de hierarchie ARIA ou de navigation clavier verifiee
  - beaucoup d informations de statut reposent encore fortement sur la couleur

## Dysfonctionnements / risques UX identifies

- avant correction, le tri `duree` des clients connectes etait faux car base sur une comparaison de chaines
- le changement de profil pouvait proposer un faux non-changement vers le profil actuel
- la recherche utilisateur hotspot etait fonctionnelle mais restait rigide visuellement sur largeur reduite
- les modales restent tres techniques et proches des structures RouterOS brutes
- les messages d erreurs/timeouts sont utiles mais encore trop "systeme" et pas assez orientee action

## Priorites P0

- terminer le decoupage du workflow routeur pour sortir les dernieres orchestration/metiers lourdes du composant page
- introduire de l aide inline orientee usage:
  - "ce champ sert a..."
  - "impact attendu sur le client..."
- clarifier la hierarchie de la page:
  - vue supervision
  - actions live
  - configuration hotspot
  - maintenance avancee
- reduire l exposition immediate des details tres techniques par defaut

## Priorites P1

- remplacer certaines tables par des vues plus compactes ou filtrables
- ajouter des compteurs/resultats plus visibles sur la recherche utilisateur
- revoir la copie produit pour parler davantage en langage operateur qu en langage RouterOS
- renforcer l accessibilite clavier/focus/labels

## Note honnete finale

- engineering frontend: `8/10`
- UI/UX: `6/10`
- design: `6.5/10`
- verdict global frontend produit: `7/10`

Ce n est pas encore la finition senior finale. C est une base deja plus serieuse, mais il reste du travail net avant de pouvoir annoncer un vrai `9/10`.

## Addendum 2026-03-25 - navigation par sections

Evolution apres simplification de la page routeur:

- ajout d une navigation par sections sur le detail routeur
- l ecran ne presente plus simultanement `Clients connectes`, `Utilisateurs hotspot`, `Profils` et `IP bindings`
- certaines requetes lourdes ne se chargent plus tant que la section n est pas ouverte

Impact honnete:

- UI/UX produit: monte a `6.5/10`
- accessibilite / clarte operationnelle: monte a `6/10`
- frontend global produit: monte autour de `7.5/10`

Ce que cela ne regle pas encore:

- le vocabulaire reste encore tres technique
- les modales restent proches du modele RouterOS
- le design visuel reste propre mais pas encore memorisable ni "senior premium"

## Addendum 2026-03-25 - visibilite des fonctions de gestion

Correction produit ajoutee:

- la gestion de profil pouvait etre percue comme "disparue" quand seule une section etait visible
- la page ouvre maintenant par defaut sur la zone `Recherche utilisateur hotspot`
- un bloc `Acces rapide hotspot` garde visibles les 4 parcours clefs:
  - changer un profil
  - agir sur les connectes
  - gerer les profils
  - gerer les IP bindings

Impact honnete:

- clarte operationnelle: monte a `6.5/10`
- UI/UX routeur: monte a `7/10`
- frontend global produit: monte autour de `7.8/10`

Verdict:

- nettement mieux pour un operateur terrain
- toujours pas `9/10`

## Addendum 2026-03-25 - gestion de profil robuste

Correction structurelle ajoutee:

- le catalogue de profils pour changement de profil ne depend plus du passage par la section `Profils`
- les forfaits SaaS sont charges meme quand l operateur agit depuis `Clients connectes` ou `Recherche utilisateur hotspot`
- le gros hook hotspot a ete casse en sous-hooks explicites:
  - `use-hotspot-profile-change.ts`
  - `use-hotspot-ip-bindings-management.ts`
  - `use-hotspot-profile-config-management.ts`
- les modales hotspot ne reposent plus autant sur des effets implicites de synchronisation d etat

Impact honnete:

- engineering frontend: monte a `8.5/10`
- robustesse parcours "changer un profil": monte a `8/10`
- frontend global produit: monte autour de `8/10`

Ce qui manque encore pour un vrai `9/10`:

- mieux hiérarchiser les sections et les priorites visuelles
- rendre les formulaires IP bindings moins techniques pour un operateur terrain
- finir le lissage de la copie produit et des aides inline

## Addendum 2026-03-25 - cockpit analytics + headers securite

Correction structurelle ajoutee:

- `frontend/next.config.js` applique maintenant des headers web defensifs:
  - `Content-Security-Policy`
  - `X-Frame-Options`
  - `X-Content-Type-Options`
  - `Referrer-Policy`
  - `Permissions-Policy`
  - `Cross-Origin-Opener-Policy`
  - `Cross-Origin-Resource-Policy`
- `frontend/src/app/(dashboard)/analytics/page.tsx` passe de `966` a `77 lignes`
- l ecran analytics est maintenant casse en sections explicites:
  - overview
  - abonnements
  - recommandations
  - rapport tickets
  - courbes
- les filtres rapport utilisent une valeur differee avant refetch, ce qui rend l ecran plus fluide
- la navigation interne par ancres reduit la sensation de page "mur de blocs"
- `globals.css` apporte maintenant:
  - `focus-visible` plus fort
  - `scroll-behavior` plus propre
  - respect de `prefers-reduced-motion`

Impact honnete:

- engineering frontend: monte a `8.9/10`
- UI/UX produit: monte a `7.4/10`
- design visuel: monte a `7.4/10`
- accessibilite / clarte operationnelle: monte a `6.8/10`
- frontend global produit: monte autour de `8.3/10`

Ce que cela ne regle toujours pas:

- l auth frontend repose encore sur des cookies lisibles JS, donc la securite n est pas encore au niveau maximal
- `resellers/page.tsx` et `routers/page.tsx` restent des gros blocs trop denses
- le design global reste propre et plus structure, mais pas encore distinctif ni premium `9.5+`
- l accessibilite n est pas encore suffisamment prouvee par des tests clavier/ARIA systematiques

## Addendum 2026-03-25 - refonte `resellers` + `routers`

Refonte structurelle ajoutee:

- `frontend/src/app/(dashboard)/resellers/page.tsx` passe de `952` a `185 lignes`
- `frontend/src/app/(dashboard)/routers/page.tsx` passe de `891` a `159 lignes`
- extraction d orchestration vers:
  - `resellers/use-resellers-page.ts`
  - `routers/use-routers-page.ts`
- les anciens tableaux denses deviennent des cockpits a sections:
  - hero
  - filtres plus lisibles
  - annuaire/flotte en cartes
  - actions sensibles mieux exposees
  - modales unifiees via `dashboard-modal-shell.tsx`
- gains accessibilite/clarte:
  - dialogues avec `role="dialog"` et `aria-modal`
  - boutons d action plus explicites qu une simple icone
  - recherche visible et resultats assumes comme une fonction de premier plan
  - hierarchie visuelle plus forte sur les ecrans les plus critiques commercialement

Impact honnete:

- engineering frontend: monte autour de `9.1/10`
- UI/UX produit: monte autour de `8.2/10`
- design visuel: monte autour de `8.3/10`
- accessibilite / clarte operationnelle: monte autour de `7.6/10`
- frontend global produit: monte autour de `8.8/10`

Ce qui manque encore pour un vrai `9.8/10`:

- donner une identite visuelle encore plus memorable a l ensemble de la plateforme, pas seulement a `resellers` et `routers`
- etendre ce niveau de finition a `vouchers`, `transactions`, `sessions`, `settings`
- prouver l accessibilite par plus de tests dedies clavier/ARIA, pas seulement par de meilleures pratiques
- renforcer encore la securite session frontend, qui reste sous le maximum tant que certains flux reposent sur des cookies lisibles JS

## Addendum 2026-03-25 - detail routeur plus robuste en maintenance / latence reelle

Correction structurelle ajoutee:

- la page detail routeur traite maintenant les lectures RouterOS lentes comme un cas normal de prod, pas comme une erreur "impossible a expliquer"
- le backend routeur differencie plusieurs budgets de timeout:
  - `health`
  - `live`
  - `heavy-read`
  - `write`
- les sections frontend n affichent plus des `0` silencieux quand la donnee est indisponible:
  - badge `!` sur les sections en erreur
  - dernier count live connu reutilise quand possible
  - lecture `utilisateurs hotspot` declenchee seulement a partir d une vraie recherche en vue `users`
- la dropdown de changement de profil reintegre explicitement le profil courant si le catalogue charge est partiel
- les requetes detail routeur conservent mieux leur dernier etat utile via `placeholderData` + retry limite

Impact honnete:

- robustesse percue detail routeur: monte autour de `8.7/10`
- clarte operationnelle en incident: monte autour de `8.2/10`
- frontend global produit: monte autour de `9/10`

Ce que cela ne regle toujours pas:

- si le routeur ou le tunnel WireGuard est vraiment indisponible longtemps, on restera en mode degrade et non en mode "magique"
- le design global produit reste encore en dessous d un vrai `9.8/10` tant que `vouchers`, `transactions`, `sessions` et `settings` n ont pas recu la meme finition
- la securite session frontend reste serieuse mais pas maximale tant que certains cookies restent lisibles JS
