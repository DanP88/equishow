-- ============================================================================
-- SEED DE TEST — Scénario réservations reproductible (DB-4)
-- ============================================================================
-- Objectif : un jeu de données cohérent pour tester bout-en-bout, en passant
--   TOUJOURS par les vraies transitions de statut (jamais d'INSERT direct dans
--   un état qui contournerait les triggers métier : fn_availability_*,
--   trg_guard_status_transition, fn_sync_demand_notification, …).
--
-- Prérequis :
--   - migrations 104 (dispo box) + 105 (sync notif) APPLIQUÉES
--   - comptes : sarah.l@equishow.app (coach), cavalier2@equishow.app (cavalier),
--     cavalier3@equishow.app (cavalier — à ajouter dans scripts/seed-test-accounts.mjs)
--   - exécution en rôle privilégié (supabase db query -f --linked) → les
--     transitions protégées (→ paid / completed / …) sont autorisées.
--
-- Idempotent : ids fixes + on conflict do nothing ; les UPDATE de statut sont
--   ré-exécutables (guards idempotents).
--
-- ⚠️ NE PAS exécuter sur la prod sans feu vert.
-- ============================================================================

do $$
declare
  coach_id   uuid := (select id from public.users where email = 'sarah.l@equishow.app');   -- COACH
  cav2_id    uuid := (select id from public.users where email = 'cavalier2@equishow.app');  -- réserve
  cav3_id    uuid := (select id from public.users where email = 'cavalier3@equishow.app');  -- vend box/transport
  v_concours uuid := 'aaaa0000-0000-0000-0000-0000000000c1';
  v_coach_a  uuid := 'aaaa0000-0000-0000-0000-00000000ca01';
  v_box_a    uuid := 'aaaa0000-0000-0000-0000-0000000000b1';
  v_stage_a  uuid := 'aaaa0000-0000-0000-0000-000000000551';
  v_demand   uuid := 'aaaa0000-0000-0000-0000-0000000000d1';
  v_boxresa  uuid := 'aaaa0000-0000-0000-0000-0000000000e1';
  v_stageres uuid := 'aaaa0000-0000-0000-0000-0000000000f1';
