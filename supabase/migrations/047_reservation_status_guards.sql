-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 047 — Guards défensifs sur transitions de statut sensibles
--
-- Contexte (audit 2026-06-02, P0-1) :
--   Les policies RLS *_update_* sur course_demands / stage_reservations /
--   box_reservations / transport_reservations utilisent `USING` (qui filtre
--   les lignes éligibles à l'UPDATE) mais ne contraignent pas la valeur
--   écrite. Un cavalier ou un coach authentifié peut donc, via PostgREST
--   direct, passer une réservation en `status='paid'` (ou `statut='paid'`
--   pour transport) sans payer.
--
-- Stratégie :
--   - BEFORE UPDATE par ligne. Si la nouvelle valeur de status/statut entre
--     dans un état sensible (paid, completed, cancelled) ET que la valeur a
--     changé, on exige un appelant privilégié.
--   - Appelants autorisés :
--       * `auth.role() = 'service_role'` (webhook-stripe, process-refund,
--         release-payment, escrow-cron-release — tous les Edge Functions
--         utilisent la service_role key)
--       * connexion DB directe (current_user ∉ {authenticated, anon,
--         authenticator}) — couvre CLI, Studio admin, jobs internes
--       * `public.is_app_admin()` — utilisateur app avec role='admin'
--   - Les transitions NON sensibles (pending→accepted, accepted→rejected,
--     etc.) restent ouvertes — c'est le métier (coach/seller accepte).
--
-- Tables couvertes :
--   - course_demands         (col: status)  → paid/completed/cancelled
--   - stage_reservations     (col: status)  → paid/completed/cancelled
--   - box_reservations       (col: status)  → paid/completed/cancelled
--   - transport_reservations (col: statut)  → paid/cancelled
--   (`completed` n'existe pas dans le CHECK de transport_reservations.statut,
--   d'où la liste plus courte. Cf. mig 043.)
--
-- Bug corrigé annexe :
--   trg_transport_reservation_paid (mig 031:91) passait `new.id` (uuid depuis
--   mig 010) à `fn_award_points(p_ref_id text)` sans cast — provoquait une
--   erreur de fonction non résolue à chaque paiement transport. Ajout de
--   `::text` aligné avec les 3 autres triggers (course/stage/box).
--
-- Non destructif : CREATE FUNCTION + CREATE TRIGGER uniquement.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Helper : un appelant peut-il transitionner vers un statut sensible ? ────
create or replace function public.fn_can_bypass_reservation_guard() returns boolean
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_role text;
begin
  -- 1. service_role via PostgREST (Edge Functions, webhooks)
  v_role := auth.role();
  if v_role = 'service_role' then
    return true;
  end if;

  -- 2. Connexion DB directe (CLI, Studio sans JWT, cron pg). Le rôle session
  --    n'est ni `authenticated`, ni `anon`, ni `authenticator` (le rôle de
  --    login que PostgREST utilise avant `SET ROLE`).
  if current_user not in ('authenticated','anon','authenticator') then
    return true;
  end if;

  -- 3. Admin app-level (users.role = 'admin' authentifié via JWT)
  if public.is_app_admin() then
    return true;
  end if;

  return false;
end $$;

comment on function public.fn_can_bypass_reservation_guard() is
  'TRUE si l''appelant est service_role, admin app, ou connexion DB directe.
   Utilisé par les guards de transition de statut (mig 047).';


-- ── Trigger guard : course_demands / stage_reservations / box_reservations ─
--    (colonne `status`, états sensibles paid/completed/cancelled)
create or replace function public.trg_guard_status_transition() returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  if new.status not in ('paid','completed','cancelled') then
    return new;
  end if;

  if public.fn_can_bypass_reservation_guard() then
    return new;
  end if;

  raise exception
    'forbidden_status_transition: % -> % on %.% by %',
    coalesce(old.status, '<null>'),
    new.status,
    tg_table_schema,
    tg_table_name,
    coalesce(auth.role(), current_user)
    using errcode = '42501';  -- insufficient_privilege
end $$;


-- ── Trigger guard : transport_reservations (colonne `statut`, FR) ──────────
--    États sensibles : paid/cancelled (pas de 'completed' dans le CHECK).
create or replace function public.trg_guard_statut_transition() returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.statut is not distinct from old.statut then
    return new;
  end if;

  if new.statut not in ('paid','cancelled') then
    return new;
  end if;

  if public.fn_can_bypass_reservation_guard() then
    return new;
  end if;

  raise exception
    'forbidden_statut_transition: % -> % on %.% by %',
    coalesce(old.statut, '<null>'),
    new.statut,
    tg_table_schema,
    tg_table_name,
    coalesce(auth.role(), current_user)
    using errcode = '42501';
end $$;


-- ── Attache des triggers (BEFORE pour bloquer avant écriture) ──────────────
drop trigger if exists trg_guard_status_transition on public.course_demands;
create trigger trg_guard_status_transition
  before update on public.course_demands
  for each row execute function public.trg_guard_status_transition();

drop trigger if exists trg_guard_status_transition on public.stage_reservations;
create trigger trg_guard_status_transition
  before update on public.stage_reservations
  for each row execute function public.trg_guard_status_transition();

drop trigger if exists trg_guard_status_transition on public.box_reservations;
create trigger trg_guard_status_transition
  before update on public.box_reservations
  for each row execute function public.trg_guard_status_transition();

drop trigger if exists trg_guard_statut_transition on public.transport_reservations;
create trigger trg_guard_statut_transition
  before update on public.transport_reservations
  for each row execute function public.trg_guard_statut_transition();


-- ── Fix annexe : trg_transport_reservation_paid passait new.id (uuid) à
--    fn_award_points(p_ref_id text). Mig 010 a converti la PK en uuid mais
--    mig 031 n'a pas été synchronisée. Réécriture du trigger avec ::text.
create or replace function public.trg_transport_reservation_paid() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.statut = 'paid' and (old.statut is null or old.statut <> 'paid') then
    perform public.fn_award_points(
      new.buyer_id, 'booking_paid', 'transport_reservations', new.id::text, null
    );
  end if;
  return new;
end $$;

-- (Le trigger lui-même est déjà attaché par mig 031 et pointe sur la fonction
-- ci-dessus — pas besoin de DROP/CREATE TRIGGER.)
