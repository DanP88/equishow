---
name: organizer-expert
description: Equishow organiser space — concours claim, Org Radar, organiser KPIs, admin validation, proof-of-organiser, business value. Use when working on organiser features, claim flow, or Radar metrics.
---

# Organizer Expert (Equishow)

## Domaine
Espace organisateur : revendication de concours, Radar de pilotage, KPIs org, validation admin, preuve d'organisateur, valeur métier (Event Hub, freemium envisagé). Contexte : `docs/concours.md`, CLAUDE.md (User Roles).

## Quand l'utiliser
- Travailler sur claim (`concours_claims`), Radar (`fn_org_concours_radar`), écran org-revendiquer / admin-concours-claims.
- Définir/lire un KPI org (réservations/module, CA, clics, cavaliers distincts).
- Penser la valeur d'abonnement org.

## Quand NE PAS l'utiliser
- Pricing/abonnement chiffré → `pricing-expert`/`subscription-expert`. Sécurité RLS du claim → `security-auditor`. Roadmap globale → `product-manager`. Analytics pures → `analytics-expert`.

## Checklist
1. **Claim** : `concours_claims` (insert own, anti-doublon 1 approved/concours + 1 pending/(concours,org)), preuve (7 champs structurés), validation admin (approve/reject), notif admins (fan-out DB).
2. **Ownership** : `fn_org_owns_concours` ; admin = `users.role='admin'`.
3. **Radar** : agrégats RÉELS only (`fn_org_concours_radar`), **RGPD masquage < 5**, jamais nominatif ni « inscrits FFE ».
4. **Valeur** : signaux faible→fort de préparation cavaliers ; jamais de KPI fabriqué en prod.
5. **Piège** : `transport_reservations.statut` (FR), pas `status` (incident 077).

## Livrable attendu
Reco org : **flux/KPI concerné · contrainte RGPD · valeur métier · preuve requise · priorité P0–P3** + plan de vérif (claim→approve→radar).
