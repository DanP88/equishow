-- ─────────────────────────────────────────────────────────────────────────────
-- Equishow — Seed des 5 comptes de test sur le nouveau projet
-- À exécuter dans le SQL Editor du dashboard :
-- https://supabase.com/dashboard/project/vhkjvnpxcqlmpokrgymx/sql/new
--
-- Crée auth.users + auth.identities (login email/password) + public.users.
-- Idempotent : peut être relancé sans casser quoi que ce soit.
-- ─────────────────────────────────────────────────────────────────────────────

do $$
declare
  acct record;
begin
  for acct in
    select * from (values
      -- (id,                                     email,                       password,   prenom,   nom,       role)
      ('550e8400-e29b-41d4-a716-446655440001'::uuid, 'sarah.l@equishow.test',     'test123',  'Sarah',  'Lefebvre','cavalier'),
      ('550e8400-e29b-41d4-a716-446655440099'::uuid, 'cavalier2@equishow.test',   'test123',  'Sophie', 'Dupont',  'cavalier'),
      ('550e8400-e29b-41d4-a716-446655440002'::uuid, 'emilie.l@equishow.test',    'test123',  'Émilie', 'Laurent', 'coach'),
      ('550e8400-e29b-41d4-a716-446655440003'::uuid, 'julien.m@equishow.test',    'test123',  'Julien', 'Mercier', 'organisateur'),
      ('550e8400-e29b-41d4-a716-446655440006'::uuid, 'admin@equishow.fr',         'admin123', 'Admin',  'Equishow','admin')
    ) as t(id, email, password, prenom, nom, role)
  loop
    -- 1. auth.users (compte authentifié Supabase)
    insert into auth.users (
      id, instance_id, aud, role,
      email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at
    ) values (
      acct.id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      acct.email,
      crypt(acct.password, gen_salt('bf')),
      now(),
      jsonb_build_object('provider','email','providers',jsonb_build_array('email')),
      jsonb_build_object('prenom', acct.prenom, 'nom', acct.nom, 'role', acct.role),
      now(), now()
    )
    on conflict (id) do update set
      email = excluded.email,
      encrypted_password = excluded.encrypted_password,
      email_confirmed_at = excluded.email_confirmed_at,
      raw_user_meta_data = excluded.raw_user_meta_data,
      updated_at = now();

    -- 2. auth.identities (provider email)
    insert into auth.identities (
      id, user_id, identity_data, provider, provider_id,
      created_at, updated_at, last_sign_in_at
    ) values (
      gen_random_uuid(),
      acct.id,
      jsonb_build_object(
        'sub',             acct.id::text,
        'email',           acct.email,
        'email_verified',  true,
        'phone_verified',  false
      ),
      'email',
      acct.id::text,
      now(), now(), now()
    )
    on conflict (provider, provider_id) do nothing;

    -- 3. public.users (profil métier)
    insert into public.users (
      id, email, prenom, nom, pseudo, role, plan,
      created_at, updated_at
    ) values (
      acct.id,
      acct.email,
      acct.prenom,
      acct.nom,
      acct.prenom || left(acct.nom, 1),
      acct.role,
      'Gratuit',
      now(), now()
    )
    on conflict (id) do update set
      email   = excluded.email,
      prenom  = excluded.prenom,
      nom     = excluded.nom,
      pseudo  = excluded.pseudo,
      role    = excluded.role,
      updated_at = now();

  end loop;
end $$;

-- Vérification
select
  u.id,
  u.email,
  u.role,
  case when au.encrypted_password is not null then '✓ password set' else '✗ no password' end as auth_status
from public.users u
left join auth.users au on au.id = u.id
order by u.role, u.email;
