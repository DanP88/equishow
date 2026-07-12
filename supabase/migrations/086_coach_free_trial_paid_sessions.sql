-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 086 — Essai gratuit Coach : 3 premières séances de coaching payées
--
-- ⚠️ NON APPLIQUÉE EN PROD à ce stade. Le front calcule le compteur côté client
--    (lecture `payments`, RLS payments_select_parties). Cette migration fournit
--    l'équivalent SERVEUR (RPC robustes) pour une bascule ultérieure.
--
-- 100% ADDITIF : crée 2 fonctions en lecture seule. Aucune table/colonne modifiée,
-- AUCUN impact escrow / réservation / abonnements. SECURITY DEFINER + search_path.
--
-- Définition « séance coach payée et validée » (payments-authoritative) :
--   type='course' ∧ transfer_state='released' ∧ payment_status='succeeded'
--   ∧ refunded_at IS NULL ∧ dispute_status ∉ {open, resolved_refund}
--
-- Dépendance : fn_is_paid_plan(text) (mig 032) pour « Pro actif ».
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Compteur de séances coach payées + validées ─────────────────────────────
create or replace function public.fn_coach_paid_sessions(p_coach uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from public.payments p
  where p.seller_id = p_coach
    and p.type = 'course'
    and p.transfer_state = 'released'
    and p.payment_status = 'succeeded'
    and p.refunded_at is null
    and coalesce(p.dispute_status, '') not in ('open', 'resolved_refund');
$$;

-- ── État d'accès du coach courant (auth.uid) ────────────────────────────────
create or replace function public.fn_my_coach_access()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_count    integer;
  v_plan     text;
  v_plan_id  text;
  v_has_pro  boolean;
begin
  select plan, plan_id into v_plan, v_plan_id
  from public.users where id = auth.uid();

  v_count   := public.fn_coach_paid_sessions(auth.uid());
  v_has_pro := public.fn_is_paid_plan(coalesce(v_plan_id, v_plan));

  return json_build_object(
    'paid_sessions',  v_count,
    'limit',          3,
    'has_pro',        v_has_pro,
    'trial_active',   v_count < 3,
    'can_accept_new', (v_count < 3) or v_has_pro
  );
end;
$$;

grant execute on function public.fn_coach_paid_sessions(uuid) to authenticated;
grant execute on function public.fn_my_coach_access() to authenticated;
