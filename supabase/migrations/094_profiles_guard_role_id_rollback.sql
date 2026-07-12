-- ============================================================================
-- ROLLBACK 094 — restaure l'état AVANT le verrou anti-escalade profiles.role_id.
-- ⚠️ Réintroduit la vulnérabilité F2 (self-admin via profiles.role_id). Ne
-- rollback que pour diagnostic sur cluster jetable.
-- ============================================================================
begin;

-- (1) Restaure les grants table-level d'origine et retire les grants colonne.
grant insert on public.profiles to authenticated;
grant update on public.profiles to authenticated;
revoke insert (id, full_name, phone, avatar_url, club_name, ffe_number, is_active)
  on public.profiles from authenticated;
revoke update (full_name, phone, avatar_url, club_name, ffe_number, is_active)
  on public.profiles from authenticated;

-- (2) Retire le WITH CHECK ajouté (ALTER POLICY ne peut pas remettre with_check
--     à « rien » → drop/recreate pour restaurer USING seul, sans with check).
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update using (id = auth.uid());

-- (3) Restaure is_admin() sans search_path épinglé (corps identique).
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
as $$
  select exists (
    select 1
    from public.profiles p
    join public.roles r on r.id = p.role_id
    where p.id = auth.uid()
      and r.name = 'admin'
      and p.is_active = true
  );
$$;

commit;
