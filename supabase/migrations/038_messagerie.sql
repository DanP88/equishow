-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 038 — Messagerie persistée (conversations + messages + lectures)
--
-- Avant : messagerie 100% in-memory (messagesStore dans data/store.ts) → rien
-- persisté, impossible d'échanger entre 2 comptes. Cette migration crée le
-- backend : 2 participants par conversation, messages, suivi des non-lus.
--
-- Snapshots d'affichage (a_*/b_*) stockés sur la conversation pour éviter les
-- jointures users à chaque rendu (même approche que les autres tables).
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  participant_a uuid not null references public.users(id) on delete cascade,
  participant_b uuid not null references public.users(id) on delete cascade,
  a_nom text, a_pseudo text, a_couleur text, a_initiales text,
  b_nom text, b_pseudo text, b_couleur text, b_initiales text,
  sujet text,
  annonce text,
  annonce_type text,
  last_message text,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  constraint conversations_distinct_participants check (participant_a <> participant_b)
);
create index if not exists idx_conversations_a on public.conversations(participant_a);
create index if not exists idx_conversations_b on public.conversations(participant_b);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.users(id) on delete cascade,
  contenu text not null check (length(trim(contenu)) > 0),
  created_at timestamptz not null default now()
);
create index if not exists idx_messages_conv on public.messages(conversation_id, created_at);

create table if not exists public.conversation_reads (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

-- ── Helpers ──────────────────────────────────────────────────────────────────
-- Membre de la conversation ?
create or replace function public.is_conversation_member(conv uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.conversations c
    where c.id = conv and auth.uid() in (c.participant_a, c.participant_b)
  );
$$;

-- À l'insert d'un message : met à jour last_message / last_message_at de la conv.
create or replace function public.touch_conversation_on_message()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.conversations
     set last_message = new.contenu, last_message_at = new.created_at
   where id = new.conversation_id;
  return new;
end;
$$;
drop trigger if exists trg_touch_conversation on public.messages;
create trigger trg_touch_conversation after insert on public.messages
  for each row execute function public.touch_conversation_on_message();

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.conversation_reads enable row level security;

drop policy if exists conversations_select_member on public.conversations;
create policy conversations_select_member on public.conversations
  for select to authenticated
  using (auth.uid() in (participant_a, participant_b));

drop policy if exists conversations_insert_self on public.conversations;
create policy conversations_insert_self on public.conversations
  for insert to authenticated
  with check (auth.uid() in (participant_a, participant_b));

drop policy if exists conversations_update_member on public.conversations;
create policy conversations_update_member on public.conversations
  for update to authenticated
  using (auth.uid() in (participant_a, participant_b));

drop policy if exists messages_select_member on public.messages;
create policy messages_select_member on public.messages
  for select to authenticated
  using (public.is_conversation_member(conversation_id));

drop policy if exists messages_insert_member on public.messages;
create policy messages_insert_member on public.messages
  for insert to authenticated
  with check (sender_id = auth.uid() and public.is_conversation_member(conversation_id));

drop policy if exists reads_all_own on public.conversation_reads;
create policy reads_all_own on public.conversation_reads
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ── Realtime ───────────────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='conversations') then
    alter publication supabase_realtime add table public.conversations;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='messages') then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;
alter table public.conversations replica identity full;
alter table public.messages replica identity full;
