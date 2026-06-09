-- ═══════════════════════════════════════════════════════════════════════════
-- 062_fix_availability_stage_box_symmetric.sql
-- Fix surbooking F1 Stage + Box : même patron symétrique que 060 (transport).
--
-- BUG (identique à celui révélé par l'E2E transport 2026-06-08) :
--   Stage et Box n'armaient leur logique de dispo QUE sur l'arête exacte
--   pending→accepted. Or les parcours réels atteignent un état consommant par
--   d'autres arêtes :
--     • Stage : reste 'accepted' au clic « Payer » (le front tente
--       'awaiting_payment' mais le CHECK stage le rejette, cf. useStagePayment),
--       puis webhook → 'paid'. Un chemin pending→paid (ou toute entrée hors
--       pending→accepted) ne décrémentait JAMAIS stages.places_disponibles
--       (surbooking) ; et la libération se déclenchait sur accepted/paid/
--       completed→terminal SANS vérifier qu'une place avait été consommée
--       (place fantôme : compteur > capacité).
--     • Box : passe pending→accepted (vendeur) puis 'awaiting_payment' (front)
--       puis 'paid' (webhook). Le contrôle de chevauchement ne s'exécutait que
--       sur pending→accepted ; toute entrée dans l'ensemble consommant par une
--       autre arête (ex. pending→awaiting_payment direct) ne contrôlait JAMAIS
--       la capacité (surbooking).
--
-- CORRECTIF : déclenchement symétrique sur l'ensemble consommant S.
--   S = {accepted, awaiting_payment, paid, completed}
--   Consomme/contrôle : old ∉ S  ET  new ∈ S   (couvre pending→paid, pending→
--                       awaiting_payment, pending→accepted, …)
--   Libère            : old ∈ S   ET  new ∈ {rejected,cancelled,expired,payment_expired}
--   → transitions internes à S (accepted→awaiting_payment→paid) : aucune branche
--     → pas de double-consommation, pas de re-contrôle inutile.
--
-- Stage  = compteur stages.places_disponibles (UPDATE conditionnel atomique).
-- Box    = PAS de compteur : logique de chevauchement de dates. Le « consume »
--          = exécuter le contrôle capacité/chevauchement sur la PREMIÈRE entrée
--          dans S ; la libération est IMPLICITE (la résa quitte S, le COUNT ne
--          la voit plus). Donc : aucun compteur négatif, aucune place fantôme.
--
-- Périmètre STRICT : Stage + Box uniquement. NE touche PAS :
--   - fn_availability_transport (corrigée en 060) ni fn_availability_coach ;
--   - les triggers (créés en 053 : trg_zz_availability_stage / _box) — ils
--     restent liés et appellent simplement le nouveau corps ; on ne remplace
--     que le CORPS des fonctions ;
--   - Stripe / escrow / front / RLS / guards 047.
--
-- Note Stage : 'awaiting_payment' est INERTE côté stage (absent du CHECK
--   stage_reservations) mais conservé dans S pour identité stricte de patron
--   avec 060/transport. Sans effet fonctionnel.
--
-- Rollback : restaurer le corps d'origine (053) — consume pending→accepted,
--   release accepted/paid/completed→terminal (Stage) ; contrôle pending→accepted
--   (Box). Voir bloc « ROLLBACK » en fin de fichier.
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══ STAGE (compteur stages.places_disponibles ; qté = nb_participants) ═══════
create or replace function public.fn_availability_stage() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_qty int;
  c_consuming constant text[] := array['accepted','awaiting_payment','paid','completed'];
  c_release   constant text[] := array['rejected','cancelled','expired','payment_expired'];
begin
  if new.status = 'accepted' and old.status is distinct from 'accepted' then
    new.accepted_at := now();
  end if;

  v_qty := coalesce(new.nb_participants, 0);

  -- CONSOMMATION : première entrée dans l'ensemble consommant S.
  if (old.status is null or not (old.status = any(c_consuming)))
     and (new.status = any(c_consuming)) then
    update public.stages
       set places_disponibles = places_disponibles - v_qty
     where id = new.stage_id and places_disponibles >= v_qty;
    if not found then
      raise exception 'stage_capacite_insuffisante (stage=%, qty=%)', new.stage_id, v_qty
        using errcode = 'check_violation';
    end if;

  -- LIBÉRATION : sortie de S vers un état terminal. Restitue 1:1 la quantité
  -- consommée. Si la résa n'avait jamais consommé (old ∉ S, ex. pending→
  -- cancelled), aucune branche ne s'exécute → pas de place fantôme.
  elsif (old.status = any(c_consuming)) and (new.status = any(c_release)) then
    update public.stages
       set places_disponibles = places_disponibles + v_qty
     where id = new.stage_id;
  end if;

  return new;
