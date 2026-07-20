-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 096 — Limite d'essai coach : protection serveur transactionnelle
--
-- Problème corrigé :
--   La limite de 3 séances gratuites pour les coachs sans plan Pro n'était
--   imposée que côté front-end (guardAccept dans coach-demandes.tsx). Un appel
--   direct PATCH /rest/v1/course_demands?id=eq.<uuid> {"status":"accepted"}
--   contournait complètement le contrôle (audit 2026-07-20, verdict C).
--
-- Solution :
--   1. fn_coach_trial_consumed(p_coach, p_exclude_id) — compteur étendu :
--         séances libérées (fn_coach_paid_sessions)
--       + demandes déjà accepted/paid en cours (in-flight, hors ligne courante)
--      Permet de sérialiser les acceptances concurrentes sans race condition.
--
--   2. fn_guard_coach_trial_accept() — fonction trigger :
--      · BEFORE UPDATE sur course_demands
--      · ne s'active que sur la transition → 'accepted'
--      · advisory lock par coach (sérialise les acceptances concurrentes)
--      · vérifie Pro OU consumed < 3 ; sinon RAISE EXCEPTION
--
--   3. trg_guard_coach_trial_accept — trigger BEFORE UPDATE
--      Alphabétiquement après trg_course_demands_recalc (montants calculés en
--      premier) et avant trg_guard_status_transition / trg_zz_*.
--
-- Sémantique de l'essai (documentée, cf. §Compteur) :
--   Un coach non Pro consomme une place d'essai DÈS l'acceptation d'une demande
--   (statut → accepted). La place est libérée si la demande passe à un statut
--   terminal sans paiement (cancelled / rejected / expired / payment_expired).
--   Elle est définitivement consommée quand l'escrow est libéré (released).
--   Cela empêche d'accepter N demandes simultanément au-delà du quota de 3.
--
-- Périmètre : cours (course_demands) uniquement.
--   Les stages (stage_reservations) NE font PAS partie du compteur.
--   Preuve : fn_coach_paid_sessions filtre type='course' exclusivement.
--   La règle commerciale « 3 premières séances payées » désigne des séances
--   de coaching (cours), pas des stages. Ce choix est conservé explicitement.
--
-- Règle Pro : lower(coalesce(plan_id,'')) LIKE 'coach-%'
--   (fn_is_paid_plan non utilisée — elle considère certains plans cavalier
--    legacy comme payants, cf. analyse sécurité 2026-07-17.)
--
-- Rollback : 096_coach_trial_limit_server_rollback.sql
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Compteur étendu ──────────────────────────────────────────────────────
-- Renvoie le nombre de places d'essai consommées ou réservées par le coach :
--   • fn_coach_paid_sessions(p_coach)          → séances libérées (released)
--   • course_demands WHERE status IN (accepted,paid) AND id ≠ p_exclude → in-flight
--
-- p_exclude_demand_id : exclure la ligne courante du compteur in-flight
-- (évite de compter la demande qu'on est en train d'accepter).
create or replace function public.fn_coach_trial_consumed(
  p_coach            uuid,
  p_exclude_demand_id uuid default null
)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select
    public.fn_coach_paid_sessions(p_coach)
    + (
        select count(*)::int
        from   public.course_demands cd
        where  cd.coach_id = p_coach
          and  cd.status in ('accepted', 'paid')
          and  (p_exclude_demand_id is null or cd.id <> p_exclude_demand_id)
      );
$$;

grant execute on function public.fn_coach_trial_consumed(uuid, uuid) to authenticated;

comment on function public.fn_coach_trial_consumed(uuid, uuid) is
  '096: slots d''essai coach consommés = released + in-flight (accepted/paid). '
  'p_exclude_demand_id exclut la demande en cours de traitement.';

-- ── 2. Fonction trigger ─────────────────────────────────────────────────────
create or replace function public.fn_guard_coach_trial_accept()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan_id  text;
  v_has_pro  boolean;
  v_paid     integer;
  v_inflight integer;
begin
  -- Actif uniquement sur la transition → 'accepted'.
  -- Si le statut était déjà 'accepted' (re-update sans changement de statut),
  -- ou si la destination n'est pas 'accepted', on laisse passer sans contrôle.
  if new.status is distinct from 'accepted'
     or old.status = 'accepted'
  then
    return new;
  end if;

  -- Lecture du plan coach (SECURITY DEFINER : hors RLS self-only de users).
  select plan_id into v_plan_id
  from   public.users
  where  id = new.coach_id;

  -- Règle Pro : plan_id LIKE 'coach-%' (coach-mensuel / coach-annuel).
  -- Délibérément PAS fn_is_paid_plan (bug legacy : cavalier-plus = payant).
  v_has_pro := lower(coalesce(v_plan_id, '')) like 'coach-%';

  if v_has_pro then
    return new;  -- Pro : aucune limite
  end if;

  -- Verrou transactionnel par coach : sérialise TOUTES les acceptances
  -- concurrentes d'un même coach dans la même transaction DB.
  -- Empêche la race condition (deux requêtes voient consumed=2, toutes
  -- les deux passent et le coach se retrouve avec 4 séances gratuites).
  -- hashtext → int4 autocasté en bigint pour pg_advisory_xact_lock(bigint).
  perform pg_advisory_xact_lock(
    hashtext('coach_trial_limit:' || new.coach_id::text)
  );

  -- Compteur après verrou (lecture cohérente).
  select public.fn_coach_paid_sessions(new.coach_id) into v_paid;

  select count(*)::int into v_inflight
  from   public.course_demands cd
  where  cd.coach_id = new.coach_id
    and  cd.status in ('accepted', 'paid')
    and  cd.id <> new.id;  -- exclut la ligne courante

  if v_paid + v_inflight >= 3 then
    raise exception 'COACH_TRIAL_LIMIT_REACHED'
      using errcode = 'P0001',
            detail  = format(
              'coach=%s paid_released=%s in_flight=%s total=%s limit=3',
              new.coach_id, v_paid, v_inflight, v_paid + v_inflight
            );
  end if;

  return new;
end;
$$;

comment on function public.fn_guard_coach_trial_accept() is
  '096: trigger BEFORE UPDATE course_demands — bloque la transition → accepted '
  'si le coach non-Pro a atteint 3 slots consommés (released + in-flight). '
  'Advisory lock par coach pour résister aux acceptations concurrentes.';

-- ── 3. Trigger ──────────────────────────────────────────────────────────────
-- Nom choisi pour s'intercaler entre :
--   trg_course_demands_recalc   (BEFORE, calcule montants — doit précéder)
--   trg_guard_coach_trial_accept (BEFORE, notre garde — ce trigger)
--   trg_guard_status_transition (BEFORE, garde transitions paid/completed/…)
--   trg_zz_*                    (BEFORE, disponibilité + capacité créneau)
drop trigger if exists trg_guard_coach_trial_accept on public.course_demands;

create trigger trg_guard_coach_trial_accept
  before update on public.course_demands
  for each row
  execute function public.fn_guard_coach_trial_accept();
