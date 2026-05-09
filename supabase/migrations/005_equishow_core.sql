-- ─────────────────────────────────────────────────────────────────────────────
-- Equishow — Migration 005 : tables business core
-- Crée les 11 tables réellement utilisées par l'app mobile et les Edge Functions.
-- RLS by default. FK explicites vers auth.users / users / annonces.
-- ─────────────────────────────────────────────────────────────────────────────

-- pgcrypto / uuid-ossp sont déjà installés par migration 001.

-- ── users (profil métier, étend auth.users) ─────────────────────────────────
-- Distincte de public.profiles (migration 001) qui reste utilisée par les
-- tables transport_*. Le code mobile + edge functions tapent ici.
create table if not exists public.users (
  id                          uuid primary key references auth.users(id) on delete cascade,
  email                       text not null unique,
  prenom                      text not null,
  nom                         text not null,
  pseudo                      text,
  role                        text not null default 'cavalier'
                                check (role in ('cavalier','coach','organisateur','admin')),
  plan                        text default 'Gratuit',
  plan_id                     text default 'gratuit',
  region                      text,
  disciplines                 text[] not null default '{}'::text[],
  bio                         text,
  avatar_color                text,
  avatar_url                  text,
  initiales                   text,

  -- Stripe Connect (côté seller : coach / organisateur)
  stripe_account_id           text,
  stripe_account_status       text default 'not_started',
  stripe_onboarding_complete  boolean not null default false,
  stripe_details_submitted    boolean not null default false,
  stripe_charges_enabled      boolean not null default false,
  stripe_payouts_enabled      boolean not null default false,
  stripe_requirements_json    jsonb,
  stripe_last_updated         timestamptz default now(),

  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

create index if not exists idx_users_role on public.users(role);

create trigger trg_users_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

-- ── platform_settings (commissions, params globaux) ─────────────────────────
create table if not exists public.platform_settings (
  key         text primary key,
  value       jsonb not null,
  description text,
  updated_by  uuid references public.users(id) on delete set null,
  updated_at  timestamptz not null default now()
);

-- Valeurs par défaut (commissions 5% par défaut, modifiable par admin)
insert into public.platform_settings (key, value, description) values
  ('commission_trajet',   '0.05', 'Taux de commission sur les trajets'),
  ('commission_location', '0.05', 'Taux de commission sur les locations de van'),
  ('commission_cours',    '0.09', 'Taux de commission sur les cours de coaching'),
  ('commission_box',      '0.05', 'Taux de commission sur les locations de box'),
  ('tva_rate',            '0.20', 'Taux de TVA appliqué')
on conflict (key) do nothing;

-- ── coach_annonces ──────────────────────────────────────────────────────────
create table if not exists public.coach_annonces (
  id                  uuid primary key default gen_random_uuid(),
  auteur_id           uuid not null references public.users(id) on delete cascade,
  auteur_nom          text,
  titre               text not null,
  description         text,
  type                text check (type in ('concours','regulier')),
  discipline          text,
  niveau              text,
  places              integer,
  places_disponibles  integer,
  date_debut          date,
  date_fin            date,
  prix_heure_ht       numeric(10,2),
  prix_heure_ttc      numeric(10,2),
  concours_nom        text,
  region              text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists idx_coach_annonces_auteur on public.coach_annonces(auteur_id);
create index if not exists idx_coach_annonces_dates  on public.coach_annonces(date_debut, date_fin);

create trigger trg_coach_annonces_updated_at
  before update on public.coach_annonces
  for each row execute function public.set_updated_at();

-- ── course_demands (réservations de cours) ──────────────────────────────────
create table if not exists public.course_demands (
  id                    uuid primary key default gen_random_uuid(),
  annonce_id            uuid not null references public.coach_annonces(id) on delete cascade,
  coach_id              uuid not null references public.users(id) on delete cascade,
  cavalier_id           uuid not null references public.users(id) on delete cascade,
  title                 text not null,
  discipline            text,
  level                 text,
  horse_name            text,
  message               text,
  date_debut            date not null,
  date_fin              date not null,
  nb_jours              integer not null default 1,
  price_per_day_ttc     numeric(10,2) not null,
  total_amount_ht       numeric(10,2) not null,
  platform_commission   numeric(10,2) not null,
  total_amount_ttc      numeric(10,2) not null,
  status                text not null default 'pending'
                          check (status in ('pending','accepted','rejected','paid','completed','cancelled')),
  concours_nom          text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists idx_course_demands_coach    on public.course_demands(coach_id);
create index if not exists idx_course_demands_cavalier on public.course_demands(cavalier_id);
create index if not exists idx_course_demands_annonce  on public.course_demands(annonce_id);
create index if not exists idx_course_demands_status   on public.course_demands(status);

create trigger trg_course_demands_updated_at
  before update on public.course_demands
  for each row execute function public.set_updated_at();

-- ── box_annonces ────────────────────────────────────────────────────────────
create table if not exists public.box_annonces (
  id                    uuid primary key default gen_random_uuid(),
  auteur_id             uuid not null references public.users(id) on delete cascade,
  auteur_nom            text,
  titre                 text,
  lieu                  text not null,
  adresse               text,
  code_postal           text,
  date_debut            timestamptz not null,
  date_fin              timestamptz not null,
  nb_boxes              integer default 1,
  nb_boxes_disponibles  integer default 1,
  prix_nuit_ht          numeric(10,2) not null default 0,
  concours              text,
  description           text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists idx_box_annonces_auteur on public.box_annonces(auteur_id);
create index if not exists idx_box_annonces_dates  on public.box_annonces(date_debut, date_fin);

create trigger trg_box_annonces_updated_at
  before update on public.box_annonces
  for each row execute function public.set_updated_at();

-- ── box_reservations ────────────────────────────────────────────────────────
create table if not exists public.box_reservations (
  id                    uuid primary key default gen_random_uuid(),
  box_id                uuid not null references public.box_annonces(id) on delete cascade,
  seller_id             uuid not null references public.users(id) on delete cascade,
  buyer_id              uuid not null references public.users(id) on delete cascade,
  title                 text not null,
  lieu                  text,
  nb_nuits              integer not null default 1,
  date_debut            date not null,
  date_fin              date not null,
  message               text,
  price_total_ht        numeric(10,2) not null,
  platform_commission   numeric(10,2) not null,
  price_total_ttc       numeric(10,2) not null,
  status                text not null default 'pending'
                          check (status in ('pending','accepted','rejected','paid','completed','cancelled')),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists idx_box_reservations_seller on public.box_reservations(seller_id);
create index if not exists idx_box_reservations_buyer  on public.box_reservations(buyer_id);
create index if not exists idx_box_reservations_box    on public.box_reservations(box_id);
create index if not exists idx_box_reservations_status on public.box_reservations(status);

create trigger trg_box_reservations_updated_at
  before update on public.box_reservations
  for each row execute function public.set_updated_at();

-- ── stages ──────────────────────────────────────────────────────────────────
create table if not exists public.stages (
  id                  uuid primary key default gen_random_uuid(),
  auteur_id           uuid not null references public.users(id) on delete cascade,
  auteur_nom          text,
  titre               text not null,
  description         text,
  disciplines         text[] not null default '{}'::text[],
  niveaux             text[] not null default '{}'::text[],
  date_debut          timestamptz not null,
  date_fin            timestamptz not null,
  nb_jours            integer default 1,
  prix_ttc            numeric(10,2) not null default 0,
  places              integer default 10,
  places_disponibles  integer default 10,
  concours            text,
  region              text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists idx_stages_auteur on public.stages(auteur_id);
create index if not exists idx_stages_dates  on public.stages(date_debut, date_fin);

create trigger trg_stages_updated_at
  before update on public.stages
  for each row execute function public.set_updated_at();

-- ── stage_reservations ──────────────────────────────────────────────────────
create table if not exists public.stage_reservations (
  id                    uuid primary key default gen_random_uuid(),
  stage_id              uuid references public.stages(id) on delete set null,
  coach_id              uuid not null references public.users(id) on delete cascade,
  cavalier_id           uuid not null references public.users(id) on delete cascade,
  title                 text not null,
  stage_titre           text,
  cavalier_nom          text,
  cavalier_pseudo       text,
  cavalier_initiales    text,
  cavalier_couleur      text,
  nb_participants       integer default 1,
  message               text,
  price_total_ht        numeric(10,2) not null,
  platform_commission   numeric(10,2) not null,
  price_total_ttc       numeric(10,2) not null,
  status                text not null default 'pending'
                          check (status in ('pending','accepted','rejected','paid','completed','cancelled')),
  date_reservation      timestamptz default now(),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists idx_stage_reservations_coach    on public.stage_reservations(coach_id);
create index if not exists idx_stage_reservations_cavalier on public.stage_reservations(cavalier_id);
create index if not exists idx_stage_reservations_stage    on public.stage_reservations(stage_id);
create index if not exists idx_stage_reservations_status   on public.stage_reservations(status);

create trigger trg_stage_reservations_updated_at
  before update on public.stage_reservations
  for each row execute function public.set_updated_at();

-- ── payments (Stripe) ───────────────────────────────────────────────────────
create table if not exists public.payments (
  id                          uuid primary key default gen_random_uuid(),
  buyer_id                    uuid not null references public.users(id) on delete cascade,
  seller_id                   uuid not null references public.users(id) on delete cascade,
  type                        text not null check (type in ('course','stage','transport','box')),
  course_demand_id            uuid references public.course_demands(id) on delete set null,
  stage_reservation_id        uuid references public.stage_reservations(id) on delete set null,
  transport_reservation_id    text references public.transport_reservations(id) on delete set null,
  box_reservation_id          uuid references public.box_reservations(id) on delete set null,
  amount_buyer_ttc            integer not null,         -- centimes
  amount_platform_fee         integer not null,         -- centimes
  amount_seller_ht            integer not null,         -- centimes
  currency                    text not null default 'EUR',
  commission_rate             numeric(5,2) not null,
  commission_amount           integer not null,         -- centimes
  payment_status              text not null default 'pending'
                                check (payment_status in ('pending','succeeded','failed','refunded','cancelled')),
  stripe_checkout_session_id  text,
  stripe_payment_intent_id    text,
  stripe_charge_id            text,
  stripe_transfer_id          text,
  stripe_refund_id            text,
  stripe_metadata             jsonb,
  paid_at                     timestamptz,
  refunded_at                 timestamptz,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

create index if not exists idx_payments_buyer    on public.payments(buyer_id);
create index if not exists idx_payments_seller   on public.payments(seller_id);
create index if not exists idx_payments_session  on public.payments(stripe_checkout_session_id);
create index if not exists idx_payments_status   on public.payments(payment_status);

create trigger trg_payments_updated_at
  before update on public.payments
  for each row execute function public.set_updated_at();

-- ── stripe_webhook_events (idempotence) ─────────────────────────────────────
create table if not exists public.stripe_webhook_events (
  id              uuid primary key default gen_random_uuid(),
  stripe_event_id text not null unique,
  event_type      text not null,
  event_payload   jsonb not null,
  processed       boolean not null default false,
  processed_at    timestamptz,
  error_message   text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_stripe_webhook_events_processed on public.stripe_webhook_events(processed) where processed = false;

create trigger trg_stripe_webhook_events_updated_at
  before update on public.stripe_webhook_events
  for each row execute function public.set_updated_at();

-- ── push_tokens (notifications push Expo) ───────────────────────────────────
create table if not exists public.push_tokens (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  token       text not null unique,
  platform    text not null check (platform in ('ios','android','web')),
  device_id   text,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_push_tokens_user_active on public.push_tokens(user_id) where active = true;

create trigger trg_push_tokens_updated_at
  before update on public.push_tokens
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS — Row Level Security
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.users                  enable row level security;
alter table public.platform_settings      enable row level security;
alter table public.coach_annonces         enable row level security;
alter table public.course_demands         enable row level security;
alter table public.box_annonces           enable row level security;
alter table public.box_reservations       enable row level security;
alter table public.stages                 enable row level security;
alter table public.stage_reservations     enable row level security;
alter table public.payments               enable row level security;
alter table public.stripe_webhook_events  enable row level security;
alter table public.push_tokens            enable row level security;

-- Helper : check si user courant est admin (via public.users)
create or replace function public.is_app_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.users
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ── users ───────────────────────────────────────────────────────────────────
create policy "users_select_authenticated"  on public.users for select to authenticated using (true);
create policy "users_insert_own"            on public.users for insert with check (id = auth.uid());
create policy "users_update_own"            on public.users for update using (id = auth.uid());
create policy "users_admin_all"             on public.users for all using (public.is_app_admin());

-- ── platform_settings ───────────────────────────────────────────────────────
create policy "platform_settings_select_authenticated" on public.platform_settings for select to authenticated using (true);
create policy "platform_settings_admin_all"            on public.platform_settings for all using (public.is_app_admin());

-- ── coach_annonces ──────────────────────────────────────────────────────────
create policy "coach_annonces_select_authenticated" on public.coach_annonces for select to authenticated using (true);
create policy "coach_annonces_insert_own"           on public.coach_annonces for insert with check (auteur_id = auth.uid());
create policy "coach_annonces_update_own"           on public.coach_annonces for update using (auteur_id = auth.uid());
create policy "coach_annonces_delete_own"           on public.coach_annonces for delete using (auteur_id = auth.uid());

-- ── course_demands ──────────────────────────────────────────────────────────
create policy "course_demands_select_parties" on public.course_demands for select using (cavalier_id = auth.uid() or coach_id = auth.uid());
create policy "course_demands_insert_cavalier" on public.course_demands for insert with check (cavalier_id = auth.uid());
create policy "course_demands_update_parties"  on public.course_demands for update using (cavalier_id = auth.uid() or coach_id = auth.uid());

-- ── box_annonces ────────────────────────────────────────────────────────────
create policy "box_annonces_select_authenticated" on public.box_annonces for select to authenticated using (true);
create policy "box_annonces_insert_own"           on public.box_annonces for insert with check (auteur_id = auth.uid());
create policy "box_annonces_update_own"           on public.box_annonces for update using (auteur_id = auth.uid());
create policy "box_annonces_delete_own"           on public.box_annonces for delete using (auteur_id = auth.uid());

-- ── box_reservations ────────────────────────────────────────────────────────
create policy "box_reservations_select_parties" on public.box_reservations for select using (buyer_id = auth.uid() or seller_id = auth.uid());
create policy "box_reservations_insert_buyer"   on public.box_reservations for insert with check (buyer_id = auth.uid());
create policy "box_reservations_update_parties" on public.box_reservations for update using (buyer_id = auth.uid() or seller_id = auth.uid());

-- ── stages ──────────────────────────────────────────────────────────────────
create policy "stages_select_authenticated" on public.stages for select to authenticated using (true);
create policy "stages_insert_own"           on public.stages for insert with check (auteur_id = auth.uid());
create policy "stages_update_own"           on public.stages for update using (auteur_id = auth.uid());
create policy "stages_delete_own"           on public.stages for delete using (auteur_id = auth.uid());

-- ── stage_reservations ──────────────────────────────────────────────────────
create policy "stage_reservations_select_parties" on public.stage_reservations for select using (cavalier_id = auth.uid() or coach_id = auth.uid());
create policy "stage_reservations_insert_cavalier" on public.stage_reservations for insert with check (cavalier_id = auth.uid());
create policy "stage_reservations_update_parties"  on public.stage_reservations for update using (cavalier_id = auth.uid() or coach_id = auth.uid());

-- ── payments ────────────────────────────────────────────────────────────────
-- Lecture parties uniquement. Insert/Update via service_role uniquement (Edge Functions Stripe).
create policy "payments_select_parties" on public.payments for select using (buyer_id = auth.uid() or seller_id = auth.uid());

-- ── stripe_webhook_events ───────────────────────────────────────────────────
-- Aucune policy → seul service_role peut lire/écrire (RLS = deny by default).

-- ── push_tokens ─────────────────────────────────────────────────────────────
create policy "push_tokens_select_own" on public.push_tokens for select using (user_id = auth.uid());
create policy "push_tokens_insert_own" on public.push_tokens for insert with check (user_id = auth.uid());
create policy "push_tokens_update_own" on public.push_tokens for update using (user_id = auth.uid());
create policy "push_tokens_delete_own" on public.push_tokens for delete using (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- Note : pas de trigger auto-create sur public.users.
-- Le code mobile (lib/supabase.ts → signUp) insère manuellement la ligne
-- dans public.users après auth.signUp(). Ajouter un trigger ici créerait un
-- conflit duplicate-key sur l'insert manuel qui suit.
-- ─────────────────────────────────────────────────────────────────────────────
