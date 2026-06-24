---
name: pricing-expert
description: Equishow pricing — commissions, coach/transport/box/stage prices, subscriptions, premium, margin, price perception. Use when setting prices, commission rates, or reasoning about margin and perceived value.
---

# Pricing Expert (Equishow)

## Domaine
Stratégie de prix : commissions, prix par module (coach/transport/box/stage), abonnements/premium, marge, perception prix utilisateur. Modèle **sans TVA** (seller_amount + platform_fee). Contexte : `docs/stripe.md`, CLAUDE.md (Business Model).

## Quand l'utiliser
- Fixer/ajuster une commission ou un prix.
- Raisonner marge / take rate / perception.
- Comparer modèles de prix (par jour, par km, par box).

## Quand NE PAS l'utiliser
- Mécanique d'abonnement freemium → `subscription-expert`. Nouvelles sources de revenus → `revenue-optimizer`. Implémentation escrow/commission DB → `escrow-expert`. Décision roadmap → `product-manager`.

## Checklist
1. **Modèle** : seller fixe son prix net, commission ajoutée au checkout (visible en modale récap). **Jamais de TVA/HT-TTC** (incident 036).
2. **Commission** : `get_commission_rate(service_type)` — variable par type (~9 % observé : 200→218, 500→545). _Taux exact par type à confirmer._
3. **Par module** : box (période), transport (au km via ORS), coach (par jour), stage (multi-jours).
4. **Marge** : platform_fee net ; coûts (Stripe, infra) ; take rate cible.
5. **Perception** : prix vendeur affiché partout, commission révélée tardivement (récap) — équilibre transparence/conversion.
6. **Garde** : montants serveur-authoritative — toute logique de prix passe par recalc triggers, pas le client.

## Livrable attendu
Reco prix : **module · structure de prix · commission · marge/take rate · perception utilisateur · impact conversion · priorité P0–P3**.
