-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 051 — Montants financiers autoritatifs (sécurité financière)
--
-- Contexte (audit 2026-06-02 + plan validé 2026-06-03) :
--   Failles P0 exploitables en prod (mig 047 ne couvrait que les transitions de
--   STATUT, pas les MONTANTS) :
--     - B1 : INSERT transport à prix arbitraire (aucun trigger de recalcul).
--     - S5 : UPDATE post-INSERT des montants (triggers en BEFORE INSERT seul) —
--            universel sur les 4 tables financières.
--     - S2 : seller_id / coach_id client-trusted.
--   Chemin d'exploitation : tamponner le montant en DB avant paiement →
--   create-checkout-session lit le montant DB → Stripe facture le montant fraudé.
--
-- Périmètre validé (CR1 + CR2 trajet + CR3 + CR5). HORS périmètre : CR4 (yo-yo
--   annonces, P2) et CR6/R4 (cautions location de van). Le sous-flux location
--   n'est PAS recalculé (cautions / km inclus / km supplémentaires intacts) ; ses
--   montants sont seulement GELÉS sur UPDATE pour fermer S5 sans changer la logique.
--
-- Défense en profondeur :
--   Couche 1 (forte) = triggers BEFORE INSERT OR UPDATE OF <cols montant/qté/snapshot>
--     → recalculent les montants depuis la source autoritative et figent les
--       entrées sensibles (le trigger voit OLD). Pin seller_id/coach_id = auteur
--       de l'annonce (CR5).
--   Couche 2 (secondaire) = RLS WITH CHECK sur les 4 policies UPDATE → invariants
--     sur NEW (montants cohérents + party = auteur annonce). Évaluée APRÈS les
--     triggers BEFORE → un écrit légitime (corrigé par le trigger) passe ; un écrit
--     falsifié sans trigger est rejeté.
--
-- Source autoritative TRANSPORT TRAJET (validé) = snapshot figé déjà stocké dans
--   la réservation (price_per_km_snapshot × total_distance_km / calculated_transport_price)
--   si route-priced, sinon annonce.prix_ht × nb_places. AUCUN appel externe.
--
-- Anti-régression :
--   - Triggers scopés sur colonnes montant/quantité/snapshot UNIQUEMENT → le
--     webhook service_role (status→paid) NE déclenche PAS ces triggers.
--   - Aucune modif Edge Functions / Stripe Connect / escrow.
--   - Aucune donnée existante réécrite (triggers = écritures futures seulement ;
--     audit préalable = 0 anomalie sur les 19 réservations actuelles).
-- Non destructif : create or replace, drop trigger/policy + recreate.
-- ─────────────────────────────────────────────────────────────────────────────


-- ═══════════════════════════════════════════════════════════════════════════
-- CR1 — course / stage / box : recalcul INSERT *et* UPDATE + pin party (CR5)
-- ═══════════════════════════════════════════════════════════════════════════

-- ── course_demands ──────────────────────────────────────────────────────────
create or replace function public.recalc_course_demand_amounts()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_unit numeric; v_auteur uuid; v_ht numeric; v_comm numeric;
begin
  select prix_heure_ttc, auteur_id into v_unit, v_auteur
    from public.coach_annonces where id = new.annonce_id;
  if v_unit is null or v_unit <= 0 then
    raise exception 'invalid prix_heure_ttc for annonce % (must be > 0)', new.annonce_id;
  end if;
  if new.nb_jours is null or new.nb_jours <= 0 then
    raise exception 'invalid nb_jours % (must be > 0)', new.nb_jours;
  end if;
  v_ht   := round(v_unit * new.nb_jours, 2);
  v_comm := round(v_ht * public.get_commission_rate('cours'), 2);
  new.price_per_day_ttc   := v_unit;
  new.total_amount_ht     := v_ht;
  new.platform_commission := v_comm;
  new.total_amount_ttc    := round(v_ht + v_comm, 2);
  new.coach_id            := v_auteur;          -- CR5 : pin coach = auteur annonce
  return new;
end $$;

drop trigger if exists trg_course_demands_recalc on public.course_demands;
create trigger trg_course_demands_recalc
  before insert or update of
    annonce_id, nb_jours, price_per_day_ttc,
    total_amount_ht, total_amount_ttc, platform_commission, coach_id
  on public.course_demands
  for each row execute function public.recalc_course_demand_amounts();