begin
  if coach_id is null or cav2_id is null then
    raise notice 'Comptes manquants — lancer d''abord scripts/seed-test-accounts.mjs'; return;
  end if;

  -- ── Concours support ──────────────────────────────────────────────────────
  insert into public.concours (id, numero_ffe, nom, date_debut, date_fin, lieu, departement, type_concours, etat, statut)
  values (v_concours, 'TEST-RESA-01', 'Concours de test — Réservations',
          current_date + 30, current_date + 32, 'Terrain de test', '75', 'CSO', 'ouvert', 'publie')
  on conflict (id) do nothing;

  -- ── Annonce coaching (auteur = COACH Sarah) ───────────────────────────────
  insert into public.coach_annonces (id, auteur_id, auteur_nom, titre, type, discipline, niveau,
                                     places, places_disponibles, date_debut, date_fin,
                                     prix_heure_ht, prix_heure_ttc, concours_nom, region, concours_id)
  values (v_coach_a, coach_id, 'Sarah Lefebvre', 'Coaching test CSO', 'concours', 'CSO', 'Amateur',
          3, 3, current_date + 30, current_date + 32, 60, 60, 'Concours de test — Réservations', 'IDF', v_concours)
  on conflict (id) do nothing;

  -- ── Annonce box (auteur = cavalier3) — capacité 3 ─────────────────────────
  if cav3_id is not null then
    insert into public.box_annonces (id, auteur_id, auteur_nom, titre, lieu, date_debut, date_fin,
                                     nb_boxes, nb_boxes_disponibles, prix_nuit_ht, concours, concours_id)
    values (v_box_a, cav3_id, 'Cavalier Trois', 'Box test — 3 disponibles', 'Terrain de test',
            current_date + 30, current_date + 32, 3, 3, 50, 'Concours de test — Réservations', v_concours)
    on conflict (id) do nothing;
  end if;

  -- ── Stage (auteur = COACH Sarah) — 4 places ──────────────────────────────
  insert into public.stages (id, auteur_id, auteur_nom, titre, description, disciplines, niveaux,
                             date_debut, date_fin, nb_jours, prix_ttc, places, places_disponibles, concours, region, concours_id)
  values (v_stage_a, coach_id, 'Sarah Lefebvre', 'Stage test 2 jours', 'Perfectionnement',
          array['CSO'], array['Amateur'], current_date + 30, current_date + 31, 2, 180, 4, 4,
          'Concours de test — Réservations', 'IDF', v_concours)
  on conflict (id) do nothing;

  -- ════════════════════════════════════════════════════════════════════════
  -- SCÉNARIO 1 — demande coaching cavalier2 → Sarah (reste PENDING)
  -- ════════════════════════════════════════════════════════════════════════
  insert into public.course_demands (id, annonce_id, coach_id, cavalier_id, title, discipline, level,
                                     horse_name, message, date_debut, date_fin, nb_jours,
                                     price_per_day_ttc, total_amount_ht, platform_commission, total_amount_ttc,
                                     status, concours_id)
  values (v_demand, v_coach_a, coach_id, cav2_id, 'Coaching test CSO', 'CSO', 'Amateur',
          'Test Horse', 'Demande de test', current_date + 30, current_date + 30, 1,
          60, 57.14, 2.86, 60, 'pending', v_concours)
  on conflict (id) do nothing;

  -- notification pending vers le coach (comme reserver-coach.tsx)
  insert into public.notifications (destinataire_id, auteur_id, type, titre, message, status, action_url, donnees)
  select coach_id, cav2_id, 'course_request', '🎓 Nouvelle demande de cours',
         'Sophie Dupont demande une séance pour "Coaching test CSO"', 'pending', '/(tabs)/coach-demandes',
         jsonb_build_object('demandId', v_demand::text, 'annonceId', v_coach_a::text,
                            'annonceTitre', 'Coaching test CSO', 'prixSeller', 57.14)
  where not exists (select 1 from public.notifications
                    where type='course_request' and (donnees->>'demandId') = v_demand::text);

  -- → À CE STADE : accueil coach Sarah = 1 · onglet Demandes = 1 · badge = 1
  --   notif course_request pending.
  -- Pour tester l'acceptation, décommenter :
  --   update public.course_demands set status = 'accepted' where id = v_demand;
  --   → mig 105 : la notif passe à status='accepted', lu=true
  --   → accueil / demandes / badge reviennent à 0

  -- ════════════════════════════════════════════════════════════════════════
  -- SCÉNARIO 2 — BOX capacité 3 : réservations via transitions réelles
  -- ════════════════════════════════════════════════════════════════════════
  if cav3_id is not null then
    -- 2a. cavalier2 réserve (INSERT pending) — dispo box inchangée (3)
    insert into public.box_reservations (id, box_id, seller_id, buyer_id, title, lieu, nb_nuits,
                                         date_debut, date_fin, price_total_ht, platform_commission, price_total_ttc, status)
    values (v_boxresa, v_box_a, cav3_id, cav2_id, 'Box test — 3 disponibles', 'Terrain de test', 2,
            current_date + 30, current_date + 32, 100, 5, 105, 'pending')
    on conflict (id) do nothing;

    -- 2b. cavalier3 (vendeur) accepte → trigger 104 : dispo 3 → 2
    update public.box_reservations set status = 'accepted' where id = v_boxresa and status = 'pending';

    -- Vérif attendue : select nb_boxes_disponibles from box_annonces where id = v_box_a;  -- → 2
    --
    -- Pour tester la restitution :
    --   update public.box_reservations set status = 'cancelled' where id = v_boxresa;  -- dispo → 3
    -- Pour tester le plafond :
    --   (créer 3 réservations 'accepted' → dispo 0 → la 4e UPDATE 'accepted' lève
    --    'box_capacite_insuffisante')
  end if;

  -- ════════════════════════════════════════════════════════════════════════
  -- SCÉNARIO 3 — STAGE : inscription cavalier2 (2 participants) → Sarah
  -- ════════════════════════════════════════════════════════════════════════
  insert into public.stage_reservations (id, stage_id, coach_id, cavalier_id, title, stage_titre,
                                         cavalier_nom, cavalier_pseudo, nb_participants, message,
                                         price_total_ht, platform_commission, price_total_ttc, status)
  values (v_stageres, v_stage_a, coach_id, cav2_id, 'Stage test 2 jours', 'Stage test 2 jours',
          'Sophie Dupont', 'SophieD', 2, 'Inscription de test', 340, 20, 360, 'pending')
  on conflict (id) do nothing;

  insert into public.notifications (destinataire_id, auteur_id, type, titre, message, status, action_url, donnees)
  select coach_id, cav2_id, 'stage_reservation', '🎓 Nouvelle demande de stage',
         'Sophie Dupont demande à rejoindre "Stage test 2 jours" (2 participants)', 'pending', '/(tabs)/coach-demandes',
         jsonb_build_object('reservationId', v_stageres::text, 'stageId', v_stage_a::text,
                            'stageTitre', 'Stage test 2 jours', 'nbParticipants', 2)
  where not exists (select 1 from public.notifications
                    where type='stage_reservation' and (donnees->>'reservationId') = v_stageres::text);

  -- → onglet Demandes coach = 2 (1 cours + 1 stage) · badge = 2
  -- Pour tester : update public.stage_reservations set status='accepted' where id = v_stageres;
  --   → mig 104 : stages.places_disponibles 4 → 2
  --   → mig 105 : notif stage_reservation → accepted/lu

  raise notice 'Seed test réservations OK (concours %, coach %, cav2 %)', v_concours, coach_id, cav2_id;
end $$;
