# Audit Complet - Etat Actuel

Date: 2026-03-14

## Resume executif

MikroServer a aujourd'hui un bon socle SaaS pour une V1 terrain:

- gestion routeur MikroTik
- generation et verification de tickets
- PDF ticket configurable
- suivi des sessions
- reporting basique
- gestion revendeur de premier niveau

Le produit est deja utile pour l'exploitation hotspot, mais il n'est pas encore au niveau des meilleurs acteurs du marche sur:

- permissions fines et administration multi-niveaux
- supervision proactive et alertes
- multi-site et operations de masse
- hygiene securite des secrets et des sessions admin
- maintenance prod et resilence des deploiements

## Surface produit actuelle

### Back-office web

Present dans le front:

- login admin
- dashboard
- plans
- revendeurs
- routeurs
- sessions
- parametres
- transactions
- tickets
- generation de tickets
- stock tickets
- verification tickets
- portail public `portal`
- analytics

### API backend

Modules presents:

- auth
- health
- metrics
- payments
- plans
- queue
- routers
- sessions
- settings
- transactions
- users
- vouchers
- webhooks
- audit

## Points forts

### 1. Exploitation terrain deja credible

- verification de tickets legacy cote routeur
- suivi des clients actifs sur le routeur
- PDF tickets avec options de presentation
- suppression unitaire et suppression en lot de maniere sure
- distinction utile entre tickets prets, utilises, problematiques

### 2. Integration routeur plus robuste qu'au debut

- `live-stats` fonctionnel
- `health-check` fonctionnel
- synchronisation sessions/vouchers en place
- meilleure visibilite des erreurs de sync

### 3. Base produit saine pour itérer

- monorepo clair
- backend NestJS + Prisma
- frontend Next.js propre
- tests cibles deja presents sur vouchers/PDF
- configuration centralisee via `SystemConfig`

## Faiblesses et risques

### Critique

#### Secrets stockes en clair ou semi-clair

Le schema garde encore:

- `Router.apiPasswordHash`
- `Voucher.passwordPlain`

Ces champs sont necessaires au flux actuel, mais restent un risque fort en cas de fuite DB.

Impact:

- exposition des acces routeur
- exposition des tickets non encore vendus

#### Tokens admin accessibles au JavaScript

Le front stocke encore `access_token` et `refresh_token` via cookies lisibles JS.

Impact:

- si une XSS touche le dashboard, la session admin peut etre volee

#### Paiement encore trop intrusif dans le demarrage global

Incident observe en prod:

- l'API a boucle au demarrage a cause d'un `WAVE_WEBHOOK_SECRET` trop court
- ensuite les credentials DB/Redis de `.env.prod` ne correspondaient plus aux conteneurs en cours

Impact:

- indisponibilite complete du SaaS alors que la partie paiement n'est pas prioritaire

### Eleve

#### Permissions encore trop grossieres

Le produit a aujourd'hui des roles globaux:

- `SUPER_ADMIN`
- `ADMIN`
- `RESELLER`
- `VIEWER`

Mais pas encore de permissions fines par domaine:

- tickets
- plans
- routeurs
- exports
- rapports
- support
- maintenance

#### Historique tickets encore incomplet pour le pilotage

Le cycle de vie est meilleur qu'avant, mais il manque encore:

- archivage clair
- suppression automatique des tickets selon regles
- vue "pourquoi ce ticket a ete refuse ou bloque"
- workflows de nettoyage de stock

#### Observabilite inegale

- pas de centre d'incidents unifie
- pas d'alertes email/SMS natives
- pas de tableau d'etat d'exploitation global multi-site

### Moyen

#### Reporting encore trop leger

Le reporting actuel couvre:

- tickets crees
- actives
- termines
- supprimes
- montant active

Il manque encore:

- rapports par routeur
- rapports par revendeur
- rapports planifies
- export PDF/CSV de rapports plus riches
- suivi des incidents et du taux d'echec delivery

#### Portail public encore basique

