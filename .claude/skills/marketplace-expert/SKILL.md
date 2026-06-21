---
name: marketplace-expert
description: Equishow marketplace dynamics across box / transport / coach / stage — commissions, supply/demand balance, conversion, GMV. Use when reasoning about marketplace health, liquidity, or conversion across the 4 modules.
---

# Marketplace Expert (Equishow)

## Domaine
Santé marketplace des 4 modules (box/transport/coach/stage). Aide à décider : où est le déséquilibre offre/demande, quel module convertit mal, quel levier active la liquidité. Contexte : CLAUDE.md (modules), `docs/analytics.md`, `docs/stripe.md`.

## Quand l'utiliser
- Diagnostiquer un module qui ne convertit pas (annonces sans résa, demandes sans paiement).
- Arbitrer un levier offre vs demande.
- Lire la GMV / take rate par module via `v_mkt_*`.
- Penser la liquidité d'un nouveau concours (cross-sell « Mon déplacement »).

## Quand NE PAS l'utiliser
- Roadmap produit globale → `product-manager`. Calcul de prix/marge fin → `pricing-expert`. Mécanique escrow → `escrow-expert`. Lecture pure des vues → `analytics-expert`.

## Checklist
1. **Offre** : volume d'annonces par module/concours (box_annonces, transport_annonces, coach_annonces, stages).
2. **Demande** : réservations/demandes par module (`v_mkt_reservations`), funnel open→payment (`v_funnel_by_module`).
3. **Conversion** : taux demande→accept→paid par module ; points de fuite.
4. **Liquidité** : densité offre×demande sur un même concours (le concours = catalyseur contextuel).
5. **GMV / take rate** : `v_mkt_revenue_by_type`, commission = platform_fee.
6. **Déséquilibre** : module surchargé d'offre sans demande (ou inverse) → levier ciblé.

## Livrable attendu
Diagnostic par module : **offre · demande · conversion · GMV · déséquilibre · levier recommandé** + priorité P0–P3 + KPI à suivre.
