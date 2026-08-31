-- ============================================================================
-- 107 — transport_annonces : adresses précises du trajet RETOUR (aller-retour)
-- ============================================================================
-- CONTEXTE
--   Le formulaire « Proposer un retour » (proposer-transport.tsx) collectait
--   `ville_depart_retour` / `ville_arrivee_retour` / `nb_places_retour` via des
--   menus déroulants de villes, MAIS ne persistait RIEN : seuls `aller_retour`
--   (bool) et `date_retour` (timestamptz) étaient enregistrés. Les adresses du
--   retour étaient jetées au save et non ré-hydratées à l'édition.
--
-- CE QUE FAIT LA MIGRATION
--   Ajoute 7 colonnes pour stocker, SUR LA MÊME LIGNE d'annonce, les adresses
--   précises + coordonnées du trajet retour, et le nombre de places retour :
--     return_start_address / return_start_lat / return_start_lng
--     return_destination_address / return_destination_lat / return_destination_lng
--     return_nb_places
--   Le front écrit toujours une valeur concrète (si l'utilisateur coche
--   « même adresse que … », la valeur de l'aller est recopiée à l'enregistrement).
--
--   ⚠️ Ce n'est PAS le lot « aller-retour » (2 legs liés + escrow par leg) :
--   le retour n'est pas encore un trajet réservable indépendamment. Cette
--   migration ne fait que rendre le formulaire cohérent (stockage + édition).
--
-- 100 % ADDITIF : 7 colonnes nullable, aucun défaut contraignant, aucune donnée
--   existante modifiée. Aucun impact RLS (policies = `auteur_id = auth.uid()`),
--   NI payments, NI escrow, NI reservations, NI realtime, NI triggers.
--   Réversible (drop column).
-- Application : db query -f supabase/migrations/107_transport_return_addresses.sql --linked
--               puis migration repair --status applied 107. JAMAIS db push.
-- ============================================================================

begin;

alter table public.transport_annonces
  add column if not exists return_start_address        text,
  add column if not exists return_start_lat            double precision,
  add column if not exists return_start_lng            double precision,
  add column if not exists return_destination_address  text,
  add column if not exists return_destination_lat      double precision,
  add column if not exists return_destination_lng      double precision,
  add column if not exists return_nb_places            integer;

comment on column public.transport_annonces.return_start_address is
  '107 — adresse précise de départ du trajet retour (aller-retour). Valeur concrète ; recopie de destination_address/adresse_arrivee si l''utilisateur a coché « même adresse que l''arrivée de l''aller ».';
comment on column public.transport_annonces.return_destination_address is
  '107 — adresse précise d''arrivée du trajet retour. Valeur concrète ; recopie de adresse_van si « même adresse que le départ de l''aller ».';
comment on column public.transport_annonces.return_nb_places is
  '107 — nombre de places (chevaux) du trajet retour.';

-- Défense en profondeur : grants explicites par colonne, alignés sur la liste
-- de colonnes déjà énumérée pour cette table (le grant table-level couvre déjà
-- les nouvelles colonnes ; on reste cohérent avec l'existant).
grant select (return_start_address, return_start_lat, return_start_lng,
              return_destination_address, return_destination_lat, return_destination_lng,
              return_nb_places)
  on public.transport_annonces to anon, authenticated;
grant insert (return_start_address, return_start_lat, return_start_lng,
              return_destination_address, return_destination_lat, return_destination_lng,
              return_nb_places)
  on public.transport_annonces to authenticated;
grant update (return_start_address, return_start_lat, return_start_lng,
              return_destination_address, return_destination_lat, return_destination_lng,
              return_nb_places)
  on public.transport_annonces to authenticated;

commit;
