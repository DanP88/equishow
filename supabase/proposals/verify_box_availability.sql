-- ============================================================================
-- VÉRIFICATION / NETTOYAGE — disponibilité Box (accompagne la migration 104)
-- ============================================================================

-- ── 1. AVANT : voir l'écart actuel (dispo affichée vs réelle) ───────────────
select a.id, a.lieu, a.concours, a.nb_boxes,
       a.nb_boxes_disponibles                              as dispo_actuelle,
       (select count(*) from public.box_reservations r
         where r.box_id = a.id
           and r.status = any(array['accepted','awaiting_payment','paid','completed'])) as consommantes,
       greatest(a.nb_boxes - (select count(*) from public.box_reservations r
         where r.box_id = a.id
           and r.status = any(array['accepted','awaiting_payment','paid','completed'])), 0) as dispo_correcte
from public.box_annonces a
order by a.created_at;

-- ── 2. Le recalcul est fait par le §5 de la migration 104. ─────────────────
-- Si besoin de le rejouer seul (idempotent) :
--   update public.box_annonces a
--      set nb_boxes_disponibles = greatest(
--            a.nb_boxes - (select count(*) from public.box_reservations r
--              where r.box_id = a.id
--                and r.status = any(array['accepted','awaiting_payment','paid','completed'])), 0);

-- ── 3. APRÈS : contrôle final (doit renvoyer 0 ligne) ──────────────────────
select a.id, a.lieu, a.nb_boxes, a.nb_boxes_disponibles
from public.box_annonces a
where a.nb_boxes_disponibles <> greatest(a.nb_boxes - (select count(*) from public.box_reservations r
        where r.box_id = a.id
          and r.status = any(array['accepted','awaiting_payment','paid','completed'])), 0);

-- Attendu après 104 :
--   ce5a0000-…b3 (La Baule) : nb_boxes_disponibles = 0
--     → fiche concours : Box = 0 (useConcoursCounts : .gt('nb_boxes_disponibles',0))
--     → clic Box : applyBoxFilters branche concoursId + nbBoxesDisponibles>0 → liste vide
