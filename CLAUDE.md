# CLAUDE.md — Equishow

> **Source de vérité du projet.** Résumé stratégique. Les détails volumineux sont dans `docs/` (liens en bas de chaque section).
> MAJ : 2026-07-31 · repo `main` @ `7cd973e` · migrations fichiers → **103** (…103 appliquées prod). **0 PR ouverte.**
> Légende : ✅ observé · 🟡 partiel · 🔴 bloquant · _(déduit)_ à confirmer.

## Session startup
1. Lire CLAUDE.md (source de vérité). 2. `ls supabase/migrations | tail` + `git log --oneline -10` + `gh pr list` → repérer les écarts doc↔code. 3. Mettre à jour le doc si divergence. 4. **Ne jamais supposer un état prod non vérifié** (migration appliquée / secret live / cron actif = vérifier via CLI Supabase, sinon _(déduit)_).

---

# Overview

App mobile compagnon du **cavalier de concours équestre** (Expo + Supabase, web sur Vercel). Agrège ce qui est éparpillé (WhatsApp, FFECompet, PDFs) : trouver/proposer **box, transport, coach, stage** en contexte d'un concours, avec **paiement sous séquestre (escrow)** et couche communautaire. Le concours = point d'entrée de découverte, jamais obligatoire.

Marché : 350–400k compétiteurs FR / 1,3M Europe. Marketplace à commission (~9 % ajoutée au checkout, modèle **sans TVA**).

# Current Status

🟢 **code prêt** / 🔴 **infra commerciale non prête**. `main` @ `7cd973e`, **0 PR ouverte**.

