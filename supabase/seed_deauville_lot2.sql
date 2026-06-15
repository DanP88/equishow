-- ============================================================================
-- SEED DE TEST — Concours « CSO de Deauville » + 2 box / 2 transport / 2 coach
-- ============================================================================
-- Données de DÉMO/TEST. Lie chaque annonce au concours via concours_id (074)
-- → compteurs fiche = 2 / 2 / 2. Idempotent (ids fixes + on conflict).
-- Prérequis : 074 (+ 075 pour followers_count) appliquées.
-- Vendeurs = vrais users existants (auteur affichable dans l'app) :
--   box+transport → Sarah Lefebvre 7d9d73e7-0214-42d9-9152-0e70fd9c407a
--   coach         → Émilie Laurent 49bd56d2-d87b-4f96-bd59-be2afaed8ccd
-- NB : transport_annonces.id = uuid (P12) → ids transport en uuid.
-- ============================================================================

-- Concours Deauville (id fixe)
insert into public.concours (id, numero_ffe, nom, date_debut, date_fin, lieu, departement, type_concours, etat)
values ('dea00000-0000-0000-0000-0000000000de', '202614088', 'CSO de Deauville',
        '2026-07-19', '2026-07-21', 'Pôle International du Cheval, Deauville', '14', 'CSO', 'ouvert')
on conflict (id) do nothing;

-- ── 2 BOX (Sarah Lefebvre) ──────────────────────────────────────────────────
insert into public.box_annonces (id, auteur_id, auteur_nom, titre, lieu, date_debut, date_fin,
                                  nb_boxes, nb_boxes_disponibles, prix_nuit_ht, concours, concours_id)
values
 ('b0000000-0000-0000-0000-00000000dea1','7d9d73e7-0214-42d9-9152-0e70fd9c407a','Écurie de la Touques',
  'Box paddock — proche Deauville','Deauville (14)','2026-07-18','2026-07-22',4,4,60,'CSO de Deauville',
  'dea00000-0000-0000-0000-0000000000de'),
 ('b0000000-0000-0000-0000-00000000dea2','7d9d73e7-0214-42d9-9152-0e70fd9c407a','Haras du Bord de Mer',
  'Box confort + foin','Deauville (14)','2026-07-18','2026-07-22',2,2,75,'CSO de Deauville',
  'dea00000-0000-0000-0000-0000000000de')
on conflict (id) do nothing;

-- ── 2 TRANSPORT (Sarah Lefebvre) ────────────────────────────────────────────
-- price_per_km + coords owner/destination OBLIGATOIRES : réserver un trajet appelle
-- l'Edge calculate-route-price (ORS). Sans price_per_km → prix NaN → réservation bloquée.
insert into public.transport_annonces (id, auteur_id, auteur_nom, type_transport, ville_depart, ville_arrivee,
                                        date_trajet, nb_places_total, nb_places_disponibles, prix_ht,
                                        price_per_km, start_lat, start_lng, destination_lat, destination_lng,
                                        concours, concours_id)
values
 ('70000000-0000-0000-0000-00000000dea1','7d9d73e7-0214-42d9-9152-0e70fd9c407a','Sarah Lefebvre','trajet','Paris','Deauville',
  '2026-07-19',3,2,90, 1.50, 48.8566, 2.3522, 49.3600, 0.0758, 'CSO de Deauville','dea00000-0000-0000-0000-0000000000de'),
 ('70000000-0000-0000-0000-00000000dea2','7d9d73e7-0214-42d9-9152-0e70fd9c407a','Sarah Lefebvre','trajet','Caen','Deauville',
  '2026-07-19',2,1,45, 1.50, 49.1829, -0.3707, 49.3600, 0.0758, 'CSO de Deauville','dea00000-0000-0000-0000-0000000000de')
on conflict (id) do nothing;

-- ── 2 COACH (Émilie Laurent) ────────────────────────────────────────────────
insert into public.coach_annonces (id, auteur_id, auteur_nom, titre, type, discipline, niveau,
                                    places, places_disponibles, date_debut, date_fin,
                                    prix_heure_ht, prix_heure_ttc, concours_nom, region, concours_id)
values
 ('c0000000-0000-0000-0000-00000000dea1','49bd56d2-d87b-4f96-bd59-be2afaed8ccd','Émilie Laurent',
  'Coaching CSO sur le terrain','concours','CSO','Amateur/Pro',6,6,'2026-07-19','2026-07-21',
  65,65,'CSO de Deauville','Normandie','dea00000-0000-0000-0000-0000000000de'),
 ('c0000000-0000-0000-0000-00000000dea2','49bd56d2-d87b-4f96-bd59-be2afaed8ccd','Émilie Laurent',
  'Détente + reconnaissance parcours','concours','CSO','Amateur',4,4,'2026-07-19','2026-07-21',
  55,55,'CSO de Deauville','Normandie','dea00000-0000-0000-0000-0000000000de')
on conflict (id) do nothing;
