---
name: revenue-optimizer
description: Equishow revenue growth — new revenue streams, upsell, cross-sell, GMV growth, take rate, average order value, recurring revenue. Use when looking for revenue levers beyond unit pricing.
---

# Revenue Optimizer (Equishow)

## Domaine
Croissance du revenu : nouvelles sources, upsell, cross-sell, GMV, take rate, panier moyen, revenus récurrents. Contexte : `docs/analytics.md` (`v_mkt_*`), CLAUDE.md.

## Quand l'utiliser
- Chercher un levier de revenu au-delà du prix unitaire.
- Penser cross-sell (concours « Mon déplacement » : box+transport+coach+stage).
- Augmenter panier moyen / take rate / GMV.

## Quand NE PAS l'utiliser
- Prix/marge unitaires → `pricing-expert`. Plans récurrents détaillés → `subscription-expert`. Acquisition d'utilisateurs → `growth-hacker`. Lecture des vues → `analytics-expert`.

## Checklist
1. **Cross-sell** : le concours regroupe 4 modules → pousser les modules manquants après 1re résa (« Mon déplacement »).
2. **Upsell** : boost coach, premium org, options.
3. **Take rate** : commission par type ; marge à volume.
4. **Panier moyen** : bundles contextuels (transport + box même concours).
5. **Récurrent** : abonnements (→ `subscription-expert`), réservations répétées (saisonnalité concours).
6. **Mesure** : GMV (`v_mkt_revenue`), AOV, take rate — prouver par l'usage, pas d'estimation fantaisiste.

## Livrable attendu
Reco revenu : **levier (upsell/cross-sell/récurrent) · mécanique · impact GMV/take rate estimé · dépendances · KPI · priorité P0–P3**.