- ✅ 4 modules marketplace + escrow (box/transport/coach/stage), anti-surbooking, capacité créneau coach.
- ✅ Stripe Connect + séquestre + crons release/expiration ; litiges + remboursements + alerting.
- ✅ Notifs in-app + push serveur ; emails Resend ; messagerie ; communauté ; avis ; badges.
- ✅ Concours : import CSV FFE (297 prod), fiche/météo/épreuves, followers, discussions (tags+réponses+mentions), claim org + Radar. **Création persistée en base** (PR #74/PR2-B, `main bce1a95`) : l'organisateur crée un concours réel dans `public.concours` en **`statut='brouillon'`** (`organisateur_id=auth.uid()`, RLS `concours_insert_organisateur` : rôle organisateur requis) ; seuls les concours **`publie`** apparaissent dans les listes publiques, **filtre appliqué côté application** (`useConcoursList().eq('statut','publie')`). **Import robuste à l'encodage** (PR #62, `main 4571b4c`) : gère UTF-8, Windows-1252 et le double-encodage (`lib/encoding.ts`, lecture à l'octet).
- ✅ Dashboards admin : analytics, litiges, commissions, réclamations (EQ-REC), notifications.
- ✅ Coach Freemium (PR #64, `789e4d4`) : Pro gratuit jusqu'aux **3 premières séances payées** + anti-abus identité Stripe Connect ; migs **085/086/087 appliquées prod** ; RPC `fn_my_coach_trial_status` (compteur serveur-authoritative) ; paywall doux sur `coach-demandes` ; **mig 085 appliquée prod 2026-07-17** : cleanup plans legacy cavalier (2 users migrés vers `gratuit`) ; table `_backup_users_plan_085` supprimée prod par **mig 097** (PR #93, 2026-07-29).
- ✅ Social / Hub Concours PR1 (PR #65, `422fd50`, **mig 088 appliquée prod**) : graphe **`user_follows`** (suivi **asymétrique Instagram-like**, sans demande/acceptation) + RPC `fn_people_i_know` (« personnes que je connais »). Bouton **Suivre persistant** (profils coach + cavaliers via Communauté/Services câblés sur de vrais `users.id`). **Aucun payments/escrow/Stripe/webhook touché.** Fondation des lots suivants (présence concours, hero « X que vous connaissez »).
- ✅ Discussions concours LOT2 (PR #71, `main e4a99e7`, **mig 091 appliquée prod**) : ✅ **fil participants** · ✅ **mentions @user** · ✅ **notifications de mention** (`concours_mention`) · ✅ **migration 091 appliquée** · ✅ **en production**. Trigger `fn_notify_concours_mention` (dédup, best-effort) ; jeton typé `@[](user|concours:UUID)` (rétro-compat @concours). CI verte, harness 12/12, recette prod PASS, 0 régression LOT1. Aucun payments/escrow/Stripe/webhook touché.
- ✅ Sécurité — escalade de privilège fermée + autorisations admin unifiées (2026-07-12/13) : **mig 093 (PR #82, prod)** garde anti auto-promotion `users.role` (trigger `trg_users_guard_role` SECURITY INVOKER) ; **mig 094 (PR #83, prod)** verrou anti-escalade legacy `profiles.role_id` ; **mig 095 (PR #85, prod)** autorisations admin basées sur `users.role` via `is_app_admin()`. Harness 9/9 + 8/8 + 10/10, recettes prod PASS. **Dette sécurité : mig 097 ✅ prod (PR #93, 2026-07-29) ; 098 ✅ ; 099 ✅ ; 100 ✅ ; 101 ✅ (drop `is_admin()`) ; 102 ✅ (FK Transport → users, harness 10/10) ; mig 103 ✅ prod (PR #100 mergée `main 8345b9c`, 2026-07-29 — drop tables legacy `profiles`/`roles`, harness 13/13) — simplification de rôles **COMPLÈTE**.** **Aucun payments/escrow/Stripe/webhook touché.**
- ✅ Concours org — robustesse gestion (PR #91, `7cd973e`, 2026-07-31) : `etat` préservé en édition · ownership check `fetchConcoursForEdit` · PGRST116 mappé · faux état vide supprimé · mutations concurrentes bloquées (`isMutating`) · compare-and-set transitions + `republishConcours`. 0 migration · 0 RLS · 0 Stripe. Tests useConcours.test.ts 10/10.
- 🟡 Push mobile EAS en pause (0 projet) ; location van fermée. _(Concours mock→DB : `creer-concours` (PR #74) + `coach-concours` (PR #72) + gestion org PR2-C (PR #87/88/91) = ✅ complet. Chantier concours mock→DB **CLÔTURÉ**.)_
- 🔴 Bloquants lancement : Stripe `sk_live` non confirmé · domaine Resend non vérifié · onboarding vendeur live.

# Stack

- **Frontend** (`expo_app/`) : Expo 54 · React Native 0.81 · expo-router 6 · React Native Web · TypeScript 5.9.
- **Backend** (`supabase/`) : Postgres + Auth + Realtime + Storage + Edge Functions (Deno). Projet prod **`vhkjvnpxcqlmpokrgymx`** uniquement (PAS `wdhgsuulsuwdrtbvetaf` = InstallCom).
- **Paiement** : Stripe Connect (Separate Charges & Transfers / escrow custom).
- **Infra** : Vercel (web, 2 projets) · Resend (emails, domaine non vérifié) · pg_cron + pg_net · Sentry.
- Code vivant = `expo_app/` + `supabase/`. Legacy : `web/`, `web_app/`, `flutter_app/`, `api/`.

# Architecture

```
Client (Expo/RN Web) ─auth/CRUD─► Supabase Postgres (RLS) ─► Realtime ─► Client
       │ checkout                       │ ▲ triggers / pg_cron / pg_net
       ▼                                ▼ │
 Edge Functions (Deno) ◄─ webhook ◄─ Stripe (Connect + escrow) ──► Resend / Expo Push
```
- **Montants serveur-authoritative** (triggers `recalc_*`, mig 051) + anti-fraude transitions (triggers guard, mig 047).
- **Escrow module-agnostique** (`_shared/escrow.ts`) : paiement → `held` → release (auto/manuel/admin) → transfer → résa `completed`. Modèle « silence = release ».
- 91 écrans · 43 hooks · 29 composants · ~50 tables · 151 policies RLS.

# User Roles

Rôle dans `users.role` ; bascule via RPC `change_user_role`. Différences clés :
- **Cavalier** — réserve, paie (escrow), suit/discute concours, gère chevaux, avis (si `completed`).
- **Coach** — + crée annonces cours/stages, accepte demandes, profil + boost payant, reçoit fonds. ⚠️ un compte valide 1 type de barre à la fois (box/transport=cavalier, coach=coach, exclusives).
- **Organisateur** — + revendique concours → Radar (agrégats RGPD-aware, masquage < 5). Jamais de nominatif.
- **Admin** — dashboards, remboursements/litiges réels, approbation claims, import concours. Admin = `users.role='admin'` (**source de vérité autoritative**). `is_admin()` **supprimée (mig 101)**. Tables legacy `profiles`/`roles` **supprimées (mig 103)**. Toute nouvelle policy admin doit s'appuyer sur `users.role='admin'` via `is_app_admin()`.

# Functional Modules

| Module | Objectif | Statut | Points sensibles |
|---|---|---|---|
| Concours | Hub découverte contextuel | ✅ | **création persistée en DB** (`creer-concours`→INSERT réel, `statut='brouillon'`, filtre public `statut='publie'` côté app) ; import robuste à l'encodage (UTF-8/Windows-1252/double-encodage, `lib/encoding.ts`) ; reste PR2-C (édition/publication) ; `isMissingTable` doit couvrir PGRST205 → `docs/concours.md` ; **catégories FFE = table enfant `concours_categories` (084, 1 ligne=1 catégorie, FK `concours(id)` CASCADE)** affichée sur la fiche |
| Box | Hébergement cheval | ✅ escrow | dispo par chevauchement dates |
| Transport | Trajets partagés (+ van fermé) | ✅ escrow | colonne `statut` (FR) ≠ `status` ; van hors compteur places |
| Coach | Cours ponctuel | ✅ escrow | capacité créneau (mig 057, advisory lock) ; **Freemium : Pro gratuit jusqu'à 3 séances payées (`type=course`+`released`+`succeeded`) ; anti-abus doublon Stripe Connect ; migs 086/087 prod ; paywall doux `coach-demandes`** |
| Stage | Stages multi-jours | ✅ escrow | prix coach affiché, commission en modale récap |
| Chevaux | Fiches + historique résa | ✅ | photo → bucket `chevaux-photos` |
| Messagerie | Conversations 1:1 | ✅ | `conversation_reads` hors realtime (décrément pubsub) |
| Communauté | Posts par rôle | ✅ | likes + points ; auteurs (posts+commentaires) naviguent vers `/user-profile/<auteurId>` (vrai `users.id`) |
| Social (Follow) | Graphe de relations | ✅ | **mig 088** `user_follows` (PK `(follower_id,followee_id)`, `check` anti auto-follow, index followee, RLS own-only insert/delete + select authenticated) ; RPC read-only `fn_people_i_know(viewer)` (UNION `follows ∪ messagerie ∪ réservations box/stage/course/transport ∪ club si présent`, anti-énumération `viewer=auth.uid()` sauf admin). **Ne lit JAMAIS payments.** Front : `useFollow` (DB-backed), `FollowButton`. Dette : `users.club_name` absent (source club ignorée) ; `FollowListModal` encore mock → `docs/social.md` |
| Notifications | In-app + push | 🟡 | push mobile EAS en pause ; web OK |
| Analytics | Mesure produit + marketplace | ✅ | `event_type` figé par CHECK → `docs/analytics.md` |

# Critical Database Rules

- Migrations **additives** + **rollback obligatoire** (`NNN_*_rollback.sql`).
- **RLS obligatoire** sur toute nouvelle table (select/insert/update ciblés ; admin = `role='admin'`).
- **Index** à vérifier (FK, colonnes de filtre, anti-doublon UNIQUE).
- **Impact prod** à prouver (effet sur `payments`/escrow/reservations/RLS/realtime).
- Appliquer prod : `db query -f --linked` + `migration repair`. **Jamais `db push`** (CLI only, pas le MCP). Tester en rollback sur cluster local jetable.
- Détail : `docs/database.md`.

# Stripe Rules

- **Connect** : comptes vendeurs ; bypass en mode test. Montant serveur-authoritative.
- **Escrow** : `held` → release → transfer → `completed`. `release_trigger ∈ {manual_buyer, auto_cron, admin}`.
- **Commissions** : `get_commission_rate(service_type)` au checkout, visible en modale récap. Sans TVA.
- **Litiges** : `manage-dispute` + `payment_disputes` ; notif admins+vendeur, résolution→acheteur.
- **Webhooks** : `webhook-stripe` **toujours `--no-verify-jwt`** (auth = signature HMAC) sinon 401.
- Détail : `docs/stripe.md`.

# Analytics Rules

- **Tracking** : `lib/analytics.ts` → `user_events`. `event_type` figé : `{page_view,page_leave,cta_click,funnel_step,error,custom}` → CTA custom = `cta_click` + `action`.
- **Funnel** : `v_funnel_*`, pivot `reservation_id`.
- **KPIs** : GMV/commissions via `v_mkt_*` (source unique `payments`) ; Org Radar `fn_org_concours_radar`.
- Détail : `docs/analytics.md`.

# Historical Incidents

| Incident | Cause | Prévention |
|---|---|---|
| Stripe « 112,50 vs 94,50 € » (mig 036) | TVA dans triggers d'autorité | pas de logique TVA (seller_amount + platform_fee) |
| Signup « permission denied users » | upsert front `anon` (row déjà créée par trigger) | ne pas écrire `public.users` au signup |
| Radar `tr.status does not exist` (077) | `transport_reservations` = `statut` (FR) | `statut` pour transport, `status` ailleurs |
| Cron release escrow cassé (066) | `release_trigger:"cron"` ⛔ CHECK | utiliser `auto_cron` ; diag via `net._http_response` |
| Surbooking transport (060) | F1 ne consommait qu'au `pending→accepted` | ensemble de statuts consommants ; **Stage+Box fixés (062), Coach (057) — vérifiés harness `tests/062_availability_stage_box` (20/20)** |
| Import concours 0 ligne (079) | ON CONFLICT index partiel + RLS admin false | UNIQUE réel + admin `role='admin'` |
| Webhook 401 / paiements pending | `verify_jwt=true` | toujours `--no-verify-jwt` (signature HMAC) |
| Escalade self-admin `users.role` P0 (093) | policy `users_update_own` USING sans `WITH CHECK` + grant `UPDATE(role)` | trigger garde SECURITY INVOKER ; toute policy UPDATE sensible = `WITH CHECK` explicite |
| Escalade legacy `profiles.role_id` F2 (094) | policy UPDATE sans `WITH CHECK` + grant **table-level** couvrant `role_id` + `roles` lisible | grant **par colonne** (jamais table-level sur table à champ sensible) ; `search_path` épinglé sur SECURITY DEFINER |

Détail complet : `docs/incidents.md`.

# Technical Debt

- **P0** — Stripe `sk_live` à confirmer · domaine Resend `equishow.app` non vérifié (~50 % emails échouent) · onboarding vendeur live.
- **P1** — _(concours mock→DB : ✅ CLÔTURÉ — PR #72/74/87/88/91 mergées.)_ _(Discussions LOT2 : ✅ prod mig 091 ; reste push de mention, replié dans P3 EAS pause.)_
- **P2** — KPI notifications/rétention · location van (dates/cautions R4/CR6). _(TS : 0 erreur — dette « 18 erreurs reserver-transport.tsx » résolue PR #58, `0362bc6`, 2026-06-24.)_
- **P3** — push mobile EAS · 23 fichiers parasites untracked · branches locales mortes ✅ **nettoyées (2026-07-31, 39 local + 37 remote supprimées)** · **simplification système de rôles (095/098/099/100/101/102/103 faits — COMPLÈTE)** : `mig 096` = protection serveur limite d'essai coach (PR #92, prod 2026-07-20) ; `mig 097` = drop `_backup_users_plan_085` ✅ prod (PR #93, 2026-07-29) ; `mig 098` = REVOKE écriture `users_public` ✅ prod (PR #94, 2026-07-29) ; `mig 099` = REVOKE écriture `coach_stats` ✅ prod (PR #95, 2026-07-29) ; `mig 100` = `security_invoker=true` vues analytics ✅ prod (PR #96, 2026-07-29 — 3 alertes Security Advisor fermées) ; `mig 101` = drop `is_admin()` ✅ prod (PR #98, 2026-07-29 — 17 policies `is_app_admin` intactes, 0 ref `is_admin` restante) ; `mig 102` = assertion checkpoint FK Transport → `users(id)` ✅ prod (PR #99, 2026-07-29 — harness 10/10) ; `mig 103` = drop tables legacy `profiles`/`roles` ✅ **prod + main (PR #100 mergée `8345b9c`, 2026-07-29 — harness 13/13)**.

# Claude Code Guidance

Quand Claude travaille sur Equishow, **toujours** :
- Lire CLAUDE.md d'abord ; vérifier dans le code avant d'affirmer (ne pas inventer).
- Évaluer l'impact **métier / DB (RLS·index·triggers) / Stripe·escrow / sécurité / analytics**.
- Fournir un **niveau de risque P0/P1/P2/P3** + un **plan de test** + un **rollback** si pertinent.
- Préserver l'existant (UI, logique, RLS, routes, services) ; ne jamais écraser sans validation.
- Migrations additives + rollback + CLI (jamais `db push`). Edge `webhook-stripe`/`send-push` = `--no-verify-jwt`.
- Prod = **merge sur `main`** (squash-only, main protégée) ; jamais push direct. Tester Stripe **test** (4242) + comptes `.app` réels.

# Maintenance Policy

CLAUDE.md = source de vérité, **synthétique** (historique long → `MEMORY.md` Obsidian). Après toute évolution majeure (feature, table, migration, policy, trigger, dashboard, workflow Stripe, archi, sécurité) → mettre à jour la section + le détail `docs/` concerné, et **proposer** :
> « Cette modification semble nécessiter une mise à jour de CLAUDE.md. Souhaitez-vous que je mette à jour la documentation du projet ? »

Docs spécialisées : `docs/database.md` · `docs/stripe.md` · `docs/analytics.md` · `docs/concours.md` · `docs/social.md` · `docs/incidents.md`.
Skills : `.claude/skills/{supabase-auditor, stripe-connect-expert, analytics-expert, release-manager, prompt-generator}`.
