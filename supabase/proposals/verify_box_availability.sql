-- ============================================================================
-- VÉRIFICATION — disponibilité Box (accompagne la migration 104 v2, DATE-AWARE)
-- ============================================================================

-- ── 1. AVANT : écart entre l'indicateur stocké et la valeur "pic" correcte ──
select a.id, a.lieu, a.concours, a.nb_boxes,
       a.nb_boxes_disponibles as dispo_stockee,
       greatest(a.nb_boxes - public.fn_box_peak_concurrency(
         a.id, greatest(current_date, a.date_debut::date), a.date_fin::date), 0) as dispo_pic_correcte,
       (a.date_fin::date < current_date) as annonce_passee
from public.box_annonces a
order by a.created_at;

-- ── 2. Disponibilité DATE-AWARE pour les dates du concours lié ──────────────
select a.id, a.concours, c.date_debut as concours_debut, c.date_fin as concours_fin,
       public.fn_box_available(a.id, c.date_debut, c.date_fin) as box_dispo_pour_concours
from public.box_annonces a
join public.concours c on c.id = a.concours_id
order by a.created_at;

-- ── 3. Le recalcul est fait par le §8 de la migration 104. Rejouable seul : ──
--   update public.box_annonces a set nb_boxes_disponibles = public.fn_box_dispo_value(a.id);

-- ── 4. APRÈS : contrôle (doit renvoyer 0 ligne) ────────────────────────────
select a.id, a.lieu, a.nb_boxes, a.nb_boxes_disponibles
from public.box_annonces a
where a.nb_boxes_disponibles <> public.fn_box_dispo_value(a.id);

-- ── 5. La Baule ───────────────────────────────────────────────────────────
select public.fn_concours_box_available_count('ce500000-0000-0000-0000-0000000000a3') as labaule_count;
-- Attendu : (annonces=0, boxes=0)
--   → fiche concours : badge Box masqué
--   → clic Box : fn_concours_available_box_annonce_ids('…a3') renvoie [] → liste vide
--   → une future réservation de cette box SUR D'AUTRES DATES resterait possible
--     (fn_availability_box, contrôle chevauchement, inchangé).
