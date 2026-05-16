-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 025 — Tables community posts (P26)
--
-- 3 espaces de discussion isolés par rôle :
-- - posts_community     : visible par tous les authentifiés (cavalier/coach/org)
-- - posts_coach         : visible uniquement par les coachs (et admins)
-- - posts_organisateur  : visible uniquement par les organisateurs (et admins)
--
-- Chaque post a une table commentaires dédiée (com_posts_*).
-- Snapshots auteur (nom, initiales, couleur) stockés sur les posts/commentaires
-- pour éviter un JOIN systématique côté front.
-- Likes stockés en text[] (liked_by) — simple, pas de table likes séparée.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── posts_community ─────────────────────────────────────────────────────────
create table if not exists public.posts_community (
  id                uuid primary key default gen_random_uuid(),
  auteur_id         uuid not null references public.users(id) on delete cascade,
  auteur_nom        text,
  auteur_initiales  text,
  auteur_couleur    text,
  contenu           text not null,
  liked_by          uuid[] not null default '{}'::uuid[],
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_posts_community_created_at on public.posts_community(created_at desc);
create index if not exists idx_posts_community_auteur     on public.posts_community(auteur_id);

alter table public.posts_community enable row level security;

create policy "posts_community_select_authenticated" on public.posts_community
  for select to authenticated using (true);
create policy "posts_community_insert_self" on public.posts_community
  for insert to authenticated with check (auteur_id = auth.uid());
create policy "posts_community_update_self" on public.posts_community
  for update to authenticated using (auteur_id = auth.uid()) with check (auteur_id = auth.uid());
create policy "posts_community_delete_self" on public.posts_community
  for delete to authenticated using (auteur_id = auth.uid());

create trigger trg_posts_community_updated_at
  before update on public.posts_community
  for each row execute function public.set_updated_at();

-- ── com_posts_community ─────────────────────────────────────────────────────
create table if not exists public.com_posts_community (
  id                uuid primary key default gen_random_uuid(),
  post_id           uuid not null references public.posts_community(id) on delete cascade,
  auteur_id         uuid not null references public.users(id) on delete cascade,
  auteur_nom        text,
  auteur_initiales  text,
  auteur_couleur    text,
  texte             text not null,
  liked_by          uuid[] not null default '{}'::uuid[],
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_com_posts_community_post on public.com_posts_community(post_id, created_at);

alter table public.com_posts_community enable row level security;

create policy "com_posts_community_select_authenticated" on public.com_posts_community
  for select to authenticated using (true);
create policy "com_posts_community_insert_self" on public.com_posts_community
  for insert to authenticated with check (auteur_id = auth.uid());
create policy "com_posts_community_update_self" on public.com_posts_community
  for update to authenticated using (auteur_id = auth.uid()) with check (auteur_id = auth.uid());
create policy "com_posts_community_delete_self" on public.com_posts_community
  for delete to authenticated using (auteur_id = auth.uid());

create trigger trg_com_posts_community_updated_at
  before update on public.com_posts_community
  for each row execute function public.set_updated_at();

-- ── posts_coach (visible coach + admin) ─────────────────────────────────────
create table if not exists public.posts_coach (
  id                uuid primary key default gen_random_uuid(),
  auteur_id         uuid not null references public.users(id) on delete cascade,
  auteur_nom        text,
  auteur_initiales  text,
  auteur_couleur    text,
  contenu           text not null,
  liked_by          uuid[] not null default '{}'::uuid[],
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_posts_coach_created_at on public.posts_coach(created_at desc);
create index if not exists idx_posts_coach_auteur     on public.posts_coach(auteur_id);

alter table public.posts_coach enable row level security;

create policy "posts_coach_select_role" on public.posts_coach
  for select to authenticated
  using (exists (select 1 from public.users where users.id = auth.uid() and users.role in ('coach','admin')));
create policy "posts_coach_insert_self" on public.posts_coach
  for insert to authenticated
  with check (auteur_id = auth.uid()
              and exists (select 1 from public.users where users.id = auth.uid() and users.role in ('coach','admin')));
create policy "posts_coach_update_self" on public.posts_coach
  for update to authenticated using (auteur_id = auth.uid()) with check (auteur_id = auth.uid());
create policy "posts_coach_delete_self" on public.posts_coach
  for delete to authenticated using (auteur_id = auth.uid());

create trigger trg_posts_coach_updated_at
  before update on public.posts_coach
  for each row execute function public.set_updated_at();

-- ── com_posts_coach ─────────────────────────────────────────────────────────
create table if not exists public.com_posts_coach (
  id                uuid primary key default gen_random_uuid(),
  post_id           uuid not null references public.posts_coach(id) on delete cascade,
  auteur_id         uuid not null references public.users(id) on delete cascade,
  auteur_nom        text,
  auteur_initiales  text,
  auteur_couleur    text,
  texte             text not null,
  liked_by          uuid[] not null default '{}'::uuid[],
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_com_posts_coach_post on public.com_posts_coach(post_id, created_at);

alter table public.com_posts_coach enable row level security;

create policy "com_posts_coach_select_role" on public.com_posts_coach
  for select to authenticated
  using (exists (select 1 from public.users where users.id = auth.uid() and users.role in ('coach','admin')));
create policy "com_posts_coach_insert_self" on public.com_posts_coach
  for insert to authenticated
  with check (auteur_id = auth.uid()
              and exists (select 1 from public.users where users.id = auth.uid() and users.role in ('coach','admin')));
create policy "com_posts_coach_update_self" on public.com_posts_coach
  for update to authenticated using (auteur_id = auth.uid()) with check (auteur_id = auth.uid());
create policy "com_posts_coach_delete_self" on public.com_posts_coach
  for delete to authenticated using (auteur_id = auth.uid());

create trigger trg_com_posts_coach_updated_at
  before update on public.com_posts_coach
  for each row execute function public.set_updated_at();

-- ── posts_organisateur (visible organisateur + admin) ───────────────────────
create table if not exists public.posts_organisateur (
  id                uuid primary key default gen_random_uuid(),
  auteur_id         uuid not null references public.users(id) on delete cascade,
  auteur_nom        text,
  auteur_initiales  text,
  auteur_couleur    text,
  contenu           text not null,
  liked_by          uuid[] not null default '{}'::uuid[],
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_posts_organisateur_created_at on public.posts_organisateur(created_at desc);
create index if not exists idx_posts_organisateur_auteur     on public.posts_organisateur(auteur_id);

alter table public.posts_organisateur enable row level security;

create policy "posts_organisateur_select_role" on public.posts_organisateur
  for select to authenticated
  using (exists (select 1 from public.users where users.id = auth.uid() and users.role in ('organisateur','admin')));
create policy "posts_organisateur_insert_self" on public.posts_organisateur
  for insert to authenticated
  with check (auteur_id = auth.uid()
              and exists (select 1 from public.users where users.id = auth.uid() and users.role in ('organisateur','admin')));
create policy "posts_organisateur_update_self" on public.posts_organisateur
  for update to authenticated using (auteur_id = auth.uid()) with check (auteur_id = auth.uid());
create policy "posts_organisateur_delete_self" on public.posts_organisateur
  for delete to authenticated using (auteur_id = auth.uid());

create trigger trg_posts_organisateur_updated_at
  before update on public.posts_organisateur
  for each row execute function public.set_updated_at();

-- ── com_posts_organisateur ──────────────────────────────────────────────────
create table if not exists public.com_posts_organisateur (
  id                uuid primary key default gen_random_uuid(),
  post_id           uuid not null references public.posts_organisateur(id) on delete cascade,
  auteur_id         uuid not null references public.users(id) on delete cascade,
  auteur_nom        text,
  auteur_initiales  text,
  auteur_couleur    text,
  texte             text not null,
  liked_by          uuid[] not null default '{}'::uuid[],
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_com_posts_organisateur_post on public.com_posts_organisateur(post_id, created_at);

alter table public.com_posts_organisateur enable row level security;

create policy "com_posts_organisateur_select_role" on public.com_posts_organisateur
  for select to authenticated
  using (exists (select 1 from public.users where users.id = auth.uid() and users.role in ('organisateur','admin')));
create policy "com_posts_organisateur_insert_self" on public.com_posts_organisateur
  for insert to authenticated
  with check (auteur_id = auth.uid()
              and exists (select 1 from public.users where users.id = auth.uid() and users.role in ('organisateur','admin')));
create policy "com_posts_organisateur_update_self" on public.com_posts_organisateur
  for update to authenticated using (auteur_id = auth.uid()) with check (auteur_id = auth.uid());
create policy "com_posts_organisateur_delete_self" on public.com_posts_organisateur
  for delete to authenticated using (auteur_id = auth.uid());

create trigger trg_com_posts_organisateur_updated_at
  before update on public.com_posts_organisateur
  for each row execute function public.set_updated_at();
