-- Migration 008 : durcissement RLS sur public.transport_annonces (audit P9)
-- Avant : SELECT USING (true) sans TO authenticated -> lecture anon possible
--         (scraping marketplace transport, fuite contact/prix/trajets).
-- Après : SELECT réservé aux users authentifiés, cohérent avec
--         coach_annonces, box_annonces, stages (migration 005).

drop policy if exists "transport_annonces_select_all" on public.transport_annonces;

create policy "transport_annonces_select_authenticated"
  on public.transport_annonces
  for select
  to authenticated
  using (true);

-- Les policies INSERT/UPDATE/DELETE existantes (auteur_id = auth.uid())
-- restent inchangées et continuent de protéger les mutations.
