-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 102 — Vérification des FK Transport → users (audit checkpoint)
--
-- Contexte :
--   Cette migration asserte l'état attendu avant la suppression des tables
--   legacy profiles et roles (mig 103). Elle ne modifie aucune donnée.
--
-- Historique du repointage :
--   Le repointage profiles → users sur les tables Transport a été réalisé par
--   des migrations antérieures :
--     • Mig 016 : transport_annonces.auteur_id → users(id) ON DELETE CASCADE
--                 (commentaire mig 016 : "Aligner le FK transport_annonces.auteur_id
--                  sur public.users (était profiles)")
--     • Mig 021 : transport_reservations.seller_id / buyer_id → users(id)
--                 ON DELETE CASCADE (commentaire mig 021 : "les FK buyer_id_fkey /
--                  seller_id_fkey pointaient vers la table legacy public.profiles.
--                  Mig 016 a déjà fait ce travail pour transport_annonces.auteur_id.")
--
--   Audit prod 2026-07-29 :
--     • pg_constraint WHERE confrelid='profiles'::regclass = 0 ligne externe
--       (seule FK résiduelle = profiles.role_id → roles, interne aux deux tables)
--     • transport_annonces.auteur_id → users(id) CASCADE      ✅
--     • transport_reservations.seller_id → users(id) CASCADE   ✅
--     • transport_reservations.buyer_id → users(id) CASCADE    ✅
--
-- Pourquoi une migration plutôt qu'un silence :
--   Documenter l'audit dans l'historique des migrations garantit que toute
--   tentative d'appliquer mig 102 sur un état incorrect (ex. restore partiel,
--   migration manquante) échoue bruyamment AVANT la suppression des tables.
--
-- Périmètre :
--   Assertions uniquement. Aucune modification de données, contraintes,
--   policies, grants ou code applicatif.
--
-- Rollback : 102_verify_transport_fk_users_rollback.sql
--   No-op (migration ne modifie rien, il n'y a rien à annuler).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Garde 1 : transport_annonces.auteur_id → users ──────────────────────────
-- Échoue si la FK pointe encore vers profiles ou est absente.
do $$
declare
  v_target text;
begin
  select ccu.table_name into v_target
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kcu
    on tc.constraint_name = kcu.constraint_name
    and tc.table_schema = kcu.table_schema
  join information_schema.constraint_column_usage ccu
    on ccu.constraint_name = tc.constraint_name
    and ccu.table_schema = tc.table_schema
  join information_schema.referential_constraints rc
    on rc.constraint_name = tc.constraint_name
    and rc.constraint_schema = tc.constraint_schema
  where tc.constraint_type = 'FOREIGN KEY'
    and tc.table_schema = 'public'
    and tc.table_name = 'transport_annonces'
    and kcu.column_name = 'auteur_id';

  if v_target is null then
    raise exception
      '102-GUARD-1 : FK transport_annonces.auteur_id introuvable — état inattendu.';
  end if;

  if v_target <> 'users' then
    raise exception
      '102-GUARD-1 : transport_annonces.auteur_id pointe vers "%" (attendu "users"). '
      'Repointage requis avant mig 103.',
      v_target;
  end if;
end $$;

-- ── Garde 2 : transport_reservations.seller_id → users ──────────────────────
do $$
declare
  v_target text;
begin
  select ccu.table_name into v_target
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kcu
    on tc.constraint_name = kcu.constraint_name
    and tc.table_schema = kcu.table_schema
  join information_schema.constraint_column_usage ccu
    on ccu.constraint_name = tc.constraint_name
    and ccu.table_schema = tc.table_schema
  join information_schema.referential_constraints rc
    on rc.constraint_name = tc.constraint_name
    and rc.constraint_schema = tc.constraint_schema
  where tc.constraint_type = 'FOREIGN KEY'
    and tc.table_schema = 'public'
    and tc.table_name = 'transport_reservations'
    and kcu.column_name = 'seller_id';

  if v_target is null then
    raise exception
      '102-GUARD-2 : FK transport_reservations.seller_id introuvable — état inattendu.';
  end if;

  if v_target <> 'users' then
    raise exception
      '102-GUARD-2 : transport_reservations.seller_id pointe vers "%" (attendu "users"). '
      'Repointage requis avant mig 103.',
      v_target;
  end if;
end $$;

-- ── Garde 3 : transport_reservations.buyer_id → users ───────────────────────
do $$
declare
  v_target text;
begin
  select ccu.table_name into v_target
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kcu
    on tc.constraint_name = kcu.constraint_name
    and tc.table_schema = kcu.table_schema
  join information_schema.constraint_column_usage ccu
    on ccu.constraint_name = tc.constraint_name
    and ccu.table_schema = tc.table_schema
  join information_schema.referential_constraints rc
    on rc.constraint_name = tc.constraint_name
    and rc.constraint_schema = tc.constraint_schema
  where tc.constraint_type = 'FOREIGN KEY'
    and tc.table_schema = 'public'
    and tc.table_name = 'transport_reservations'
    and kcu.column_name = 'buyer_id';

  if v_target is null then
    raise exception
      '102-GUARD-3 : FK transport_reservations.buyer_id introuvable — état inattendu.';
  end if;

  if v_target <> 'users' then
    raise exception
      '102-GUARD-3 : transport_reservations.buyer_id pointe vers "%" (attendu "users"). '
      'Repointage requis avant mig 103.',
      v_target;
  end if;
end $$;

-- ── Garde 4 : 0 FK externe sur profiles (hors profiles.role_id → roles) ─────
-- Détecte toute FK d'une table AUTRE QUE profiles qui pointerait encore vers profiles.
do $$
declare
  v_fk_count int;
  v_fk_list  text;
begin
  select count(*), string_agg(conrelid::regclass::text || '.' ||
    (select attname from pg_attribute where attrelid=c.conrelid and attnum=c.conkey[1]), ', ')
  into v_fk_count, v_fk_list
  from pg_constraint c
  where c.contype = 'f'
    and c.confrelid = 'public.profiles'::regclass
    and c.conrelid  <> 'public.profiles'::regclass;  -- exclut la FK interne role_id

  if v_fk_count > 0 then
    raise exception
      '102-GUARD-4 : % FK externe(s) référencent encore profiles : %. '
      'Repointage requis avant mig 103.',
      v_fk_count, v_fk_list;
  end if;
end $$;

-- ── Garde 5 : ON DELETE CASCADE confirmé sur les 3 FK ───────────────────────
do $$
declare
  v_wrong text;
begin
  select string_agg(conrelid::regclass::text || '.' ||
    (select attname from pg_attribute where attrelid=c.conrelid and attnum=c.conkey[1])
    || ' (on_delete=' || c.confdeltype || ')', ', ')
  into v_wrong
  from pg_constraint c
  join pg_class rel  on rel.oid  = c.conrelid
  join pg_class ref  on ref.oid  = c.confrelid
  join pg_namespace n on n.oid = rel.relnamespace
  where c.contype = 'f'
    and n.nspname = 'public'
    and rel.relname in ('transport_annonces', 'transport_reservations')
    and ref.relname = 'users'
    and (select attname from pg_attribute where attrelid=c.conrelid and attnum=c.conkey[1])
        in ('auteur_id', 'seller_id', 'buyer_id')
    and c.confdeltype <> 'c';  -- 'c' = CASCADE

  if v_wrong is not null then
    raise exception
      '102-GUARD-5 : comportement ON DELETE inattendu (attendu CASCADE) sur : %.',
      v_wrong;
  end if;
end $$;

-- ── Garde 6 : 0 ligne orpheline auteur_id (transport_annonces → users) ──────
do $$
declare
  v_orphan_count int;
begin
  select count(*) into v_orphan_count
  from public.transport_annonces ta
  left join public.users u on u.id = ta.auteur_id
  where ta.auteur_id is not null and u.id is null;

  if v_orphan_count > 0 then
    raise exception
      '102-GUARD-6 : % ligne(s) orpheline(s) dans transport_annonces.auteur_id.',
      v_orphan_count;
  end if;
end $$;

-- ── Garde 7 : 0 ligne orpheline seller_id / buyer_id (transport_reservations → users)
do $$
declare
  v_orphan_count int;
begin
  select count(*) into v_orphan_count
  from public.transport_reservations tr
  left join public.users us on us.id = tr.seller_id
  left join public.users ub on ub.id = tr.buyer_id
  where (tr.seller_id is not null and us.id is null)
     or (tr.buyer_id  is not null and ub.id is null);

  if v_orphan_count > 0 then
    raise exception
      '102-GUARD-7 : % ligne(s) orpheline(s) dans transport_reservations (seller_id/buyer_id).',
      v_orphan_count;
  end if;
end $$;

-- ── Résumé documentaire (sans effet) ─────────────────────────────────────────
-- Si toutes les gardes passent :
--   ✅ transport_annonces.auteur_id    → users(id) CASCADE (repointé mig 016)
--   ✅ transport_reservations.seller_id → users(id) CASCADE (repointé mig 021)
--   ✅ transport_reservations.buyer_id  → users(id) CASCADE (repointé mig 021)
--   ✅ 0 FK externe sur profiles (hors interne role_id)
--   ✅ 0 orphelin auteur_id
--   ✅ 0 orphelin seller_id/buyer_id
-- État validé → mig 103 (drop profiles/roles) peut procéder.
