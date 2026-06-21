# docs/database.md — Base de données Equishow

> Détail extrait de CLAUDE.md (garde-le léger). Source : `supabase/migrations/*` (→ 083). ~50 tables, 151 policies RLS.

## Tables clés
- `users` — profil applicatif (role, points, level, profil complet). Provisionnée par trigger `handle_new_user_v2` au signup. Vue `users_public` pour exposition restreinte.
- `payments` — **source de vérité financière unique** (montants, statut escrow `held/releasing/released/reversed`, `release_trigger ∈ {manual_buyer, auto_cron, admin}`, `transfer_id`). FK résa obligatoire (mig 064).
- `payment_disputes` — litiges (anti-doublon index UNIQUE).
- `box_annonces`/`box_reservations`, `transport_annonces`/`transport_reservations`, `coach_annonces`/`course_demands`, `stages`/`stage_reservations`.
- `concours` (`liste_epreuves text[]`, `numero_ffe` UNIQUE), `concours_followers` (PK composite, `followers_count` dénormalisé), `concours_claims`, `concours_messages` (soft delete = contenu vidé), `concours_thread_reads`.
- `notifications`, `push_tokens`, `conversations`/`messages`/`conversation_reads`.
- `support_requests` (EQ-REC), `avis`, `chevaux`, `coach_profiles`, `coach_boost_purchases`.
- Infra : `escrow_alert_log`, `escrow_alert_state`, `escrow_cron_lock`, `stripe_webhook_events`, `email_events`, `platform_settings`, `points_config`, `level_thresholds`.

## Fonctions / RPC notables
- Disponibilités : `fn_availability_box/transport/coach/stage`, `fn_coach_slot_capacity`.
- Escrow : `fn_escrow_health`, `fn_escrow_alert_run`, `fn_escrow_buyer_notify_run`, `fn_mark_reservation_completed_from_payment`.
- Expiration : `fn_expire_pending`, `fn_expire_unpaid_accepted`, `fn_expire_awaiting_payment`, `fn_expire_boosts`.
- Montants : `recalc_*_amounts`, `get_commission_rate(service_type)`.
- Concours/org : `fn_org_concours_radar`, `fn_org_owns_concours`, `fn_concours_thread_unread`, `fn_concours_claim_notify_admins`.
- Rôles/sécu : `change_user_role` (RPC), `is_admin`, `is_app_admin`, `is_conversation_member`, `handle_new_user_v2`.
- Notifs : `fn_notify_*` (message, dispute, release, onboarded, trajet_complet, concours_reply, support_*).
- Gamification : `fn_award_points`, `fn_recalc_coach_certified`, `fn_apply_boost`.

## Triggers sensibles
- `trg_guard_status_transition` / `trg_guard_statut_transition` — anti-fraude transitions (bloque passage non autorisé vers paid/completed/cancelled par auth user ; service_role bypass).
- `trg_payment_released_to_completed` — résa → `completed` au release.
- `trg_*_recalc` — montants autoritatifs.
- `trg_concours_message_*` (fill author / soft delete), `trg_concours_followers_count` (compteur ±1 + resync).
- `on_auth_user_created` → `handle_new_user_v2`.

## Vues
- Marketplace (`security_invoker=true`) : `v_mkt_payments/reservations/revenue/revenue_by_type/sellers/escrow/disputes`.
- Funnel : `v_funnel_events/overview/by_module`.
- Analytics : `v_analytics_kpi_*`, `v_analytics_top_screens/top_ctas/funnel_payment/active_sessions/recent_errors`.
- Autres : `coach_stats`, `users_public`.

## Storage
Un seul bucket observé : **`chevaux-photos`** (mig 020). Public (CDN), 5 MB max, MIME `image/jpeg|png|webp`. Path `<auteur_id>/<cheval_id>.<ext>`. RLS `storage.objects` : select public ; insert/update/delete own (1er segment path = `auth.uid()`). Front : `lib/photoUpload.ts`.
**Absents du code** (ne pas supposer) : avatars (= pseudo+couleur+initiales, pas d'upload), justificatifs org (champs texte dans `concours_claims`), documents de réservation.

## RLS & realtime — invariants
- Patrons : `select own` / `insert own` (`auth.uid()=owner`) / `admin_all`. Cross-user insert bloqué.
- **Hard delete bloqué** quand non voulu : ne PAS créer de policy DELETE (ex `concours_messages` = soft delete uniquement, contenu vidé + stamp ; suppression réservée auteur/org propriétaire/admin via update).
- **Realtime** : toute table consommée en live doit être en publication **+ `replica identity full`** (sinon updates partiels). `conversation_reads`/`concours_thread_reads` volontairement hors realtime (décrément via pubsub in-process).
- **Capacité coach** (`fn_coach_slot_capacity`, mig 057) : créneau = `(annonce_id, date_debut, date_fin)`, capacité = `coach_annonces.places_disponibles` (NULL/0 ⇒ 1), statuts consommants = accepted/paid/completed, `pg_advisory_xact_lock` anti-race.

## Points sensibles
- `transport_reservations` utilise `statut` (FR) ≠ `status` (autres tables) — piège récurrent dans les fonctions org (cf incident 077).
- `liste_epreuves` vide sur seeds prod → section épreuves masquée tant qu'aucun CSV importé.
- RLS admin = `users.role='admin'` (pas `is_admin()` partout) — vérifier au cas par cas.
- `cheval_id` nullable ajouté sur les 4 tables de résa (mig 078, additif).

## Workflow migration (rappel)
Écrire `NNN_*.sql` + `NNN_*_rollback.sql` → harness rollback sur cluster Postgres local jetable → appliquer prod `supabase db query -f --linked` + `supabase migration repair --status applied NNN --linked`. **Jamais `db push`.**
