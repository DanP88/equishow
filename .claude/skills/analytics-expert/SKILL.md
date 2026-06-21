---
name: analytics-expert
description: Design or debug Equishow analytics — user_events tracking, funnels, marketplace KPIs (GMV/commissions), dashboards, Org Radar. Use when adding tracking, KPIs, or analytics views.
---

# Analytics Expert (Equishow)

Analytics maison (`user_events`) + vues marketplace/funnel. Contexte : `docs/analytics.md`. Front : `lib/analytics.ts`.

## Événements
- Écrire via `trackCta` / `trackScreen`. Table `user_events`.
- ⚠️ `event_type` **figé par CHECK** : `{page_view, page_leave, cta_click, funnel_step, error, custom}`. CTA custom = `event_type='cta_click'` + `action` (ex `click_ffe`, `concours_click_box`). **Jamais de nouveau type** (sinon CHECK rejette, 0 migration possible).
- Contexte dans `metadata` jsonb (`concours_id`, `reservation_id`).

## Funnel & KPIs
- Funnel : `v_funnel_events` → `v_funnel_overview`/`v_funnel_by_module`, pivot `reservation_id` (paiement différé coach/stage).
- Marketplace : `v_mkt_*` (`security_invoker=true`), source unique `payments`. GMV = Σ buyer_total payés ; commission = Σ platform_fee.
- Dashboards : `(tabs)/admin-analytics.tsx`, `admin-commissions.tsx`. Org Radar : `fn_org_concours_radar` (RGPD, masquage < 5).

## Règles
- Pas de PII en clair dans les events.
- Vues read-only `security_invoker=true`.
- KPI alimentés par usages réels uniquement (pas de backfill rétroactif).
- Org Radar = agrégats réels, jamais de KPI fabriqué ni nominatif.

## Sortie attendue
Event/vue concerné + respect du CHECK `event_type` + impact dashboard + plan de vérif (event émis prouvé) + risque P0–P3.