Le SaaS a maintenant un portail public et une page de verification interne, mais il manque:

- parcours client plus riche
- templates captive portal
- personnalisation avancee multi-site
- collecte marketing / consentement / sondages

#### Hygiene docs/exploitation a renforcer

Le projet a de la documentation, mais elle etait encore eparse jusqu'ici:

- peu de docs de maintenance exploitable au quotidien
- peu de cadrage V1.2 / V2
- risque d'oubli des secrets reels apres incident

## Etat fonctionnel par domaine

### Tickets

Etat:

- bon

Deja present:

- generation bulk
- PIN ou user/password
- longueur configurable
- prefixe
- verification interne
- verification legacy cote routeur
- export PDF / CSV
- stock
- suppression sure unitaire
- suppression sure en lot

Manque encore:

- archivage/cleanup automatise
- import ou retro-synchronisation des tickets historiques
- lots plus visibles avec notion de batch exploitable
- etiquettes ou tags de lot

### Plans

Etat:

- correct

Deja present:

- CRUD
- duree
- prix
- bande passante
- options ticket

Manque encore:

- edition plus riche type MikroTicket
- plan paused time vs elapsed time exploite jusqu'au routeur
- quotas avances
- profils de plan reutilisables

### Routeurs

Etat:

- correct a bon

Deja present:

- CRUD routeur
- health-check
- live-stats
- sync
- detail routeur

Manque encore:

- actions d'exploitation plus nombreuses
- alertes routeur offline
- regroupement multi-site / tags
- provisioning/diagnostic plus pousse

### Revendeurs / Operateurs

Etat:

- utile mais incomplet

Deja present:

- users/revendeurs de base
- perimetre revendeur sur tickets

Manque encore:

- permissions fines
- profils operateur
- audit detaille des actions operateur
- restrictions par routeur, par plan ou par site

### Reporting

Etat:

- debut solide, encore insuffisant

### Paiement

Etat:

- volontairement hors focus produit immediat

Attention:

- la configuration paiement ne doit pas casser le reste de la plateforme

## References marche utilisees pour l'audit

Set de reference officiel:

- Tanaza: [WiFi multi-tenant](https://www.tanaza.com/wifi-multi-tenant/)
- Purple: [Guest WiFi Connect](https://www.purple.ai/guest-wifi/connect)
- Purple: [Staff WiFi](https://www.purple.ai/guest-wifi/staff-wifi)
- Cloud4Wi: [WiFi Access / enterprise dashboard](https://cloud4wi.zendesk.com/hc/en-us/articles/360040464011-WiFi-Access)
- Cloud4Wi: [Captive portal](https://info.cloud4wi.com/captive-portal)
- IronWiFi: [Vouchers](https://help.ironwifi.com/portal/en/kb/articles/vouchers)
- IronWiFi: [REST API](https://help.ironwifi.com/api/rest-api)
- Sophos: [Manage vouchers](https://docs.sophos.com/nsg/sophos-firewall/22.0/Help/en-us/webhelp/onlinehelp/VPNAndUserPortalHelp/UserPortal/Hotspots/HotspotTypeVoucher/HotspotsVoucherManage/)
- HotspotSystem: [Printing preferences](https://help.hotspotsystem.com/knowledgebase/how-to-print-vouchers-printing-preferences)
- StayFi: [WiFi management](https://stayfi.com/wifi-management/)
- StayFi: [Dynamic occupancy alerting](https://stayfi.com/dynamic-occupancy-alerting/)
- ANTlabs: [Cloud managed guest WiFi](https://www.antlabs.com/acs/)

## Conclusion

Le produit est deja dans une bonne zone "V1 operationnelle terrain", mais il faut cadrer la V1.2 autour de quatre axes:

1. securite et resilence d'exploitation
2. permissions et delegation
3. supervision / alertes / rapports
4. multi-site et operations de masse

Sans ces axes, la V2 risque d'empiler des fonctionnalites sur une base encore fragile en prod.
