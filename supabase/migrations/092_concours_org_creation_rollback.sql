-- ============================================================================
-- ROLLBACK 092 — CONCOURS · CRÉATION ORGANISATEUR (PR2-A)
-- ============================================================================
-- Réversible à 100%. Restaure l'état 091 : fn_org_owns_concours claim-only,
-- SELECT public (true), FK organisateur_id → profiles(id), retrait statut/infos
-- + index + policies org. Ne recrée aucune donnée (organisateur_id reste tel quel ;
-- en prod il est 0-peuplé). 0 Stripe/escrow/payments/webhook/email/marketplace.
--
-- ⚠️ Le re-FK vers profiles(id) exige que tout organisateur_id peuplé existe dans
-- profiles. En prod : 0 ligne peuplée → sans risque.
-- ============================================================================

begin;

-- 5. fn_org_owns_concours : version antérieure (claim approuvé + admin) — état 076/077.
create or replace function public.fn_org_owns_concours(p_concours_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.concours_claims
    where concours_id = p_concours_id
      and organisateur_id = auth.uid()
      and status = 'approved'
  ) or exists (
    select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'
  );
$$;

-- 4. RLS : retirer insert/update org + restaurer SELECT public (true).
drop policy if exists concours_select_visible on public.concours;
create policy concours_select_all on public.concours
  for select using (true);

drop policy if exists concours_update_organisateur on public.concours;
drop policy if exists concours_insert_organisateur on public.concours;

-- 3. Index.
drop index if exists public.idx_concours_organisateur_id;

-- 2. FK : repointer users(id) → profiles(id) (état antérieur).
alter table public.concours drop constraint if exists concours_organisateur_id_fkey;
alter table public.concours
  add constraint concours_organisateur_id_fkey
  foreign key (organisateur_id) references public.profiles(id) on delete set null;

-- 1. Colonnes statut + infos + CHECK.
alter table public.concours drop constraint if exists concours_statut_check;
alter table public.concours drop column if exists infos;
alter table public.concours drop column if exists statut;

commit;
