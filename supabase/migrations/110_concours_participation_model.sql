-- ============================================================================
-- 110 — CONCOURS PARTICIPATION MODEL · préparation recentrage concours (Phase 1)
-- ============================================================================
-- Périmètre : extension MINIMALE de concours_presence (089) + nouvelle table
--   concours_presence_chevaux (multi-cheval), pour représenter :
--     Utilisateur X → participe au concours Y → avec tel(s) cheval(aux) →
--     sur telle(s) épreuve(s).
--
-- 100% ADDITIF. Ne touche NI payments, NI escrow, NI Stripe, NI webhooks,
-- NI RLS existantes de concours_presence / concours_followers / chevaux, NI V1
-- (useConcoursPresence.ts continue de fonctionner à l'identique — cheval_id
-- singulier conservé, aucune colonne existante renommée/supprimée).
--
-- IMPORTANT — pas de duplication d'état :
--   Les statuts Transport/Box/Coach (recherche en cours, demande envoyée,
--   acceptée, paiement en attente, payée, confirmée, terminée...) restent
--   DÉRIVÉS EXCLUSIVEMENT des tables métier réelles (box_annonces/
--   box_reservations, transport_annonces/transport_reservations,
--   coach_annonces/course_demands). Cette migration n'ajoute AUCUNE colonne
--   de statut dupliqué. Les 3 colonnes *_skip ci-dessous représentent
--   UNIQUEMENT une décision explicite de l'utilisateur ("je n'ai pas besoin
--   de ce service pour ce concours") — jamais un état de réservation.
--
-- epreuves (text[]) : snapshot des libellés choisis par le cavalier, mêmes
--   libellés que concours.liste_epreuves (074). Aucun identifiant d'épreuve
--   stable n'existe côté FFE (vérifié sur données prod réelles : le seul
--   numéro présent est celui du CONCOURS, pas de l'épreuve ; un même libellé
--   peut légitimement apparaître 2× pour 2 épreuves distinctes sur des jours
--   différents) → text[] est le format cohérent et suffisant pour le MVP,
--   pas de sur-ingénierie sur du texte libre sans clé naturelle.
--
-- Idempotent. Application : supabase db query -f <file> --linked
--   puis supabase migration repair --status applied 110. JAMAIS db push.
-- Rollback : 110_concours_participation_model_rollback.sql
-- Tests : supabase/tests/110_concours_participation_model/harness.sql
-- ============================================================================

begin;

-- ── 0. Pré-conditions ────────────────────────────────────────────────────────
do $$
begin
  if to_regclass('public.concours_presence') is null then
    raise exception '110 requiert 089 : table public.concours_presence absente.';
  end if;
  if to_regclass('public.chevaux') is null then
    raise exception '110 requiert 014 : table public.chevaux absente.';
  end if;
end $$;

-- ── 1. concours_presence — extension additive (4 colonnes) ──────────────────
alter table public.concours_presence
  add column if not exists epreuves text[] not null default '{}';

alter table public.concours_presence
  add column if not exists transport_skip boolean not null default false;
alter table public.concours_presence
  add column if not exists box_skip boolean not null default false;
alter table public.concours_presence
  add column if not exists coach_skip boolean not null default false;

comment on column public.concours_presence.epreuves is
  '110 — libellés d''épreuves choisis par le cavalier (snapshot texte). '
  'Pas de FK : aucun identifiant d''épreuve stable côté FFE.';
comment on column public.concours_presence.transport_skip is
  '110 — décision explicite "pas besoin de transport pour ce concours". '
  'Ne reflète JAMAIS un statut de réservation réel (dérivé de transport_reservations).';
comment on column public.concours_presence.box_skip is
  '110 — décision explicite "pas besoin de box pour ce concours". '
  'Ne reflète JAMAIS un statut de réservation réel (dérivé de box_reservations).';
comment on column public.concours_presence.coach_skip is
  '110 — décision explicite "pas besoin de coach pour ce concours". '
  'Ne reflète JAMAIS un statut de réservation réel (dérivé de course_demands).';

-- ── 2. Table concours_presence_chevaux (multi-cheval) ───────────────────────
-- cheval_id (singulier, 089) sur concours_presence reste intact pour compat V1
-- (useConcoursPresence.ts) — non remplacé, seulement complété.
create table if not exists public.concours_presence_chevaux (
  concours_id uuid not null,
  user_id     uuid not null,
  cheval_id   uuid not null references public.chevaux(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (concours_id, user_id, cheval_id),
  constraint cpc_presence_fk
    foreign key (concours_id, user_id)
    references public.concours_presence (concours_id, user_id)
    on delete cascade
);

comment on table public.concours_presence_chevaux is
  '110 — chevaux engagés par un utilisateur sur un concours (multi-cheval). '
  'Complète concours_presence.cheval_id (singulier, conservé pour compat V1). '
  'Hors chemin paiement.';

-- ── 3. Index ─────────────────────────────────────────────────────────────────
-- "Mes chevaux engagés" (côté user). concours_id/user_id couverts par le
-- préfixe gauche de la PK.
create index if not exists idx_cpc_user on public.concours_presence_chevaux (user_id);

-- ── 4. RLS ───────────────────────────────────────────────────────────────────
alter table public.concours_presence_chevaux enable row level security;

-- SELECT : même ouverture que concours_presence (089) — cohérence : si on peut
-- voir la présence, on peut voir les chevaux qui l'accompagnent.
drop policy if exists cpc_select_auth on public.concours_presence_chevaux;
create policy cpc_select_auth
  on public.concours_presence_chevaux for select
  to authenticated
  using (true);

-- INSERT : own row (user_id = auth.uid()) ET le cheval doit RÉELLEMENT
-- appartenir à l'utilisateur (chevaux.proprietaire_id = auth.uid()). Empêche
-- un utilisateur de rattacher à sa participation le cheval d'un autre en
-- connaissant simplement son UUID. Lecture seule de `chevaux` via sous-requête
-- — AUCUNE policy existante de `chevaux` n'est modifiée par cette migration.
drop policy if exists cpc_insert_own on public.concours_presence_chevaux;
create policy cpc_insert_own
  on public.concours_presence_chevaux for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.chevaux c
      where c.id = cheval_id and c.proprietaire_id = auth.uid()
    )
  );

-- DELETE : own only.
drop policy if exists cpc_delete_own on public.concours_presence_chevaux;
create policy cpc_delete_own
  on public.concours_presence_chevaux for delete
  to authenticated
  using (user_id = auth.uid());
-- Pas d'UPDATE : rattacher/détacher un cheval = INSERT/DELETE (même principe
-- que concours_followers, 075).

-- ── 5. Backfill depuis concours_presence.cheval_id (singulier, pré-existant) ─
-- Idempotent (on conflict do nothing). Exécuté par le rôle propriétaire de la
-- migration (bypass RLS, comportement standard d'un backfill de migration).
insert into public.concours_presence_chevaux (concours_id, user_id, cheval_id)
select concours_id, user_id, cheval_id
from public.concours_presence
where cheval_id is not null
on conflict do nothing;

commit;