-- ── stage_reservations ──────────────────────────────────────────────────────
create or replace function public.recalc_stage_reservation_amounts()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_unit numeric; v_auteur uuid; v_ht numeric; v_comm numeric;
begin
  select prix_ttc, auteur_id into v_unit, v_auteur
    from public.stages where id = new.stage_id;
  if v_unit is null or v_unit <= 0 then
    raise exception 'invalid prix_ttc for stage % (must be > 0)', new.stage_id;
  end if;
  if new.nb_participants is null or new.nb_participants <= 0 then
    raise exception 'invalid nb_participants % (must be > 0)', new.nb_participants;
  end if;
  v_ht   := round(v_unit * new.nb_participants, 2);
  v_comm := round(v_ht * public.get_commission_rate('cours'), 2);
  new.price_total_ht      := v_ht;
  new.platform_commission := v_comm;
  new.price_total_ttc     := round(v_ht + v_comm, 2);
  new.coach_id            := v_auteur;          -- CR5 : pin coach = auteur stage
  return new;
end $$;

drop trigger if exists trg_stage_reservations_recalc on public.stage_reservations;
create trigger trg_stage_reservations_recalc
  before insert or update of
    stage_id, nb_participants,
    price_total_ht, price_total_ttc, platform_commission, coach_id
  on public.stage_reservations
  for each row execute function public.recalc_stage_reservation_amounts();


-- ── box_reservations ────────────────────────────────────────────────────────
create or replace function public.recalc_box_reservation_amounts()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_unit numeric; v_auteur uuid; v_ht numeric; v_comm numeric;
begin
  select prix_nuit_ht, auteur_id into v_unit, v_auteur
    from public.box_annonces where id = new.box_id;
  if v_unit is null or v_unit <= 0 then
    raise exception 'invalid prix_nuit_ht for box_annonce % (must be > 0)', new.box_id;
  end if;
  if new.nb_nuits is null or new.nb_nuits <= 0 then
    raise exception 'invalid nb_nuits % (must be > 0)', new.nb_nuits;
  end if;
  v_ht   := round(v_unit * new.nb_nuits, 2);
  v_comm := round(v_ht * public.get_commission_rate('box'), 2);
  new.price_total_ht      := v_ht;
  new.platform_commission := v_comm;
  new.price_total_ttc     := round(v_ht + v_comm, 2);
  new.seller_id           := v_auteur;          -- CR5 : pin seller = auteur annonce
  return new;
end $$;

drop trigger if exists trg_box_reservations_recalc on public.box_reservations;
create trigger trg_box_reservations_recalc
  before insert or update of
    box_id, nb_nuits,
    price_total_ht, price_total_ttc, platform_commission, seller_id
  on public.box_reservations
  for each row execute function public.recalc_box_reservation_amounts();


-- ═══════════════════════════════════════════════════════════════════════════
-- CR2 — transport_reservations : nouveau trigger (trajet autoritatif + gel)
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.recalc_transport_amounts()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_type text; v_prix_ht numeric; v_auteur uuid; v_ht numeric; v_comm numeric;
begin
  select type_transport, prix_ht, auteur_id
    into v_type, v_prix_ht, v_auteur
    from public.transport_annonces where id = new.transport_id;

  -- CR5 : pin seller = auteur annonce (INSERT et UPDATE)
  new.seller_id := coalesce(v_auteur, new.seller_id);

  -- Gel des données figées à la création (le trigger voit OLD) : un UPDATE ne
  -- peut ni rejouer transport_id ni altérer le snapshot de route.
  if TG_OP = 'UPDATE' then
    new.transport_id               := old.transport_id;
    new.price_per_km_snapshot      := old.price_per_km_snapshot;
    new.total_distance_km          := old.total_distance_km;
    new.calculated_transport_price := old.calculated_transport_price;
    new.final_price                := old.final_price;
  end if;

  -- LOCATION : hors périmètre 051. Pas de recalcul (cautions / km inclus / km
  -- supplémentaires intacts). Sur UPDATE on FIGE seulement les montants (ferme S5
  -- sans changer la logique). INSERT location : inchangé (réservation possible).
  if v_type = 'location' then
    if TG_OP = 'UPDATE' then
      new.prix_total_ht         := old.prix_total_ht;
      new.commission_plateforme := old.commission_plateforme;
      new.prix_total_ttc        := old.prix_total_ttc;
    end if;
    return new;
  end if;

  -- TRAJET : source autoritative = snapshot figé si route-priced, sinon annonce×places
  if new.calculated_transport_price is not null and new.total_distance_km is not null then
    v_ht := round(coalesce(new.calculated_transport_price,
                           new.price_per_km_snapshot * new.total_distance_km), 2);
  else
    if v_prix_ht is null or v_prix_ht <= 0 then
      raise exception 'invalid prix_ht for transport_annonce % (must be > 0)', new.transport_id;
    end if;
    if new.nb_places is null or new.nb_places <= 0 then
      raise exception 'invalid nb_places % (must be > 0)', new.nb_places;
    end if;
    v_ht := round(v_prix_ht * new.nb_places, 2);
  end if;

  v_comm := round(v_ht * public.get_commission_rate('trajet'), 2);
  new.prix_total_ht         := v_ht;
  new.commission_plateforme := v_comm;
  new.prix_total_ttc        := round(v_ht + v_comm, 2);
  return new;
