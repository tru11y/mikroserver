# Documentation MikroServer

Ce repertoire centralise l'etat du produit, l'exploitation de la plateforme, et la roadmap.

## Structure

- `ARCHITECTURE.md`
  - Vue technique generale du projet.
- `RUNBOOK_MVP_VPS_MIKROTIK.md`
  - Notes historiques de mise en place VPS + MikroTik.
- `audit/CURRENT_STATE_2026-03-14.md`
  - Audit produit et technique complet a date.
- `audit/MODULARITY_AUDIT_2026-03-24.md`
  - Audit modulaire sans complaisance: dette technique, zones critiques, et plan de decoupage prioritaire.
- `audit/CYBERSECURITY_AUDIT_2026-03-24.md`
  - Audit cybersécurité dur: secrets, auth, tokens, 2FA, et durcissement indispensable avant confiance forte.
- `operations/SITE_MAINTENANCE.md`
  - Maintenance courante, deploiement, sauvegarde, et incidents connus.
- `operations/DELIVERY_PROTOCOL.md`
  - Protocole obligatoire de verification, livraison et mise a jour doc.
- `operations/TASK_LOG.md`
  - Journal des taches terminees avec verification et statut de deploiement.
- `modules/README.md`
  - Decoupage par modules stables et regles de travail isolees.
  - Inclut maintenant `frontend proxy`, `audit`, `users/resellers`, `routers`, `sessions`, `payments/webhooks` et `subscriptions` comme modules documentes/stabilises.
- `roadmap/V1_2_MARKET_GAPS.md`
  - Ameliorations recommandees pour la V1.2 a partir des references du marche.
- `roadmap/V3_EXECUTION_PLAN.md`
  - Plan d'execution V3: priorites, lots et definition de done.
- `roadmap/V4_5_EXECUTION_PLAN.md`
  - Preparation V4.5: lots incidents/reporting/ops de masse + definition de done.
- `roadmap/V4_5_BEST_SOLUTIONS_BLUEPRINT.md`
  - Cadrage V4.5 oriente best-in-class: IA open source, analytics abonnements, recommandations et tarification par prefixe avec validation admin.

## Regles de maintien

- Toute modification de production importante doit mettre a jour `operations/SITE_MAINTENANCE.md`.
- Toute tache terminee doit mettre a jour `operations/TASK_LOG.md`.
- Toute livraison doit suivre `operations/DELIVERY_PROTOCOL.md`.
- Toute stabilisation technique doit documenter le module dans `modules/`.
- Toute nouvelle fonctionnalite planifiee pour la prochaine release doit etre ajoutee dans `roadmap/V1_2_MARKET_GAPS.md` ou un fichier de roadmap dedie.
- Les travaux V3 en cours doivent etre traces dans `roadmap/V3_EXECUTION_PLAN.md`.
- Les travaux V4.5 en cours doivent etre traces dans `roadmap/V4_5_EXECUTION_PLAN.md`.
- Tout incident significatif ou arbitrage produit doit etre resume dans `audit/CURRENT_STATE_2026-03-14.md` jusqu'a creation d'un audit plus recent.
- Les arbitrages de modularisation et les blocages qualite doivent etre traces dans `audit/MODULARITY_AUDIT_2026-03-24.md`.
- Les failles structurelles de securite et le plan de durcissement doivent etre traces dans `audit/CYBERSECURITY_AUDIT_2026-03-24.md`.

## Point d'attention

Le routeur MikroTik de production et la page hotspot locale ne sont pas documentes ici comme "modifies par le SaaS" tant qu'aucun changement routeur n'est effectivement applique.
