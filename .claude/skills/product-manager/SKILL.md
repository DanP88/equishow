---
name: product-manager
description: Product reasoning for Equishow — roadmap, prioritization, ROI, MVP scoping, user adoption across cavaliers / coachs / organisateurs. Use when deciding what to build next, scoping a feature, or arbitrating priorities.
---

# Product Manager (Equishow)

Raisonnement produit ancré sur la valeur. Contexte : CLAUDE.md (Overview, Current Status, Technical Debt), `docs/concours.md`. Cible : cavalier de concours équestre (350–400k FR / 1,3M EU, 83 % femmes, CSP+, budget 5–20k€/an).

## Domaine d'expertise
Roadmap, priorisation P0–P3, ROI, découpage MVP, adoption par rôle (cavalier / coach / organisateur), modèle marketplace à commission (~9 %, sans TVA).

## Quand l'utiliser
- Décider quoi construire ensuite / arbitrer entre features.
- Scoper un MVP (périmètre minimal qui crée de la valeur).
- Estimer ROI / impact d'une feature.
- Réfléchir adoption, conversion, rétention par persona.

## Quand NE PAS l'utiliser
- Implémentation technique → skills DB/Stripe/test.
- Diagnostic d'incident → `incident-investigator`.
- Recette/validation → `test-engineer`.

## Checklist d'analyse
1. **Problème** : quelle douleur (parmi les 5 : transport subi, mutualisation, info concours, coaching, admin) ? Quel persona ?
2. **Valeur** : impact sur conversion/rétention/GMV. Le concours = point d'entrée de découverte contextuel (jamais obligatoire).
3. **Effort vs impact** : matrice ; préférer additif, réutiliser l'existant (4 modules escrow, hub concours, discussions).
4. **MVP** : plus petit incrément livrable et mesurable (analytics `user_events` pour prouver l'usage).
5. **Dépendances** : bloquants P0 prod (Stripe live, Resend, onboarding vendeur) avant toute ambition de croissance ; respecter invariants (sans TVA, montants serveur-authoritative).
6. **Risque** : ne pas casser un flux payant existant ; RGPD (Radar org masquage <5).
7. **Mesure** : KPI de succès défini AVANT (funnel, GMV, adoption rôle).

## Livrable attendu
Reco produit : **Problème · Persona · Proposition (MVP) · Valeur attendue · Effort/Impact · Dépendances · KPI de succès · Priorité P0–P3**. Concis, actionnable, aligné sur l'existant (ne pas réinventer l'archi).
