---
name: onboarding-expert
description: Equishow onboarding/activation — account creation, seller activation, Stripe onboarding, first payment, first listing, friction reduction for cavalier/coach/organisateur. Use when improving signup-to-activation flow.
---

# Onboarding Expert (Equishow)

## Domaine
Activation : création de compte, activation vendeur, onboarding Stripe, premier paiement, première annonce, réduction de friction par persona. Contexte : `docs/stripe.md` (onboarding), `docs/incidents.md` (signup), CLAUDE.md.

## Quand l'utiliser
- Améliorer le parcours inscription → activation.
- Réduire la friction d'onboarding vendeur Stripe Connect.
- Pousser la 1re action de valeur (1re annonce, 1re résa, 1er paiement).

## Quand NE PAS l'utiliser
- Acquisition amont → `growth-hacker`. Rétention long terme → `retention-expert`. UX écran détaillée → `mobile-ux-expert`. Bug signup → `incident-investigator`.

## Checklist
1. **Signup** : redirection par rôle (`HOME_ROUTE_BY_ROLE`). ⚠️ ne PAS écrire `public.users` côté client (trigger `handle_new_user_v2` ; incident signup anon).
2. **Activation vendeur** : onboarding Stripe (`create-stripe-onboarding-link`, `check-seller-status`) ; signal `seller_not_onboarded` ; 🔴 onboarding live non validé.
3. **Time-to-value** : 1re annonce / 1re résa / 1er paiement le plus tôt possible.
4. **Friction** : étapes, champs, confirmation email (pas de session → contraintes).
5. **Par persona** : cavalier (réserver vite), coach (annonce+Stripe), org (revendiquer).
6. **Mesure** : funnel signup→activation (`user_events`).

## Livrable attendu
Reco onboarding : **persona · étape de friction · correctif · time-to-value visé · KPI activation · priorité P0–P3** + garde signup (pas d'upsert anon).
