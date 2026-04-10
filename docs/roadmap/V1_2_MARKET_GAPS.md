# V1.2 - Quoi Ajouter ou Ameliorer

Date: 2026-03-14

## Positionnement

La V1 existe deja comme base exploitable hotspot. La V1.2 doit la rendre plus solide, plus delegable et plus proche des meilleures pratiques du marche, sans basculer encore dans une V2 lourde.

## References marche

Set de reference officiel utilise:

- Tanaza: [centralized management, monitoring, alerts, zero-touch](https://www.tanaza.com/wifi-multi-tenant/)
- Purple Connect: [guest WiFi, analytics, splash pages, languages](https://www.purple.ai/guest-wifi/connect)
- Purple Staff WiFi: [audit trail, multi-site, centralized policy, role-driven security](https://www.purple.ai/guest-wifi/staff-wifi)
- Cloud4Wi: [multi-location management, tags, role-based management, white label](https://cloud4wi.zendesk.com/hc/en-us/articles/360040464011-WiFi-Access)
- Cloud4Wi Captive Portal: [custom portal, APIs, webhooks, surveys, promos](https://info.cloud4wi.com/captive-portal)
- IronWiFi: [voucher attributes, devices used, APIs, analytics](https://help.ironwifi.com/portal/en/kb/articles/vouchers)
- Sophos: [bulk delete/export vouchers, auto-delete](https://docs.sophos.com/nsg/sophos-firewall/22.0/Help/en-us/webhelp/onlinehelp/VPNAndUserPortalHelp/UserPortal/Hotspots/HotspotTypeVoucher/HotspotsVoucherManage/)
- HotspotSystem: [printing preferences and filtering not-activated tickets](https://help.hotspotsystem.com/knowledgebase/how-to-print-vouchers-printing-preferences)
- StayFi: [outage alerts, occupancy alerts, unified guest data](https://stayfi.com/wifi-management/)
- ANTlabs: [multi-level admin, notifications, scheduled reports](https://www.antlabs.com/acs/)

## Recommandation produit

La V1.2 doit viser le "meilleur 20-30%" des besoins terrain et d'exploitation, pas encore la V2 complete.

## Priorite 1 - A faire en premier

### 1. Permissions fines et profils operateur

Pourquoi:

- MikroTicket et plusieurs plateformes serieuses poussent la delegation metier
- aujourd'hui les roles globaux sont trop larges

A ajouter:

- permissions par domaine:
  - voir tickets
  - creer tickets
  - supprimer tickets
  - verifier tickets
  - voir plans
  - gerer plans
  - voir routeurs
  - lancer health-check
  - exporter PDF/CSV
  - voir rapports
- profils predefinis:
  - caissier
  - superviseur
  - technicien
  - revendeur

### 2. Alertes et centre d'incidents

Pourquoi:

- Tanaza et StayFi mettent la supervision proactive au centre

A ajouter:

- routeur offline
- echec delivery ticket
- echec sync
- queue backlog
- healthcheck rouge
- centre d'incidents simple dans le dashboard

### 3. Rapports d'exploitation plus riches

Pourquoi:

- les meilleurs outils ont des rapports filtres par site, operateur, plan et periode

A ajouter:

- rapports par routeur
- rapports par revendeur
- export CSV/PDF
- resume quotidien
- tickets refuses / rates / echec delivery

## Priorite 2 - A faire ensuite

### 4. Multi-site et operations de masse

Pourquoi:

- Tanaza, Cloud4Wi et Purple valorisent la gestion centralisee multi-sites

A ajouter:

- tags de routeurs
- groupes de routeurs
- filtres multi-site
- actions groupées sur plusieurs routeurs ou plusieurs tickets

### 5. Ticket lifecycle plus mature

A ajouter:

- archivage des tickets termines
- suppression automatique configurable des tickets expirés
- conservation d'historique claire
- batches/lots de tickets avec identifiant de lot

### 6. Impression et ticket settings avancés

A ajouter:

- presets par imprimante ou par point de vente
- modele thermique
- variantes de mise en page
- logo par site
- QR optionnel deja present, a pousser jusqu'aux presets

## Priorite 3 - Optionnel V1.2 selon temps

### 7. Captive portal et templates

Pourquoi:

- Cloud4Wi, Purple et Tanaza mettent fortement en avant les portails et templates

A ajouter:

- galerie de templates
- personnalisation par routeur/site
- publication plus simple
- apercu mobile

### 8. Maintenance et resilence

A ajouter:

- healthcheck frontend plus fiable
- page interne de statut plateforme
- sauvegarde/restore mieux documentes
- smoke tests de deploiement standardises

## Ce qu'il faut eviter en V1.2

- reouvrir un gros chantier paiement
- lancer une V2 mobile complete sans finir les permissions et la supervision
- toucher le routeur prod sans plan de rollback documente
- ajouter trop de modules marketing avant d'avoir un socle ops solide

## Proposition de lot V1.2

### Lot 1

- permissions fines
- profils operateur
- audit des actions critiques

### Lot 2

- centre d'incidents
- alertes routeur / sync / delivery
- healthchecks plus lisibles

### Lot 3

- rapports avances
- exports plus propres
- resume quotidien

### Lot 4

- multi-site
- tags
- operations de masse

## Verdict

La V1.2 ne doit pas chercher a battre les leaders sur le marketing ou l'OpenRoaming tout de suite.

Le meilleur retour terrain viendra de:

1. permissions
2. supervision
3. reporting
4. multi-site

C'est la meilleure base avant de passer a une vraie V2 plus ambitieuse.
