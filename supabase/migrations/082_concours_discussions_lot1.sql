-- ============================================================================
-- 082 — CONCOURS · DISCUSSIONS LOT 1 (Option C : 1 fil public / concours)
-- ============================================================================
-- Périmètre LOT 1 :
--   • concours_messages       : 1 fil public par concours, topic/tag + parent_id
--                               réservés dès le départ (LOT 2), soft delete.
--   • concours_thread_reads   : marqueur last_read_at par (concours,user) → badge
--                               non-lu (patron conversation_reads de 038).
--   • RLS lecture publique (anon+auth), insert authentifié (auteur=auth.uid()),
--     soft delete par AUTEUR · ORG propriétaire (fn_org_owns_concours) · ADMIN.
--   • Identité affichée dénormalisée = pseudo + initiales + couleur d'avatar
--     UNIQUEMENT (pas de nom complet, pas de club/niveau) — rempli serveur.
--   • Realtime sur concours_messages.
--
-- HORS LOT 1 (réservé, non câblé ici) : notifications followers, mentions,
--   signalement, photos, réponses imbriquées (parent_id existe, jamais peuplé).
--
-- 100% ADDITIF. Ne touche NI payments, NI reservations, NI escrow, NI concours
-- existant. Idempotent (IF NOT EXISTS). Application :
--   supabase db query -f supabase/migrations/082_concours_discussions_lot1.sql
--   supabase migration repair --status applied 082 --linked
-- JAMAIS db push.
-- ============================================================================

begin;

-- ── 1. Table concours_messages ──────────────────────────────────────────────
create table if not exists public.concours_messages (
  id               uuid primary key default gen_random_uuid(),
  concours_id      uuid not null references public.concours(id) on delete cascade,
  auteur_id        uuid not null references public.users(id)    on delete cascade,
  -- Snapshots identité (pseudo + initiales + couleur) — remplis par trigger.
  auteur_pseudo    text,
  auteur_initiales text,
  auteur_couleur   text,
  auteur_role      text,                         -- réservé (badge org/admin LOT 2)
  contenu          text not null default '',
  topic            text,                         -- tag LOT 2 (null = Général)
  parent_id        uuid references public.concours_messages(id) on delete cascade, -- réponses LOT 2
  is_deleted       boolean not null default false,
  deleted_by       uuid references public.users(id) on delete set null,
  deleted_at       timestamptz,
  created_at       timestamptz not null default now(),
  -- contenu non vide tant que non supprimé ; vidé au soft delete.
  constraint concours_messages_contenu_ck
    check (is_deleted or (char_length(contenu) between 1 and 2000)),
  -- tags autorisés (extensible LOT 2) — null toléré (= Général).
  constraint concours_messages_topic_ck
    check (topic is null or topic in ('general','transport','coach','hebergement','question','photo'))
);

comment on table public.concours_messages is
  'LOT1 082 — fil public par concours (Option C). Lecture publique, soft delete auteur/org/admin. topic+parent_id réservés LOT2.';

create index if not exists idx_concours_messages_thread
  on public.concours_messages (concours_id, created_at);
create index if not exists idx_concours_messages_auteur
  on public.concours_messages (auteur_id);

-- ── 2. Trigger fill auteur (serveur-autoritatif) ────────────────────────────
-- Remplit le snapshot identité depuis public.users ; ignore tout ce que le
-- client tenterait d'écrire dans les colonnes auteur_*.
create or replace function public.tg_concours_message_fill_author()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  select u.pseudo, u.initiales, u.avatar_color, u.role
    into new.auteur_pseudo, new.auteur_initiales, new.auteur_couleur, new.auteur_role
  from public.users u where u.id = new.auteur_id;
  -- Fallback pseudo : prénom si pseudo absent (jamais le nom complet).
  if new.auteur_pseudo is null or char_length(trim(new.auteur_pseudo)) = 0 then
    select u.prenom into new.auteur_pseudo from public.users u where u.id = new.auteur_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_concours_message_fill_author on public.concours_messages;
create trigger trg_concours_message_fill_author
  before insert on public.concours_messages
  for each row execute function public.tg_concours_message_fill_author();

-- ── 3. Trigger soft delete (horodatage + purge contenu) ─────────────────────
-- Au passage is_deleted false→true : vide le contenu (RGPD) + stamp.
create or replace function public.tg_concours_message_soft_delete()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.is_deleted and not old.is_deleted then
    new.contenu    := '';
    new.deleted_at := now();
    new.deleted_by := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_concours_message_soft_delete on public.concours_messages;
create trigger trg_concours_message_soft_delete
  before update on public.concours_messages
  for each row execute function public.tg_concours_message_soft_delete();

-- ── 4. RLS concours_messages ────────────────────────────────────────────────
alter table public.concours_messages enable row level security;

-- Lecture publique (anon + auth) : fil visible par tous.
drop policy if exists concours_messages_select_all on public.concours_messages;
create policy concours_messages_select_all
  on public.concours_messages for select
  using (true);

-- Insert : utilisateur connecté, auteur = lui-même, message non pré-supprimé.
drop policy if exists concours_messages_insert_auth on public.concours_messages;
create policy concours_messages_insert_auth
  on public.concours_messages for insert to authenticated
  with check (auteur_id = auth.uid() and is_deleted = false);

-- Update (soft delete) : auteur OU organisateur propriétaire OU admin.
-- fn_org_owns_concours(uuid) (mig 076) couvre org approuvé + admin role.
drop policy if exists concours_messages_softdelete on public.concours_messages;
create policy concours_messages_softdelete
  on public.concours_messages for update to authenticated
  using (
    auteur_id = auth.uid()
    or public.fn_org_owns_concours(concours_id)
  )
  with check (
    auteur_id = auth.uid()
    or public.fn_org_owns_concours(concours_id)
  );

-- Pas de policy DELETE → hard delete bloqué (soft delete uniquement).

-- ── 5. Table concours_thread_reads (badge non-lu) ───────────────────────────
create table if not exists public.concours_thread_reads (
  concours_id  uuid not null references public.concours(id) on delete cascade,
  user_id      uuid not null references public.users(id)    on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (concours_id, user_id)
);

comment on table public.concours_thread_reads is
  'LOT1 082 — marqueur de lecture du fil concours (patron conversation_reads). Badge non-lu.';

alter table public.concours_thread_reads enable row level security;

drop policy if exists concours_thread_reads_all_own on public.concours_thread_reads;
create policy concours_thread_reads_all_own
  on public.concours_thread_reads for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ── 6. Compteur non-lu (SECURITY DEFINER, par concours) ─────────────────────
-- Messages non supprimés, postés par un AUTRE, après mon last_read_at.
create or replace function public.fn_concours_thread_unread(p_concours_id uuid)
returns integer language sql stable security definer set search_path = public as $$
  select count(*)::int
  from public.concours_messages m
  where m.concours_id = p_concours_id
    and m.is_deleted = false
    and m.auteur_id <> auth.uid()
    and m.created_at > coalesce(
      (select r.last_read_at from public.concours_thread_reads r
        where r.concours_id = p_concours_id and r.user_id = auth.uid()),
      '-infinity'::timestamptz
    );
$$;

revoke all on function public.fn_concours_thread_unread(uuid) from public;
grant execute on function public.fn_concours_thread_unread(uuid) to authenticated;

-- ── 7. Realtime sur concours_messages ───────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'concours_messages'
  ) then
    alter publication supabase_realtime add table public.concours_messages;
  end if;
end $$;

alter table public.concours_messages replica identity full;

commit;
