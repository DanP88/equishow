-- ============================================================================
-- ROLLBACK 107 — retire les colonnes d'adresses du trajet retour.
-- NB : perd les valeurs stockées dans ces colonnes (adresses/places retour).
--      Le reste de l'annonce (aller, aller_retour, date_retour) est intact.
-- ============================================================================

begin;

alter table public.transport_annonces
  drop column if exists return_start_address,
  drop column if exists return_start_lat,
  drop column if exists return_start_lng,
  drop column if exists return_destination_address,
  drop column if exists return_destination_lat,
  drop column if exists return_destination_lng,
  drop column if exists return_nb_places;

commit;
