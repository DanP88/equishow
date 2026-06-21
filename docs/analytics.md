# docs/analytics.md — Analytics Equishow

> Détail extrait de CLAUDE.md. Analytics maison (`user_events`) + vues marketplace + funnel.

## Événements
- `lib/analytics.ts` : `trackCta`, `trackScreen`, funnel. Écrits dans `user_events`.
- ⚠️ `event_type` **figé par CHECK** : `{page_view, page_leave, cta_click, funnel_step, error, custom}`. Tout CTA custom = `event_type='cta_click'` + champ `action` (ex `concours_epreuves_open`, `click_ffe`, `concours_click_box`). **Jamais de nouveau type.**
- `metadata` jsonb (ex `concours_id`, `reservation_id`).

## Funnel
- open_listing → … → payment. Vues `v_funnel_events` → `v_funnel_overview` / `v_funnel_by_module`. Pivot `reservation_id` (paiement différé coach/stage). Hook `useFunnelAnalytics`.

## KPIs marketplace
- GMV = somme buyer_total payés ; commission = somme platform_fee. Source unique `payments`.
- Vues `v_mkt_payments/reservations/revenue/revenue_by_type/sellers/escrow/disputes`. Hook `useMarketplaceAnalytics`.
- KPI Clics FFE : `cta_click action='click_ffe'` (bouton FFE, URL dérivée de `numero_ffe`).

## Réservations / paiements
- Réservations : `v_mkt_reservations` (lignes hors annulées), par module + par concours (Radar).
- Paiements : `v_mkt_payments` (statut escrow, montants, transfer).

## Dashboards
- `(tabs)/admin-analytics.tsx` : KPI, top screens, top CTAs, funnel, sessions actives, erreurs récentes.
- `admin-commissions.tsx`.
- Org Radar : `fn_org_concours_radar` (réservations/module, cavaliers distincts masqués < 5, CA, clics modules). Hook `useOrgRadar`.

## État
- ✅ **En prod** : `user_events` + tracking, vues `v_mkt_*`/`v_funnel_*`/`v_analytics_*`, dashboards, KPI Clics FFE, Org Radar.
- 🟡 **Reste** : KPI notifications (ouverture/clic), rétention/cohortes, export, alerting analytics.
- ⚠️ **Limites** : `event_type` figé ; pas de backfill rétroactif ; cavaliers distincts masqués < 5 (RGPD) → petits concours peu lisibles. `notifications` n'alimente pas de KPI dédié.
