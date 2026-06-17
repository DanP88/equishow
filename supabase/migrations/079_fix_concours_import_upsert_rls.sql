-- ============================================================================
-- 079 — FIX import concours : ON CONFLICT(numero_ffe) + RLS admin
-- ============================================================================
-- Symptôme : l'import CSV de 292 concours n'écrivait RIEN en prod (UI « terminé »
-- trompeuse, erreurs avalées côté front). Deux causes :
--
--  (1) `supabase.from('concours').upsert(payload,{onConflict:'numero_ffe'})` échoue
--      avec 42P10 « no unique or exclusion constraint matching the ON CONFLICT
--      specification » car le seul index unique sur numero_ffe est PARTIEL
--      (ux_concours_numero_ffe ... WHERE numero_ffe IS NOT NULL) → ON CONFLICT
--      (numero_ffe) ne peut pas l'inférer. → vraie CONTRAINTE UNIQUE (inférable).
--
--  (2) RLS `concours_insert/update/delete_admin` = is_admin(), qui s'appuie sur
--      profiles+roles (table partielle : 6/14 users, AUCUN rôle admin lié) →
--      is_admin() renvoie FALSE pour TOUT LE MONDE, y compris admin@equishow.app
--      → tout insert client refusé. → aligner sur public.users.role='admin'
--      (même décision que mig 076 pour le Radar organisateur).
--
-- 100 % ADDITIF/correctif : ne touche AUCUNE donnée, ne change pas le schéma des
-- colonnes. SELECT public reste inchangé. Idempotent.
--
-- Application : supabase db query -f supabase/migrations/079_*.sql --linked
--               puis supabase migration repair --status applied 079 --linked. JAMAIS db push.
-- Rollback : 079_fix_concours_import_upsert_rls_rollback.sql
-- ============================================================================

begin;

-- ── (1) Contrainte UNIQUE inférable par ON CONFLICT(numero_ffe) ───────────────
-- Garde-fou : refuse la migration si des doublons numero_ffe non-null existent.
do $$
begin
  if exists (
    select 1 from public.concours
    where numero_ffe is not null
    group by numero_ffe having count(*) > 1
  ) then
    raise exception '079: doublons numero_ffe présents — dédupliquer avant d''ajouter la contrainte unique';
  end if;
end $$;

drop index if exists public.ux_concours_numero_ffe;
-- NULLs multiples autorisés (standard SQL) ; l'import filtre déjà les lignes sans numéro.
alter table public.concours
  add constraint concours_numero_ffe_key unique (numero_ffe);

-- ── (2) RLS admin alignée sur public.users.role='admin' ──────────────────────
drop policy if exists concours_insert_admin on public.concours;
create policy concours_insert_admin on public.concours
  for insert to authenticated
  with check (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'));

drop policy if exists concours_update_admin on public.concours;
create policy concours_update_admin on public.concours
  for update to authenticated
  using      (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'))
  with check (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'));

drop policy if exists concours_delete_admin on public.concours;
create policy concours_delete_admin on public.concours
  for delete to authenticated
  using (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'));

commit;