end $$;

drop trigger if exists trg_transport_reservations_recalc on public.transport_reservations;
create trigger trg_transport_reservations_recalc
  before insert or update of
    transport_id, nb_places, seller_id,
    prix_total_ht, prix_total_ttc, commission_plateforme,
    price_per_km_snapshot, total_distance_km, calculated_transport_price, final_price
  on public.transport_reservations
  for each row execute function public.recalc_transport_amounts();


-- ═══════════════════════════════════════════════════════════════════════════
-- CR3 — WITH CHECK sur les 4 policies UPDATE (barrière secondaire NEW-only)
--   On conserve le USING d'origine (parties) et on ajoute le WITH CHECK.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── course_demands ──
drop policy if exists course_demands_update_parties on public.course_demands;
create policy course_demands_update_parties on public.course_demands
  for update
  using (cavalier_id = auth.uid() or coach_id = auth.uid())
  with check (
    (cavalier_id = auth.uid() or coach_id = auth.uid())
    and total_amount_ht = round(
      (select prix_heure_ttc from public.coach_annonces where id = annonce_id) * nb_jours, 2)
    and platform_commission = round(total_amount_ht * public.get_commission_rate('cours'), 2)
    and total_amount_ttc   = round(total_amount_ht + platform_commission, 2)
    and coach_id = (select auteur_id from public.coach_annonces where id = annonce_id)
  );

-- ── stage_reservations ──
drop policy if exists stage_reservations_update_parties on public.stage_reservations;
create policy stage_reservations_update_parties on public.stage_reservations
  for update
  using (cavalier_id = auth.uid() or coach_id = auth.uid())
  with check (
    (cavalier_id = auth.uid() or coach_id = auth.uid())
    and price_total_ht = round(
      (select prix_ttc from public.stages where id = stage_id) * nb_participants, 2)
    and platform_commission = round(price_total_ht * public.get_commission_rate('cours'), 2)
    and price_total_ttc    = round(price_total_ht + platform_commission, 2)
    and coach_id = (select auteur_id from public.stages where id = stage_id)
  );

-- ── box_reservations ──
drop policy if exists box_reservations_update_parties on public.box_reservations;
create policy box_reservations_update_parties on public.box_reservations
  for update
  using (buyer_id = auth.uid() or seller_id = auth.uid())
  with check (
    (buyer_id = auth.uid() or seller_id = auth.uid())
    and price_total_ht = round(
      (select prix_nuit_ht from public.box_annonces where id = box_id) * nb_nuits, 2)
    and platform_commission = round(price_total_ht * public.get_commission_rate('box'), 2)
    and price_total_ttc    = round(price_total_ht + platform_commission, 2)
    and seller_id = (select auteur_id from public.box_annonces where id = box_id)
  );

-- ── transport_reservations ──
--   Route-priced non exprimable en NEW-only (le gel du snapshot est porté par le
--   trigger). WITH CHECK = parties + pin seller + montant > 0 + cohérence interne
--   (hors location, dont la commission/structure n'est pas du ressort de 051).
drop policy if exists transport_reservations_update_parties on public.transport_reservations;
create policy transport_reservations_update_parties on public.transport_reservations
  for update
  using (seller_id = auth.uid() or buyer_id = auth.uid())
  with check (
    (seller_id = auth.uid() or buyer_id = auth.uid())
    and seller_id = (select auteur_id from public.transport_annonces where id = transport_id)
    and prix_total_ht > 0
    and (
      (select type_transport from public.transport_annonces where id = transport_id) = 'location'
      or (
        commission_plateforme = round(prix_total_ht * public.get_commission_rate('trajet'), 2)
        and prix_total_ttc    = round(prix_total_ht + commission_plateforme, 2)
      )
    )
  );
