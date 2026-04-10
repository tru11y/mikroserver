# V4.5 - Blueprint "Best Solutions" + IA Open Source

Date: 2026-03-23

## Objectif

Aligner MikroServer V4.5 avec les meilleurs standards SaaS WiFi/ISP sur 5 axes:

1. pilotage commercial journalier (abonnements, renouvellements, churn)
2. gestion utilisateurs fiable (profil, edition, permissions, audit)
3. recommandations actionnables (clients/plans recurrents, priorites du jour)
4. tarification assistee par IA avec validation admin en cas d'incertitude
5. operations robustes (dashboard clair + decision rapide)

## Ecart actuel vs solutions du marche

## Ce que les meilleurs produits ont deja

- tableau de bord "today" (nouveaux abonnements, expirations du jour, alertes churn)
- segmentation clients (top clients, clients en baisse, clients a relancer)
- intelligence produit/prix (plans les plus vendus, marge, recommandations)
- workflows operationnels avec confiance IA + validation humaine
- UX explicite sur les erreurs permissions/API (pas d'ecran vide silencieux)

## Ce qu'il faut completer chez nous en V4.5

- analytics abonnements daily/weekly pretes a l'emploi
- recommendations automatiques pour l'admin (clients/plans)
- moteur tarifaire prefixe -> prix propose + score de confiance
- file de validation admin pour les cas ambigus
- API/UX unifiees pour la gestion profil utilisateur

## Scope V4.5 propose (priorise)

## P0 - Fiabilite gestion utilisateurs

- corriger les cas "manage sans view" pour eviter le blocage de consultation
- afficher les erreurs API/droits directement dans l'ecran users/resellers
- garantir edition profil + reset mot de passe sur les comptes eligibles

Resultat attendu:
- plus de "liste vide" sans explication
- edition profil operationnelle avec message clair en cas de droit manquant

## P1 - Cockpit abonnements "Today"

Ajouter des KPIs et listes actionnables:

- abonnements commences aujourd'hui
- forfaits qui expirent aujourd'hui
- top clients recurrents (30j/90j)
- top forfaits recurrents (30j/90j)

Resultat attendu:
- l'admin sait quoi traiter immediatement sans requete manuelle

## P1 - Recommandations IA open source

Generer quotidiennement:

- clients a risque (renouvellement probable faible)
- clients prioritaires a relancer
- forfaits recommandes par segment
- suggestions de promo/cross-sell

Regle produit:
- chaque recommandation doit inclure "pourquoi" + niveau de confiance

## P1 - Tarification par prefixe avec validation admin

Flux cible:

1. le systeme detecte le prefixe (ex: operateur/zone)
2. propose un tarif base sur historique similaire
3. applique auto si confiance >= seuil
4. sinon cree une demande de confirmation admin

Metadonnees min:
- prefixe detecte
- prix propose
- confiance (0-1)
- raisons principales
- decision finale (auto/manuel) + audit trail

## Architecture IA open source recommandee

## Donnees

- source primaire: PostgreSQL (transactions, subscriptions, users, plans)
- vues materialisees daily:
  - `mv_subscriptions_today`
  - `mv_expiring_today`
  - `mv_top_clients_30d`
  - `mv_top_plans_30d`
  - `mv_prefix_price_history`

## Moteur IA

- service dedie (FastAPI ou Nest microservice)
- modele open source LLM pour explications/recommandations:
  - `Qwen2.5-7B-Instruct` (ou equivalent)
- modele tabulaire pour scoring (churn/prix):
  - `LightGBM` ou `XGBoost`

Pattern:
- modele tabulaire calcule score/confiance
- LLM transforme en recommandation lisible + justification

## Gouvernance et securite

- aucune decision tarifaire "silencieuse" sous seuil de confiance
- journal d'audit complet (input, score, decision, acteur)
- fallback deterministic si service IA indisponible

## Endpoints V4.5 a ajouter

- `GET /api/v1/metrics/subscriptions/today`
- `GET /api/v1/metrics/subscriptions/expiring-today`
- `GET /api/v1/metrics/subscriptions/top-clients?window=30d`
- `GET /api/v1/metrics/subscriptions/top-plans?window=30d`
- `GET /api/v1/recommendations/daily`
- `POST /api/v1/pricing/prefix/resolve`
- `POST /api/v1/pricing/prefix/confirm`

## UX V4.5 a livrer

- widget "Aujourd'hui" sur dashboard
- section "Recommandations IA" avec filtres (impact/confiance)
- file "Validation admin requise" pour les tarifs incertains
- historique decisions IA/admin exportable

## Definition de done V4.5 (business + technique)

- backend build OK
- frontend build + type-check OK
- tests cibles:
  - users/resellers
  - metrics/subscriptions
  - pricing IA decision policy
- smoke VPS:
  - `/api/v1/health/live`
  - login admin
  - dashboard + nginx healthy
- preuves fonctionnelles:
  - liste expirations du jour visible
  - top clients/plans visible
  - recommandation IA generee avec confiance
  - cas confiance faible -> validation admin obligatoire
