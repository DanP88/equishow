-- ============================================================================
-- 078 — Réservations : cheval_id nullable (V1, optionnel, sans obligation métier)
-- ============================================================================
-- Permet de rattacher une réservation à un cheval du cavalier (menu déroulant
-- « Cheval concerné »). 100 % ADDITIF, nullable, ON DELETE SET NULL → ne casse
-- aucun flux paiement/escrow, n'altère aucune RLS, aucune contrainte existante,
-- aucune donnée. Stripe non touché. V1 = aucune obligation (cheval_id peut rester
-- NULL = « Aucun cheval sélectionné »).
--
-- Tables : box_reservations, transport_reservations, course_demands,
--          stage_reservations. FK → public.chevaux(id).
--
-- Application : supabase db query -f supabase/migrations/078_*.sql --linked
--               puis supabase migration repair --status applied 078 --linked. JAMAIS db push.
-- Rollback : 078_reservations_cheval_id_rollback.sql
-- ============================================================================

begin;

alter table public.box_reservations
  add column if not exists cheval_id uuid references public.chevaux(id) on delete set null;
alter table public.transport_reservations
  add column if not exists cheval_id uuid references public.chevaux(id) on delete set null;
alter table public.course_demands
  add column if not exists cheval_id uuid references public.chevaux(id) on delete set null;
alter table public.stage_reservations
  add column if not exists cheval_id uuid references public.chevaux(id) on delete set null;

create index if not exists idx_box_reservations_cheval       on public.box_reservations(cheval_id)       where cheval_id is not null;
create index if not exists idx_transport_reservations_cheval on public.transport_reservations(cheval_id) where cheval_id is not null;
create index if not exists idx_course_demands_cheval         on public.course_demands(cheval_id)         where cheval_id is not null;
create index if not exists idx_stage_reservations_cheval     on public.stage_reservations(cheval_id)     where cheval_id is not null;

comment on column public.box_reservations.cheval_id       is '078 — cheval concerné (optionnel, V1).';
comment on column public.transport_reservations.cheval_id is '078 — cheval concerné (optionnel, V1).';
comment on column public.course_demands.cheval_id         is '078 — cheval concerné (optionnel, V1).';
comment on column public.stage_reservations.cheval_id     is '078 — cheval concerné (optionnel, V1).';

commit;
