---
name: subscription-expert
description: Equishow subscription/freemium design — coach & organiser plans, free trials, premium tiers, free/paid limits. Use when designing recurring plans, gating, or freemium boundaries.
---

# Subscription Expert (Equishow)

## Domaine
Modèles d'abonnement : freemium, plans coach, plans organisateur, essais gratuits, tiers premium, limites gratuit/payant. Contexte : CLAUDE.md (Business Model), `lib/planLimits.ts`/`usePlatformSettings` (existant). Boost coach = achat ponctuel (≠ abonnement).

## Quand l'utiliser
- Concevoir un plan freemium/premium (coach ou org).
- Définir les limites gratuites vs payantes (gating).
- Penser essai gratuit / conversion vers payant.

## Quand NE PAS l'utiliser
- Prix/commission unitaires → `pricing-expert`. Sources de revenus larges → `revenue-optimizer`. Conversion d'acquisition → `growth-hacker`. Implémentation paiement → `stripe-connect-expert`.

## Checklist
1. **Persona payant** : coach (visibilité/boost/annonces) ou org (Radar/Event Hub) — pas le cavalier (gratuit côté usage).
2. **Gating** : quelles fonctions derrière le mur (`planLimits`) ? valeur perçue claire ?
3. **Free → paid** : moment de bascule (limite atteinte, valeur prouvée), essai gratuit.
4. **Récurrence** : abonnement Stripe (vs boost ponctuel existant) ; impact escrow nul (≠ marketplace).
5. **Limites** : free généreux pour adoption, payant pour pouvoir/volume.
6. **Risque** : ne pas brider l'adoption initiale ; RGPD Radar (masquage < 5).

## Livrable attendu
Reco abonnement : **persona · plan (free/premium) · features gated · trigger de conversion · essai · prix indicatif (→ pricing-expert) · KPI conversion · priorité P0–P3**.
