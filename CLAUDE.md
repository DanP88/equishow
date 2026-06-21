# CLAUDE.md — Equishow

> **Source de vérité unique du projet.** Lire ce fichier **avant** d'explorer le repo ou d'agir.
> Dernière mise à jour : 2026-06-21 (audit repo `main` @ `12cf0c3`, migrations fichiers → 083 ; finalisation base de connaissance).
> Légende : ✅ observé dans le code · 🟡 partiel · 🔴 bloquant/absent · _(déduit)_ inféré, à confirmer.

---

# SESSION STARTUP INSTRUCTIONS

À chaque nouvelle session Claude Code sur Equishow :

1. **Lire intégralement CLAUDE.md** avant toute action.
2. **Considérer CLAUDE.md comme la source de vérité** (priorité sur les souvenirs/suppositions).
3. **Vérifier les migrations récentes** : `ls supabase/migrations/ | tail` vs dernière migration documentée ici. Tout écart = mettre à jour le doc.
4. **Vérifier les PR récentes** : `gh pr list --state all --limit 10` + `git log --oneline -10`.
5. **Vérifier les écarts doc ↔ code** : tables/fonctions/écrans cités ici existent-ils encore ? (`grep`/`ls` avant d'affirmer).
6. **Mettre à jour le document** si une divergence est trouvée (voir _Maintenance Policy_).
7. **Ne jamais supposer un état de production non vérifié** : « migration appliquée prod », « secret live », « cron actif » se confirment via CLI Supabase, pas par mémoire. En l'absence de vérif, le marquer _(déduit)_.

---

# EQUISHOW OVERVIEW

**Vision** — Application mobile compagnon du **cavalier de concours équestre**. Agrège ce qui est aujourd'hui éparpillé (WhatsApp, FFECompet, PDFs, bouche-à-oreille) dans un seul produit mobile. Pensée pour se connecter à **Equistra** (app quotidien cheval) par API _(roadmap, non implémenté)_.

**Problème résolu** — 5 douleurs du cavalier de concours :
1. Transport subi (30–50 % du budget concours).
2. Mutualisation archaïque (WhatsApp, bouche-à-oreille).
3. Info concours fragmentée (PDFs veille, 3 sites de résultats).
4. Coaching ponctuel introuvable.
5. Suivi administratif manuel (Excel, FFECompet brut).

**Utilisateurs ciblés** — 350 000–400 000 compétiteurs France / 1,3 M Europe ; 83 % femmes, 25–45 ans, CSP+, budget 5 000–20 000 €/an.

**Proposition de valeur** — Une marketplace verticale équestre : trouver/proposer box, transport, coach, stage **en contexte d'un concours**, avec paiement sécurisé sous séquestre (escrow) et une couche communautaire/discussion par concours. Le concours est le **point d'entrée de découverte**, jamais une étape obligatoire.

---

# BUSINESS MODEL

Marketplace à commission. Le vendeur fixe son prix net ; la **commission plateforme est ajoutée au checkout** (modèle sans TVA, pas de logique HT/TTC). Commission variable par type de service via `get_commission_rate(service_type)` — ~9 % observé sur exemples (coach 200 € → cavalier paie 218 € ; stage 500 € → 545 €).

- **Cavaliers** — consommateurs : réservent box/transport/coach/stage, suivent des concours, paient (escrow). Gratuit côté usage.
- **Coachs** — vendeurs de prestations (cours, stages) ; profil dédié, certification, **boost payant** (`coach_boost_purchases`, Stripe). Reçoivent leur prix net après release escrow.
- **Organisateurs** — clubs/structures : revendiquent un concours (`concours_claims`), accèdent au **Radar de pilotage** (signaux de demande agrégés, RGPD-aware, masquage < 5). Valeur = Event Hub (modèle freemium envisagé, non facturé à ce jour).
- **Administrateurs** — opèrent la plateforme : analytics, litiges, commissions, réclamations, validation des revendications de concours, gestion des notifications.

---

# CURRENT PROJECT STATUS

**État global** : 🟢 code prêt / 🔴 infrastructure commerciale non prête. Migrations fichiers → **083** (prod alignée selon historique). `main` = `origin/main`, 0 PR ouverte, repo propre.

**Fonctionnalités réellement présentes** ✅
- Auth Supabase + 4 rôles (cavalier/coach/organisateur/admin) + bascule de rôle (RPC `change_user_role`).
- 4 modules marketplace complets avec **escrow** : Box, Transport, Coach (cours), Stage.
- Disponibilités anti-surbooking (`fn_availability_*`), capacité créneau coach (057).
- Paiements Stripe Connect + séquestre (Separate Charges & Transfers) + crons de release/expiration.
- Litiges (`payment_disputes`) + remboursements admin + alerting escrow.
- Notifications in-app + push serveur (Expo) ; emails transactionnels (Resend).
- Module Concours : import CSV FFE (297 concours prod), fiche, météo, épreuves, followers, **Discussions** (fil par concours + tags implicites + réponses + mentions @concours), claim org + Radar.
- Chevaux, Messagerie, Communauté (posts par rôle), Avis, Badges/points, Réclamations (EQ-REC).
- Dashboards admin : Analytics, Litiges, Commissions, Réclamations, Notifications.
- Analytics maison (`user_events`) + vues marketplace + funnel.

**Partiellement implémenté** 🟡
- **Push mobile** : sender Edge + tokens OK, mais **0 projet EAS** → Android/iOS en pause (web only).
- **Concours dual-source** : 7 écrans lisent encore le mock `concoursStore` au lieu de la table DB (voir Technical Debt).
- **Location de van** : module conservé mais fermé au public (dates/cautions non finies, lot futur R4/CR6).
- **Discussions LOT 2** : fil participants, @user, push & notif de mention = archi prête, non câblée.

**Dette technique visible** 🟡 — 18 erreurs TS pré-existantes ; bug F1 surbooking Stage+Box non porté ; 23 fichiers parasites untracked à la racine. Détail en section TECHNICAL DEBT.

---

# TECH STACK

**Frontend** (`expo_app/`)
- Expo `~54.0.33` / React Native `0.81.5` / React Native Web `^0.21`.
- expo-router `~6.0.23` (routing fichier, dossier `app/`).
- TypeScript `~5.9.2` (strict ; 18 erreurs résiduelles tolérées hors lints bloquants).
- expo-notifications, expo-image-picker, expo-linear-gradient, react-native-svg, react-native-toast-notifications.

**Backend** (`supabase/`)
- Supabase (PostgreSQL + Auth + Realtime + Storage + Edge Functions Deno).
- Client JS `@supabase/supabase-js ^2.101.1`.
- Projet prod **`vhkjvnpxcqlmpokrgymx`** (org « DanP88's Project »). ⚠️ **PAS** `wdhgsuulsuwdrtbvetaf` (= InstallCom, org LexAI).

**Paiement** — Stripe Connect (Separate Charges & Transfers / escrow custom). Webhook signé HMAC.

**Infrastructure**
- **Vercel** : déploiement web (2 projets : `equishow` + `equishow-21w8`). Build = `expo export --platform web`.
- **Resend** : emails transactionnels (domaine `equishow.app` 🔴 non vérifié).
- **pg_cron** + **pg_net** : tâches planifiées et appels HTTP DB→Edge.
- Sentry _(scrub PII configuré)_.

**Autres dossiers repo** — `web/`, `web_app/` (legacy/alt web), `flutter_app/` (legacy), `api/`, `scripts/`, `docs/`, `migrations_legacy/`. Le code vivant est `expo_app/` + `supabase/`.

---

# ARCHITECTURE

```
Client (Expo / RN Web)  ──auth/CRUD──►  Supabase Postgres (RLS) ──► Realtime ──► Client
        │                                     │  ▲
        │ checkout                            │  │ triggers / pg_cron / pg_net
        ▼                                     ▼  │
  Edge Functions (Deno) ◄── webhook ◄── Stripe (Connect + escrow)
        │
        └──► Resend (emails) / Expo Push (notifs)
```

- **Montants autoritatifs serveur** : le client n'impose jamais un prix. Triggers `recalc_*_amounts` recalculent seller_amount/platform_fee/total à l'écriture (mig 051). Anti-fraude transitions de statut (mig 047, `trg_guard_status_transition`).
- **Escrow module-agnostique** : logique partagée `supabase/functions/_shared/escrow.ts`. Paiement → fonds `held` → release (auto cron J0/H+24 ou manuel/admin) → `transfer` vers vendeur → résa `completed`.
- **Realtime** : tables consommées en live doivent être en publication + replica identity full (voir SECURITY/notes realtime).
- **Notifications** : 1 table `notifications` + triggers `fn_notify_*` + helper d'auteur ; push via trigger → pg_net → Edge `send-push`.

---

# USER ROLES

Rôle stocké dans `users.role` (+ table `roles`). Bascule via RPC sécurisée `change_user_role` (mig 006). Guard front + RLS DB.

## Cavalier
**Capacités** : réserver box/transport/coach/stage ; suivre des concours (`concours_followers`) ; payer (escrow) ; ouvrir un litige ; messagerie ; poster en communauté ; gérer ses chevaux ; déposer un avis (si prestation `completed`) ; participer aux discussions concours.
**Restrictions** : ne valide pas de demandes vendeur ; ne voit pas les dashboards admin/org ; ne peut pas modifier les montants (serveur-authoritative).

## Coach
**Capacités** : tout cavalier + créer/éditer annonces de cours (`coach_annonces`) et stages (`stages`) ; accepter/refuser des demandes (`course_demands`) ; profil coach (`coach_profiles`, certification) ; acheter un **boost** (Stripe) ; recevoir les fonds après release.
**Restrictions** : un compte ne valide qu'un type de barre à la fois (accept box/transport = barre cavalier ; accept coach = barre coach, exclusives) ; pas d'accès admin/org.

## Organisateur
**Capacités** : tout cavalier + revendiquer un concours (`concours_claims`) ; après approbation admin, accéder au **Radar** (`fn_org_concours_radar` : réservations/module, cavaliers distincts masqués < 5, CA, clics modules).
**Restrictions** : agrégats RGPD-aware uniquement (jamais de données nominatives ni « inscrits FFE ») ; ne peut pas lister les admins (fan-out notif côté DB) ; pas d'accès admin.

## Admin
**Capacités** : dashboards Analytics / Litiges / Commissions / Réclamations / Notifications ; remboursements réels (`process-refund` buyer OU admin) ; résolution de litiges ; approbation/rejet des revendications de concours ; import concours CSV.
**Restrictions** : admin = `users.role='admin'` (helpers `is_admin` / `is_app_admin`) ; service_role réservé aux Edge Functions (bypass RLS contrôlé).

---

# FUNCTIONAL MODULES

## Concours
**Objectif** — Hub de découverte ; point d'entrée contextuel vers les services.
**Tables** — `concours`, `concours_followers`, `concours_claims`, `concours_messages`, `concours_thread_reads`.
**Écrans** — `(tabs)/concours.tsx`, `(tabs)/concours-hub.tsx`, `concours/[id]/index.tsx` (fiche), `concours/[id]/discussion.tsx`, `creer-concours.tsx`, `import-concours.tsx`, `(tabs)/org-concours.tsx`, `org-revendiquer.tsx`, `admin-concours-claims.tsx`.
**Workflow** — Import CSV FFE (admin, upsert sur `numero_ffe`) → fiche (météo Open-Meteo front-only, épreuves parsées depuis `liste_epreuves`, services filtrés par `concours_id`) → follow → discussion (tags implicites #transport/#box/#coach/#stage, réponses 1 niveau, mentions `@[Nom](concours:UUID)`) → org revendique → admin approuve → Radar. Hooks : `useConcours`, `useConcoursClaims`, `useConcoursDiscussion`, `useConcoursModuleCounts`, `useConcoursWeather`, `useOrgRadar`, `useFollow`. Libs : `epreuves.ts`, `mentions.ts`, `csv.ts`, `discipline.ts`.

## Box
**Objectif** — Location de box/hébergement cheval sur un concours.
**Tables** — `box_annonces`, `box_reservations`.
**Écrans** — `proposer-box.tsx`, `reserver-box.tsx`, `paiement-box.tsx`, `box-pending-demands.tsx`, `pending-box-payments.tsx`.
**Workflow** — annonce → demande cavalier (`pending`) → accept vendeur (`accepted`) → `awaiting_payment` → Stripe → `paid` (escrow `held`) → release → `completed`. Dispo : `fn_availability_box` (chevauchement de dates). Hook : `useBoxes`.

## Transport
**Objectif** — Mutualisation transport cheval (trajets partagés) + location van (fermée).
**Tables** — `transport_annonces`, `transport_reservations` (statut FR = `statut`, pas `status`).
**Écrans** — `proposer-transport.tsx`, `reserver-transport.tsx`, `paiement-transport.tsx`, `transport-pending-demands.tsx`, `pending-transport-payments.tsx`.
**Workflow** — trajet (`type_transport='trajet'`, prix au km via ORS) → demande → accept → paiement escrow → completed. Dispo : `fn_availability_transport` (compteur de places, symétrique S={accepted,awaiting_payment,paid,completed}, fix 060). Location de van NON soumise au compteur (Option A, lot futur). Hook : `useTransports`.

## Coach (cours)
**Objectif** — Réserver un cours ponctuel avec un coach indépendant.
**Tables** — `coach_annonces`, `course_demands`, `coach_profiles`, `coach_boost_purchases`.
**Écrans** — `proposer-coach-annonce.tsx`, `reserver-coach.tsx`, `coach-demandes.tsx`, `coach-pending-demands.tsx`, `(tabs)/coach-services.tsx`, `boost-coach.tsx`.
**Workflow** — annonce (liée à un concours possible) → demande → accept → paiement escrow → completed. Capacité créneau : `fn_coach_slot_capacity` (créneau = annonce_id+date_debut+date_fin, cap = `places_disponibles` NULL/0 ⇒ 1, advisory lock anti-race, mig 057). Boost = achat Stripe → `fn_apply_boost`. Hooks : `useCoachAnnonces`, `useCourseDemands`, `useCoursePayment`, `useCoachProfiles`.

## Stages
**Objectif** — Stages multi-jours proposés par un coach.
**Tables** — `stages`, `stage_reservations`.
**Écrans** — `proposer-stage.tsx`, `reserver-stage.tsx`, `(tabs)/coach-stages.tsx`.
**Workflow** — identique escrow (`pending→accepted→awaiting_payment→paid→completed`, mig 063). Dispo : `fn_availability_stage` (symétrique, fix 062). Prix coach affiché partout, commission visible uniquement dans la modale récap avant Stripe. Hooks : `useStages`, `useStagePayment`.

## Chevaux
**Objectif** — Fiches chevaux du cavalier + historique réservations/concours.
**Tables** — `chevaux` (+ `cheval_id` nullable sur les 4 tables de résa, mig 078).
**Écrans** — `(tabs)/chevaux.tsx`.
**Workflow** — CRUD optimistic, photo upload Storage (`photoUpload.ts`), section « Réservations & concours » par cheval. Hooks : `useChevaux`, `useChevalReservations`.

## Messagerie
**Objectif** — Conversations 1:1 entre utilisateurs.
**Tables** — `conversations`, `messages`, `conversation_reads` (PK par (conversation,user)).
**Écrans** — `messagerie.tsx`, `(tabs)/messagerie.tsx`.
**Workflow** — RLS `users.id==auth.uid()` + membres ; non-lu = dernier message de l'autre non lu ; `markRead` durci anti-décalage horloge ; décrément instantané via bus pubsub (`conversation_reads` hors realtime) ; badge global. Notif in-app au destinataire (mig 058) + push (mig 059). Hook : `useMessaging`.

## Communauté
**Objectif** — Fils de posts par rôle.
**Tables** — `posts_community` / `posts_coach` / `posts_organisateur` (+ variantes `com_posts_*`).
**Écrans** — `(tabs)/communaute.tsx`, `communaute-coach.tsx`, `communaute-org.tsx`.
**Workflow** — posts + likes (`toggle_post_like`/`toggle_comment_like`) + points/badges au post. Onglet « 💬 Discussions » concours réutilise `concours_messages`. Hooks : `useCommunautePosts`, `usePosts`.

## Notifications
**Objectif** — Centre de notifications in-app + push.
**Tables** — `notifications`, `push_tokens`.
**Écrans** — `notifications.tsx`, `(tabs)/notifications.tsx` + variantes par rôle (`coach-`/`org-`/`admin-notifications`), `parametres-notifications.tsx`.
**Workflow** — triggers `fn_notify_*` écrivent dans `notifications` ; `fill_notification_author_fields` ; realtime ; push via `trg_zz_push_on_message`→pg_net→Edge `send-push` (Expo). Types : message, reservation_request, escrow_alert, dispute_*, support_*, concours_reply, etc. Hooks : `useNotifications`, `usePushNotifications`.

## Analytics
**Objectif** — Mesure produit (maison) + marketplace + funnel.
**Tables** — `user_events` (CHECK `event_type ∈ {page_view, page_leave, cta_click, funnel_step, error, custom}`), `analytics_events`, `user_activity_events`.
**Écrans** — `(tabs)/admin-analytics.tsx`.
**Workflow** — `lib/analytics.ts` (`trackCta`, `trackScreen`, funnel) → vues SQL (voir ANALYTICS ARCHITECTURE). Hooks : `useScreenTracking`, `useFunnelAnalytics`, `useMarketplaceAnalytics`.

---

# DATABASE ARCHITECTURE

~50 tables. Migrations versionnées `supabase/migrations/NNN_*.sql` (chaque migration a un `_rollback.sql`). **151 policies RLS** au total.

**Tables clés**
- `users` — profil applicatif (role, points, level, profil complet). Provisionnée par trigger `handle_new_user_v2` au signup. Vue `users_public` pour exposition restreinte.
- `payments` — **source de vérité financière unique** (montants, statut escrow `held/releasing/released/reversed`, `release_trigger ∈ {manual_buyer, auto_cron, admin}`, `transfer_id`). FK résa obligatoire (mig 064).
- `payment_disputes` — litiges (anti-doublon index UNIQUE).
- `*_annonces` / `*_reservations` (box/coach/transport/stage) + `course_demands` (coach) + `stages`.
- `concours` (+ `liste_epreuves text[]`, `numero_ffe` UNIQUE) / `concours_followers` (PK composite, `followers_count` dénormalisé) / `concours_claims` / `concours_messages` (soft delete = contenu vidé) / `concours_thread_reads`.
- `notifications`, `push_tokens`, `conversations`/`messages`/`conversation_reads`.
- `support_requests` (EQ-REC), `avis`, `chevaux`.
- `coach_profiles`, `coach_boost_purchases`.
- Infra : `escrow_alert_log`, `escrow_alert_state`, `escrow_cron_lock`, `stripe_webhook_events`, `email_events`, `platform_settings`, `points_config`, `level_thresholds`.

**Fonctions SQL / RPC notables**
- Disponibilités : `fn_availability_box/transport/coach/stage`, `fn_coach_slot_capacity`.
- Escrow : `fn_escrow_health`, `fn_escrow_alert_run`, `fn_escrow_buyer_notify_run`, `fn_mark_reservation_completed_from_payment`.
- Expiration : `fn_expire_pending`, `fn_expire_unpaid_accepted`, `fn_expire_awaiting_payment`, `fn_expire_boosts`.
- Montants : `recalc_*_amounts`, `get_commission_rate(service_type)`.
- Concours/org : `fn_org_concours_radar`, `fn_org_owns_concours`, `fn_concours_thread_unread`, `fn_concours_claim_notify_admins`.
- Rôles/sécurité : `change_user_role` (RPC), `is_admin`, `is_app_admin`, `is_conversation_member`, `handle_new_user_v2`.
- Notifs : `fn_notify_*` (message, dispute, release, onboarded, trajet_complet, concours_reply, support_*).
- Gamification : `fn_award_points`, `fn_recalc_coach_certified`, `fn_apply_boost`.

**Triggers sensibles**
- `trg_guard_status_transition` / `trg_guard_statut_transition` — anti-fraude transitions (bloque passage non autorisé vers paid/completed/cancelled par auth user ; service_role bypass).
- `trg_payment_released_to_completed` — résa → `completed` au release.
- `trg_*_recalc` — montants autoritatifs.
- `trg_concours_message_*` — fill author / soft delete.
- `trg_concours_followers_count` — compteur ±1 + resync.
- `on_auth_user_created` → `handle_new_user_v2`.

**Vues**
- Marketplace : `v_mkt_payments`, `v_mkt_reservations`, `v_mkt_revenue`, `v_mkt_revenue_by_type`, `v_mkt_sellers`, `v_mkt_escrow`, `v_mkt_disputes` (toutes `security_invoker=true`).
- Funnel : `v_funnel_events`, `v_funnel_overview`, `v_funnel_by_module`.
- Analytics : `v_analytics_kpi_*`, `v_analytics_top_screens`, `v_analytics_top_ctas`, `v_analytics_funnel_payment`, `v_analytics_active_sessions`, `v_analytics_recent_errors`.
- Autres : `coach_stats`, `users_public`.

**Points sensibles** — `transport_reservations` utilise `statut` (FR) ≠ `status` (autres) : piège récurrent dans les fonctions org. `liste_epreuves` vide sur les seeds prod (section épreuves masquée tant qu'aucun CSV importé). RLS admin = `users.role='admin'` (pas `is_admin()` partout — vérifier au cas par cas).

---

# STORAGE ARCHITECTURE

Supabase Storage. **Un seul bucket observé dans le code** (mig `020_storage_chevaux_photos.sql` + `lib/photoUpload.ts`).

- **`chevaux-photos`** ✅
  - *Usage* : photos de fiches chevaux. Path : `<auteur_id>/<cheval_id>.<ext>` (`upsert:true`). Lecture via `getPublicUrl`.
  - *Accès* : bucket **public** (lecture CDN), 5 MB max/fichier, MIME `image/jpeg|png|webp`.
  - *Règles RLS* (`storage.objects`) : `select` public (tous) ; `insert`/`update`/`delete` réservés à `authenticated` sur son propre dossier (1er segment du path = `auth.uid()`).
  - *Dépendances* : `expo-image-picker` (front), `chevaux.photo_url`.

**Buckets NON présents dans le code** (à créer si besoin, ne rien supposer) :
- **Avatars utilisateurs** — ❌ pas de bucket. L'identité d'affichage = **pseudo + couleur + initiales** (généré, pas d'upload). Aucune photo de profil uploadée.
- **Justificatifs organisateurs** — ❌ pas de fichier. La revendication (`concours_claims`) stocke des **champs texte** (SIRET, licence, lien, message), pas de pièce jointe.
- **Documents de réservation / factures** — ❌ pas de bucket. Aucun PDF/justificatif de résa stocké côté Storage à ce jour.

> Si une future feature exige avatars/justificatifs/documents : créer le bucket via migration `storage.buckets` + policies `storage.objects` (modèle mig 020), documenter ici.

---

# STRIPE ARCHITECTURE

Modèle **Separate Charges & Transfers** (escrow custom, fonds retenus puis transférés au vendeur).

- **Onboarding vendeur** — `create-stripe-onboarding-link`, `complete-seller-onboarding`, `check-seller-status`, `stripe-onboarding.tsx`. 🔴 onboarding live non validé. Signal alerting `seller_not_onboarded`.
- **Stripe Connect** — comptes connectés vendeurs ; bypass Connect en mode test (Edge `create-checkout-session`).
- **Checkout** — `create-checkout-session` / `verify-checkout-session` / `checkout.tsx` / `checkout-success.tsx`. Montant serveur-authoritative.
- **Escrow** — `_shared/escrow.ts` (module-agnostique). Paiement → `held` → release. Crons : `equishow_escrow_release_hourly`, `equishow_escrow_buyer_notify`, `equishow_escrow_alert`. Edge `release-payment`, `escrow-cron-release`.
- **Remboursements** — `process-refund` (buyer OU admin, RLS-aware). Sentinelle mismatch refund/reversal = 0.
- **Commissions** — `get_commission_rate(service_type)` ajoute la commission au checkout ; affichée au cavalier dans la modale récap. Dashboard `admin-commissions.tsx`.
- **Litiges** — `manage-dispute` + `payment_disputes` + `admin-disputes.tsx`. Notif ouverture → admins + vendeur ; résolution → acheteur. Alerting aging 48h.
- **Webhooks** — `webhook-stripe` (table `stripe_webhook_events`, idempotence). ⚠️ **Toujours déployer `--no-verify-jwt`** (auth = signature HMAC `verifyStripeSignature` ; sinon gateway 401, paiements bloqués `pending`). Pérennisé dans `supabase/config.toml`.
- **Boost coach** — `create-boost-checkout` → `coach_boost_purchases` → `fn_apply_boost`. Cron `equishow_boost_certified_daily`.

---

# ANALYTICS ARCHITECTURE

- **Événements** — `lib/analytics.ts`. Écrits dans `user_events` avec `event_type ∈ {page_view, page_leave, cta_click, funnel_step, error, custom}`. ⚠️ Pas de nouveaux `event_type` libres (CHECK strict) : pour un CTA custom, utiliser `event_type='cta_click'` + champ `action` (ex `concours_epreuves_open`, `click_ffe`, `concours_click_box`).
- **Funnels** — open_listing → … → payment ; vues `v_funnel_events`/`v_funnel_overview`/`v_funnel_by_module`, pivot par `reservation_id` (paiement différé coach/stage). Hook `useFunnelAnalytics`.
- **KPIs marketplace** — GMV, réservations, paiements, vendeurs, escrow, litiges, revenue by type (vues `v_mkt_*`, source unique `payments`). Hook `useMarketplaceAnalytics`.
- **KPI Clics FFE** — `cta_click action='click_ffe'` sur bouton FFE (URL dérivée de `numero_ffe`).
- **Dashboards** — `(tabs)/admin-analytics.tsx` (KPI, top screens, top CTAs, funnel, sessions actives, erreurs récentes) ; `admin-commissions.tsx`.
- **Org Radar** — `fn_org_concours_radar` : réservations/module, cavaliers distincts (masqués < 5), CA (GMV/commission), clics modules. Hook `useOrgRadar`.

**Détail métier**
- **user_events** — table d'événements brute (source de `lib/analytics.ts`). Chaque event : `event_type` (enum CHECK), `action`, `metadata` (jsonb, ex `concours_id`, `reservation_id`), session, screen. Pas de PII en clair côté event.
- **Réservations** — comptées via `v_mkt_reservations` (lignes hors annulées) ; par module et par concours (Radar).
- **Paiements** — `v_mkt_payments` (source unique `payments`) : statut escrow, montants, transfer.
- **GMV / commissions** — `v_mkt_revenue` + `v_mkt_revenue_by_type` : GMV = somme buyer_total payés ; commission = somme platform_fee. Radar expose le CA par concours.
- **Conversions / funnel** — `v_funnel_events` → `v_funnel_overview` / `v_funnel_by_module` : open_listing → … → payment, pivot `reservation_id`.
- **Notifications** — non agrégées en analytics produit à ce jour (la table `notifications` n'alimente pas de KPI dédié) ; suivi via realtime/badge uniquement.

**État**
- ✅ **En prod** : `user_events` + `trackCta`/`trackScreen`, vues `v_mkt_*` / `v_funnel_*` / `v_analytics_*`, dashboards `admin-analytics` + `admin-commissions`, KPI Clics FFE, Org Radar (réservations/CA/clics).
- 🟡 **Reste à construire** : KPI sur notifications (taux d'ouverture/clic), rétention/cohortes, export, alerting analytics (≠ alerting escrow).
- ⚠️ **Limites connues** : `event_type` figé par CHECK (`{page_view,page_leave,cta_click,funnel_step,error,custom}`) → tout CTA custom passe par `cta_click` + `action` (pas de nouveau type). KPI alimentés par usages réels uniquement (pas de backfill rétroactif des events). Cavaliers distincts masqués < 5 (RGPD) → petits concours peu lisibles.

---

# PRODUCTION INFRASTRUCTURE

- **Supabase** — projet prod **`vhkjvnpxcqlmpokrgymx`** uniquement. Toute action DB/Edge via **CLI Supabase** (le MCP claude.ai est cassé, voit InstallCom). Migrations appliquées par `supabase db query -f <fichier> --linked` puis `supabase migration repair --status applied NNN --linked`. **JAMAIS `supabase db push`** (refusé par le propriétaire).
- **Vercel** — 2 projets web (`equishow`, `equishow-21w8`), build `expo export --platform web`. **Push d'une branche feature = Preview (401)** ; la prod réelle = **merge → main**.
- **Environnements** — pas de staging dédié ; prod = `main`. Tests SQL sur **cluster Postgres local jetable** (`brew postgresql@16`, `LC_ALL=C`), jamais sur la prod.
- **Secrets** — Stripe (🔴 `sk_live` non confirmé, test présumé), Resend (`RESEND_API_KEY`), `PUSH_DISPATCH_SECRET`, ORS (route transport), Open-Meteo (sans clé). Slack absent (alerting via notif in-app admin).
- **Déploiement Edge** — `supabase functions deploy <fn>` ; `webhook-stripe` et `send-push` **toujours `--no-verify-jwt`**.
- **Crons (pg_cron)** — `equishow_escrow_release_hourly`, `equishow_escrow_alert` (*/30), `equishow_escrow_buyer_notify` (*/30), `equishow_expire_pending`, `equishow_expire_unpaid`, `equishow_expire_awaiting_payment` (*/15), `equishow_boost_certified_daily`. Diag cron pg_net = lire `net._http_response.status_code`, **PAS** `cron.job_run_details` (faux « succeeded »).

**Variables d'environnement critiques** (noms confirmés par usage ; valeurs jamais en repo)
- Front (Expo) : `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` _(noms standard, à confirmer dans `config/`)_.
- Edge (Supabase secrets) : `STRIPE_SECRET_KEY` (🔴 live/test à confirmer), `STRIPE_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `PUSH_DISPATCH_SECRET` (= header `x-push-secret`), clé ORS (route transport). Open-Meteo = sans clé. Slack = absent.
- ⚠️ Ces noms sont **déduits de l'usage** ; vérifier `supabase secrets list` (CLI) avant de s'appuyer dessus.

**Déploiement**
- Web : merge `main` → Vercel Production (les 2 projets). Vérifier bundle servi (hard refresh, cache).
- Edge : `supabase functions deploy <fn>` (`webhook-stripe`/`send-push` = `--no-verify-jwt`).
- DB : `supabase db query -f <NNN.sql> --linked` + `supabase migration repair --status applied NNN --linked`. Jamais `db push`.

**Procédure de rollback**
- *Migration DB* : exécuter le `NNN_*_rollback.sql` associé via `db query -f --linked`, puis `migration repair --status reverted NNN --linked`. (Migrations additives ⇒ rollback sûr.)
- *Front/web* : revert du commit/PR sur `main` → Vercel redéploie automatiquement le bundle précédent.
- *Edge* : redeploy de la version précédente de la fonction (garder le commit). Pour basculer Stripe live↔test : swap des secrets + redeploy des Edge concernées.
- *Cron* : `cron.unschedule('<nom>')` pour stopper ; re-`cron.schedule` pour réactiver.

> **Confirmé dans le code** : projet Supabase, build Vercel, `verify_jwt=false` (config.toml), crons (noms en migrations), bucket storage, RLS. **Déduit / à vérifier via CLI** : état live des secrets Stripe/Resend, application réelle des migrations 080–083 en prod, noms exacts des env vars front.

---

# SECURITY MODEL

- **Rôles** — `users.role` (cavalier/coach/organisateur/admin) ; helpers `is_admin`/`is_app_admin` ; bascule via RPC `change_user_role` (jamais d'UPDATE direct du rôle côté client).
- **Permissions / RLS** — 151 policies. Patrons : `select own` / `insert own` (`auth.uid()=owner`) / `admin_all`. Lecture publique limitée (ex discussions concours), insert authentifié, soft delete propriétaire/org/admin, **hard delete bloqué** (pas de policy DELETE) sur `concours_messages`.
- **Montants** — serveur-authoritative (recalc triggers) ; anti-fraude transitions de statut (guard triggers). Le client ne peut forcer ni montant ni passage à `paid/completed`.
- **Guards front** — AuthGuard + redirection par rôle (`HOME_ROUTE_BY_ROLE`) ; badges admin recountés au focus (tables hors realtime).
- **Protections admin** — admin = `users.role='admin'` ; service_role réservé aux Edge ; fan-out notif admin côté DB (org ne peut pas lister les admins via RLS).
- **Webhooks** — auth par signature HMAC, pas JWT.
- **Realtime** — toute table consommée en live doit être en publication + `replica identity full` (sinon updates incomplets) ; `conversation_reads`/`concours_thread_reads` volontairement hors realtime (décrément via pubsub in-process).

---

# DEVELOPMENT RULES

Toujours, pour toute évolution :
- Migrations **additives** (jamais de DROP/DELETE destructif tant que le projet évolue — cleanup ultra-conservateur, TRUNCATE only si besoin).
- **Rollback obligatoire** : chaque `NNN_*.sql` a son `NNN_*_rollback.sql`.
- Vérifier **RLS** (nouvelle table = policies explicites + `select/insert/update` ciblés).
- Vérifier **index** (FK, colonnes de filtre, anti-doublon UNIQUE).
- Vérifier **permissions** (admin = `role='admin'`, pas `is_admin()` par défaut).
- Fournir un **plan de recette** (harness rollback sur cluster local jetable + recette interactive prod).
- Préserver l'existant : UI, logique métier, connexions Supabase, RLS, routes, services, composants critiques — ne jamais écraser de code sans validation.

---

# SQL RULES

Toujours :
- 1 fichier **migration** `NNN_description.sql` (numérotation continue, > dernière appliquée).
- 1 fichier **rollback** associé.
- **Impact analysis** : effet sur `payments`/escrow/reservations/RLS/realtime explicitement évalué (additif = 0 impact à prouver).
- **RLS review** : policies de la table touchée relues.
- Tester en **rollback observable** sur Postgres local jetable (`BEGIN; … ROLLBACK;`, harness `proof_*.sql`), jamais sur la prod.
- Appliquer prod via `db query -f` + `migration repair`. **Jamais `db push`.**

---

# FRONTEND RULES

Toujours :
- **Loading states** (chaque écran async).
- **Empty states** (listes vides, garde « connecte-toi »).
- **Error handling** — `lib/errorHandler.ts` / `extractErrorMessage` (jamais « [object Object] ») ; toujours lire `{ error }` des appels Supabase.
- **Typage strict** TS (réduire les 18 erreurs résiduelles, ne pas en ajouter).
- **UI instantanée** (exigence produit) : optimistic update + pubsub in-process + realtime (3 couches).
- Hooks dédiés par domaine (`hooks/use*.ts`) ; pas de logique Supabase inline dans les écrans.
- Attention React #310 : pas de hooks après early return (piège récurrent dans `reserver-*.tsx`).

---

# GITHUB WORKFLOW

- **Branches** — `main` protégée (ruleset `17572556`) : PR obligatoire (0 reviewer, solo dev), force-push interdit, suppression interdite, branche à jour exigée, **squash-only**, bypass admin DanP88.
- **PR** — depuis une branche `feat/*` ou `fix/*` ; CI requise : **Build Application + Test Suite** (lint/security/database = advisory). Pousser une branche = Preview Vercel (jamais prod).
- **Review** — auto (solo) ; vérifier CI verte + Vercel Preview verte avant merge.
- **Merge** — squash → `main` ; **c'est le merge qui met en prod** (Vercel Production). Supprimer la branche après merge.
- Commits : terminer par `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Ne commiter/pousser que si demandé.

---

# SUPABASE WORKFLOW

1. Écrire `NNN_*.sql` + `NNN_*_rollback.sql`.
2. **Valider** en rollback observable sur cluster Postgres local jetable (harness).
3. **Déployer** prod : `supabase db query -f supabase/migrations/NNN_*.sql --linked` puis `supabase migration repair --status applied NNN --linked`. Jamais `db push`.
4. Vérifier objets présents (`\df`, `\dt`, policies) et recette interactive.
5. Edge : `supabase functions deploy <fn>` (`webhook-stripe`/`send-push` = `--no-verify-jwt`).

---

# VERCEL WORKFLOW

- **Build** — `expo export --platform web` (doit être vert ; vérifier que le bundle contient les nouveaux marqueurs).
- **Preview** — chaque push de branche → déploiement Preview (URL 401 si non autorisée). Sert à valider, pas à livrer.
- **Production** — déclenchée par **merge sur `main`** ; les 2 projets servent le nouveau bundle (attention cache navigateur : hard refresh).

---

# TESTING CHECKLIST

- [ ] `npx tsc --noEmit` — pas de **nouvelle** erreur (18 pré-existantes tolérées).
- [ ] `expo export --platform web` vert ; bundle contient les nouveaux symboles.
- [ ] Harness SQL rollback PASS sur cluster local (si migration).
- [ ] RLS testée : insert own OK, cross-user bloqué, admin OK.
- [ ] Parcours métier E2E du module touché (Stripe **test** 4242, comptes `.app` réels — pas les quick-login `.test` mock).
- [ ] Escrow : `held` → release → `transfer` → résa `completed` vérifiés si paiement touché.
- [ ] Realtime : update visible sans refresh ; badge/compteur cohérents.
- [ ] Empty/loading/error states présents.

# PR CHECKLIST

- [ ] Branche `feat/*` ou `fix/*` depuis `main` à jour.
- [ ] Migration(s) + rollback inclus et nommés.
- [ ] tsc OK (pas de régression) + build web vert.
- [ ] Description : impact métier / DB / Stripe / Analytics / Sécurité + niveau de risque P0–P3 + plan de recette + rollback.
- [ ] Fichiers parasites exclus du commit.
- [ ] CI verte + Vercel Preview verte.

# MERGE CHECKLIST

- [ ] CI Build + Test vertes.
- [ ] Preview validée (recette).
- [ ] **Squash** merge.
- [ ] Si migration : appliquée prod (`db query -f` + `repair`) **avant ou en cohérence** avec le merge front.
- [ ] Vérifier Vercel Production Ready post-merge + marqueurs en ligne.
- [ ] Supprimer la branche.

# PRODUCTION DEPLOYMENT CHECKLIST

- [ ] Migration appliquée prod + `migration list` aligné local↔remote.
- [ ] Edge déployées (`--no-verify-jwt` pour webhook-stripe/send-push).
- [ ] Crons actifs (`net._http_response.status_code`, pas `job_run_details`).
- [ ] Stripe : mode (test/live) confirmé pour le contexte.
- [ ] Vercel Production Ready, bundle servi vérifié (hard refresh).
- [ ] Notif/realtime/badge testés en session connectée réelle.
- [ ] Rollback prêt (migration rollback + revert PR).

---

# HISTORICAL INCIDENTS

- **2026-06-14 — Signup « permission denied for table users »** — *Symptôme* : crash à l'inscription. *Cause* : upsert front post-`auth.signUp` exécuté en `anon` (confirmation email ON → pas de session → GRANT SELECT seul), alors que la row est déjà provisionnée par `handle_new_user_v2`. *Correction* : suppression de l'écriture front (PR #26, mig non requise). *Prévention* : ne jamais écrire `public.users` côté client au signup ; laisser le trigger DB. Ce n'était PAS une régression RLS.
- **2026-06-11 — Cron auto-release escrow cassé (mig 066)** — *Symptôme* : fonds jamais libérés automatiquement. *Cause* : `escrow-cron-release` écrivait `release_trigger:"cron"` ⛔ CHECK `payments_release_trigger_check` (attend `auto_cron`) + timeout pg_net 5s. *Correction* : `cron`→`auto_cron`, `timeout_milliseconds:=30000`, mutex `escrow_cron_lock`. *Prévention* : respecter les CHECK enums ; diag cron via `net._http_response.status_code`.
- **2026-06-08 — Surbooking transport (F1, mig 060)** — *Symptôme* : places jamais décrémentées + place fantôme au remboursement. *Cause* : parcours `pending→paid` saute `accepted` ; F1 ne consommait qu'au `pending→accepted`. *Correction* : `fn_availability_transport` symétrique sur S={accepted,awaiting_payment,paid,completed} + backfill (060b). *Prévention* : raisonner en **ensemble de statuts consommants**, pas en transition unique. ⚠️ Même défaut **non corrigé sur Stage+Box** (Stage partiellement traité 062 ; à vérifier).
- **2026-06-10 — Domaine Resend non vérifié** — *Symptôme* : ~50 % des emails échouent (`Resend 403`), seul l'owner reçoit. *Cause* : domaine `equishow.app` sans NS/SOA (jamais enregistré). *Correction* : aucune (bloquant infra). *Prévention* : enregistrer domaine + MX/SPF/DKIM + Verify avant lancement ; ne pas supposer un domaine validé.
- **2026-06-17 — Import concours CSV écrivait 0 ligne (mig 079)** — *Symptôme* : import « terminé » mais 0 concours. *Cause* : `ON CONFLICT(numero_ffe)` → 42P10 (index partiel non inférable) + RLS admin `is_admin()` false pour tous + erreurs avalées front + dédup contre store mémoire pollué. *Correction* : vraie `UNIQUE(numero_ffe)` + policies admin sur `users.role='admin'` + dédup contre la base + compteurs séparés + bouton vider cache. *Prévention* : index partiel non inférable par ON CONFLICT ; RLS admin = `role='admin'`.
- **Webhook Stripe `verify_jwt`** — *Symptôme* : paiements bloqués `pending` (gateway 401 avant le code). *Cause* : `webhook-stripe` déployé avec `verify_jwt=true`. *Correction/Prévention* : **toujours `--no-verify-jwt`** (auth = signature HMAC). Pérennisé dans `config.toml`. Idem `send-push` (secret `x-push-secret`).
- **2026-05-20 — Stripe « 112,50 € vs 94,50 € » (mig 036)** — *Symptôme* : montant gonflé au checkout. *Cause* : TVA dans les triggers d'autorité serveur. *Correction* : retrait TVA (modèle sans HT/TTC). *Prévention* : pas de logique TVA ; seller_amount + platform_fee.
- **Migrations — « 011/012 jamais appliquées »** — *Symptôme* : doute récurrent. *Cause* : artefact MCP/InstallCom (MCP voyait le mauvais projet). *Correction/Prévention* : 011/012 bien appliquées sur `vhkjvnpxcqlmpokrgymx` ; **toujours passer par le CLI**, jamais le MCP.

---

# TECHNICAL DEBT

**P0 (bloquant lancement, infra)**
- Stripe `sk_live` non confirmé (clés test présumées en prod).
- Domaine Resend `equishow.app` non vérifié → ~50 % emails échouent.
- Onboarding vendeur live non validé.

**P1 (risque métier/financier)**
- Bug F1 surbooking **Stage+Box** : porter la logique symétrique (mig 060) — risque de survente sur paiement réel. _(Stage partiellement couvert 062 — à vérifier précisément.)_

**P2 (cohérence/qualité)**
- Concours **dual-source** : 7 écrans lisent encore `concoursStore` (mock) — `creer-concours`, `(tabs)/coach-concours`, `(tabs)/services`, `proposer-coach-annonce`, `(tabs)/concours`, `(tabs)/communaute`, `(tabs)/org-concours`. Brancher sur la table DB.
- 18 erreurs TS pré-existantes (surtout `reserver-transport.tsx` : `transport` possibly undefined ; `boost-coach` ; `AddressAutocomplete` ; `usePushNotifications` SDK54). À résorber avant de rendre le lint bloquant.

**P3 (entretien)**
- 23 fichiers parasites untracked à la racine (PDF/HTML propositions, `scripts/`, `proto-*`, `cleanup_*`, `vercel2.json`).
- ~30 branches locales mortes (features mergées non supprimées en local).
- Push mobile EAS (0 projet, Apple Dev 99 $ pour iOS) — en pause.
- Discussions LOT 2 : fil participants, @user, push, notif de mention (archi prête, non câblée).
- Location de van : dates/cautions (R4/CR6) à finir avant ouverture publique.

---

# Roadmap Priorisée

> Vue **forward-looking** (quoi faire ensuite). La section TECHNICAL DEBT en est l'inventaire détaillé ; ici = priorisation avec impact + dépendances. En cas d'écart, TECHNICAL DEBT fait foi sur le détail technique.

## P0 — Critique (bloquant lancement / stabilité)
- **Confirmer Stripe `sk_live`** — *Impact* : sans clés live, aucun paiement réel possible. *Dépend de* : compte Stripe live + swap secrets + redeploy Edge.
- **Vérifier le domaine Resend `equishow.app`** — *Impact* : ~50 % des emails transactionnels échouent (seul l'owner reçoit). *Dépend de* : enregistrement domaine + MX/SPF/DKIM + Verify Resend.
- **Valider l'onboarding vendeur live** — *Impact* : pas de release de fonds sans compte Connect vendeur opérationnel. *Dépend de* : Stripe live.
- **Porter le fix F1 surbooking sur Stage+Box** — *Impact* : risque de survente sur paiement réel (parcours `pending→paid`). *Dépend de* : modèle mig 060 (ensemble de statuts consommants) ; vérifier d'abord l'état exact de 062 (Stage).

## P1 — Important (forte valeur métier)
- **Brancher les 7 écrans concours mock → DB** — *Impact* : cohérence des données concours (fin du dual-source). *Dépend de* : table `concours` + hooks `useConcours*` (déjà prêts).
- **Discussions LOT 2 (suite)** : fil participants, mentions `@user`, push + notif de mention — *Impact* : engagement communautaire. *Dépend de* : archi Discussions déjà en place (non câblée).
- **Push mobile (EAS)** — *Impact* : notifications natives Android/iOS. *Dépend de* : projet EAS + compte Apple Developer (99 $) ; sender Edge + tokens déjà prêts.

## P2 — Améliorations (UX / analytics / automatisation)
- **Résorber les 18 erreurs TS** (surtout `reserver-transport.tsx`) — *Impact* : qualité, prérequis avant lint bloquant. *Dépend de* : rien.
- **KPI notifications + rétention/cohortes** dans admin-analytics — *Impact* : pilotage produit. *Dépend de* : `user_events` (en place).
- **Location de van** (dates, anti-chevauchement GiST, cautions) — *Impact* : nouveau revenu transport. *Dépend de* : lot R4/CR6.
- **Nettoyage repo** : 23 fichiers parasites untracked + ~30 branches locales mortes — *Impact* : hygiène. *Dépend de* : rien.

---

# ARCHITECTURE DECISIONS

- **Escrow Separate Charges & Transfers** — *Contexte* : marketplace, besoin de retenir les fonds jusqu'à la prestation. *Décision* : escrow custom module-agnostique (`_shared/escrow.ts`), release auto/manuel/admin. *Justification* : protège acheteur ET vendeur, gère litiges. *Impact* : `payments` = source de vérité unique ; modèle « silence = release ».
- **Montants serveur-authoritative (mig 051)** — *Décision* : recalcul des montants par triggers DB. *Justification* : le client ne doit jamais imposer un prix. *Impact* : sécurité financière, mais toute évolution de prix passe par `get_commission_rate`/recalc.
- **Anti-fraude transitions (mig 047)** — *Décision* : guard triggers bloquant les passages de statut sensibles. *Impact* : service_role bypass requis pour les Edge.
- **Concours = hub de découverte contextuel** — *Décision* : pas de panier/escrow unique multi-modules ; chaque module reste indépendant. *Justification* : le concours augmente la conversion sans devenir obligatoire. *Impact* : cross-sell « Mon déplacement », filtre `concours_id` sur les annonces.
- **Discussions Option C (1 fil public par concours)** — *Décision* : identité = pseudo + avatar couleur (pas de nom/club/niveau), tout user connecté écrit, snapshot identité rempli serveur. *Impact* : pas de nouvelle table par fil ; tags implicites par détection hashtag.
- **Org Radar RGPD-aware** — *Décision* : agrégats réels uniquement, masquage < 5, jamais de nominatif ni « inscrits FFE ». *Impact* : pas de KPI fabriqué en prod.
- **CLI Supabase, jamais MCP ni `db push`** — *Décision* : appliquer les migrations par `db query -f` + `migration repair`. *Justification* : MCP claude.ai cassé (voit InstallCom) ; `db push` refusé (risque). *Impact* : process manuel mais sûr.
- **Modèle sans TVA** — *Décision* : seller_amount + platform_fee, pas de HT/TTC. *Justification* : simplicité, bug TVA historique. *Impact* : ne pas réintroduire de prix_ht.
- **Main protégée + squash-only (solo dev)** — *Décision* : ruleset GitHub, prod gated par PR + CI. *Impact* : prod = merge, jamais push direct.

---

# Maintenance Policy

CLAUDE.md est la **source de vérité unique** du projet. Il doit rester **synthétique et opérationnel** (pas un journal exhaustif — l'historique long vit dans la mémoire Obsidian/`MEMORY.md`).

**Règles de maintenance**
- Toute **nouvelle fonctionnalité majeure** → documenter dans FUNCTIONAL MODULES + CURRENT STATUS.
- Toute **migration Supabase importante** (table, policy RLS, trigger, fonction, vue, bucket) → documenter dans DATABASE/STORAGE ARCHITECTURE + mettre à jour le numéro de migration dans l'en-tête.
- Toute **décision d'architecture** → ajouter une entrée dans ARCHITECTURE DECISIONS (contexte / décision / justification / impact).
- Toute **dette technique** identifiée → ajouter dans TECHNICAL DEBT (P0–P3) + refléter dans la Roadmap si actionnable.
- Toute **information obsolète** → supprimer ou déplacer dans HISTORICAL INCIDENTS (ne pas laisser de contradiction).
- Ne **pas dupliquer** : éditer la section existante plutôt que créer une nouvelle.

**Déclencheur** — après toute évolution importante (fonctionnalité, table, migration, policy, trigger, dashboard, workflow Stripe, module, changement d'archi ou de sécurité), Claude Code **doit proposer** :

> « Cette modification semble nécessiter une mise à jour de CLAUDE.md. Souhaitez-vous que je mette à jour la documentation du projet ? »

---

# CLAUDE CODE GUIDANCE

Quand Claude travaille sur Equishow, **toujours** :
- Lire ce CLAUDE.md d'abord et respecter les conventions documentées.
- Vérifier l'impact **métier**, **base de données** (RLS/index/triggers), **Stripe/escrow**, **analytics**, **sécurité**.
- Fournir un **niveau de risque P0/P1/P2/P3**.
- Fournir un **plan de validation** (recette) et un **rollback** si pertinent.
- Préserver l'existant (UI, logique, RLS, routes, services) ; ne jamais écraser de code sans validation.
- Migrations : additives + rollback + CLI (`db query -f` + `repair`), jamais `db push`.
- Edge : `webhook-stripe` / `send-push` toujours `--no-verify-jwt`.
- Prod = merge sur `main`, jamais push direct ; squash-only.
- Tester avec Stripe **test** (4242) et comptes `.app` réels, pas les quick-login mock.
- En cas de doute sur un fait : vérifier dans le code avant d'affirmer (ne pas inventer).

---

_Fin de CLAUDE.md — généré par audit du repo (`expo_app/` + `supabase/`) le 2026-06-21._