end $$;

-- ═══ BOX (chevauchement de dates ; pas de compteur → contrôle live) ═══════════
create or replace function public.fn_availability_box() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_cap int;
  v_count int;
  c_consuming constant text[] := array['accepted','awaiting_payment','paid','completed'];
begin
  if new.status = 'accepted' and old.status is distinct from 'accepted' then
    new.accepted_at := now();
  end if;

  -- Contrôle capacité/chevauchement sur la PREMIÈRE entrée dans S
  -- (couvre pending→accepted, pending→awaiting_payment, pending→paid).
  -- Transitions internes à S (old ∈ S) : pas de re-contrôle (idempotent, évite
  -- un faux raise si la capacité est serrée). Libération : implicite.
  if (old.status is null or not (old.status = any(c_consuming)))
     and (new.status = any(c_consuming)) then
    -- Verrou de l'annonce → sérialise les acceptations concurrentes sur cette box.
    select nb_boxes into v_cap from public.box_annonces where id = new.box_id for update;
    select count(*) into v_count
      from public.box_reservations r
     where r.box_id = new.box_id and r.id <> new.id
       and r.status = any(c_consuming)
       and daterange(r.date_debut, r.date_fin, '[]') && daterange(new.date_debut, new.date_fin, '[]');
    if v_count + 1 > coalesce(v_cap, 0) then
      raise exception 'box_conflit_periode (box=%, concurrentes=%, capacite=%)', new.box_id, v_count + 1, v_cap
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end $$;

-- Les triggers trg_zz_availability_stage / trg_zz_availability_box restent ceux
-- créés en 053 (before update of status). Aucune recréation nécessaire.

-- ═════════════════════════════════════════════════════════════════════════════
-- AUDIT DRIFT STAGE (lecture seule — À EXÉCUTER MANUELLEMENT AVANT TOUT BACKFILL)
-- Détecte les stages dont places_disponibles ne correspond pas à
--   places (capacité) - Σ nb_participants des résas dans S.
-- N'applique RIEN. Si des écarts existent → décider d'un 062b correctif ciblé.
--
--   select s.id, s.titre, s.places as capacite, s.places_disponibles as actuel,
--          coalesce(sum(r.nb_participants) filter (
--            where r.status in ('accepted','awaiting_payment','paid','completed')), 0) as consomme,
--          s.places - coalesce(sum(r.nb_participants) filter (
--            where r.status in ('accepted','awaiting_payment','paid','completed')), 0) as attendu
--     from public.stages s
--     left join public.stage_reservations r on r.stage_id = s.id
--    group by s.id
--   having s.places_disponibles <> s.places - coalesce(sum(r.nb_participants) filter (
--            where r.status in ('accepted','awaiting_payment','paid','completed')), 0);
--
-- Box : pas de backfill (capacité recalculée à chaque entrée dans S).
-- ═════════════════════════════════════════════════════════════════════════════

-- ═════════════════════════════════════════════════════════════════════════════
-- ROLLBACK (corps d'origine 053) :
--   create or replace function public.fn_availability_stage() ... (consume
--     pending→accepted ; release accepted/paid/completed→terminal) ;
--   create or replace function public.fn_availability_box() ... (contrôle
--     overlap uniquement sur pending→accepted).
--   Cf. supabase/migrations/053_availability_triggers.sql.
-- ═════════════════════════════════════════════════════════════════════════════
