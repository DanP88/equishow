-- ═══════════════════════════════════════════════════════════════════════════
-- 065_support_requests.sql — Réclamations / support marketplace (P0 in-app)
--
-- Transforme le formulaire EQ-REC (jusque-là placebo : aucun stockage) en vraie
-- fonctionnalité : table persistée + ref serveur unique + RLS user/admin +
-- notifications in-app (fan-out admin à la création, accusé user, notif user à
-- la résolution).
--
-- 100% ADDITIVE :
--   - nouvelle table public.support_requests (n'impacte aucune table existante) ;
--   - notifications_type_check ÉLARGI (ajout de 3 valeurs, aucun retrait) ;
--   - triggers de notification best-effort (exception → ne bloque JAMAIS le ticket).
--
-- Hors périmètre (volontaire) : aucun email, aucun push, aucun Stripe, aucune
-- réservation, aucune messagerie. Le push se branchera plus tard via le trigger
-- générique 059 (whitelist) sans toucher ce fichier.
--
-- Application prod (règle projet) : JAMAIS `db push`. Appliquer par
--   supabase db query --linked -f supabase/migrations/065_support_requests.sql
--   supabase migration repair --status applied 065 --linked
--
-- Rollback : voir bloc en fin de fichier (commenté).
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) Table
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.support_requests (
  id                 uuid primary key default gen_random_uuid(),
  ref                text not null unique,                 -- EQ-REC-XXXXXXXX (serveur)
  user_id            uuid not null references public.users(id) on delete cascade,
  reservation_ref    text,                                 -- ex 'EQ-BOX-AB12CD34' (nullable, texte libre)
  reservation_type   text check (reservation_type in
                       ('transport','box','coaching','stage','autre')),
  related_payment_id uuid references public.payments(id) on delete set null,  -- optionnel
  category           text not null default 'autre' check (category in
                       ('paiement','remboursement','prestation','transport',
                        'box','coaching','stage','compte','autre')),
  subject            text not null,
  description        text not null,
  status             text not null default 'open' check (status in
                       ('open','in_progress','resolved','closed')),
  assigned_admin     uuid references public.users(id) on delete set null,
  resolution_message text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  resolved_at        timestamptz
);

comment on table public.support_requests is
  'Réclamations / tickets support (EQ-REC). User crée + lit les siens ; admin gère tout.';

create index if not exists idx_support_requests_user
  on public.support_requests(user_id, created_at desc);
create index if not exists idx_support_requests_open
  on public.support_requests(status) where status in ('open','in_progress');

-- updated_at auto (réutilise public.set_updated_at, défini mig 001).
drop trigger if exists trg_support_updated_at on public.support_requests;
create trigger trg_support_updated_at
  before update on public.support_requests
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) Référence serveur EQ-REC-<8 hex maj>, garantie unique (anti-collision)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.fn_support_set_ref()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ref text;
  v_try int := 0;
begin
  -- Toujours autoritatif côté serveur : on ignore toute valeur fournie au client.
  loop
    v_ref := 'EQ-REC-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    exit when not exists (select 1 from public.support_requests where ref = v_ref);
    v_try := v_try + 1;
    exit when v_try > 8;  -- garde-fou : 8 hex = collision quasi nulle
  end loop;
  new.ref := v_ref;
  return new;
end;
$$;

drop trigger if exists trg_support_set_ref on public.support_requests;
create trigger trg_support_set_ref
  before insert on public.support_requests
  for each row execute function public.fn_support_set_ref();

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) RLS — user voit/crée les siens ; admin gère tout
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.support_requests enable row level security;

drop policy if exists "support_insert_own" on public.support_requests;
create policy "support_insert_own" on public.support_requests
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "support_select_own" on public.support_requests;
create policy "support_select_own" on public.support_requests
  for select to authenticated
  using (user_id = auth.uid());

-- Admin : lecture + update statut/résolution/assignation (et tout le reste).
drop policy if exists "support_admin_all" on public.support_requests;
create policy "support_admin_all" on public.support_requests
  for all
  using (public.is_app_admin())
  with check (public.is_app_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- 4) notifications_type_check — ÉLARGI (+3 types support). Aucun retrait.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type = any (array[
    'stage_reservation','box_reservation','transport_reservation',
    'course_request','reservation_request','message','like','comment','mention',
    'trajet_complet',
    'support_request','support_ack','support_resolved'
  ]));

-- ─────────────────────────────────────────────────────────────────────────────
-- 5) Trigger création : fan-out admins + accusé réception user (best-effort)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.fn_support_notify_create()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- (a) Un notif par admin (le fan-out boucle sur users.role='admin').
  insert into public.notifications
    (destinataire_id, type, titre, message, action_url, lien, donnees)
  select
    u.id,
    'support_request',
    '📩 Nouvelle réclamation ' || new.ref,
    coalesce(nullif(btrim(new.subject), ''), '(sans objet)'),
    '/admin-support',
    '/admin-support',
    jsonb_build_object('support_id', new.id, 'ref', new.ref, 'category', new.category)
  from public.users u
  where u.role = 'admin';

  -- (b) Accusé réception pour l'auteur du ticket.
  insert into public.notifications
    (destinataire_id, type, titre, message, action_url, lien, donnees)
  values (
    new.user_id,
    'support_ack',
    '✓ Réclamation ' || new.ref || ' reçue',
    'Votre réclamation a bien été enregistrée. Notre équipe la traitera au plus vite.',
    '/support',
    '/support',
    jsonb_build_object('support_id', new.id, 'ref', new.ref)
  );

  return new;
exception
  when others then
    -- Best-effort : un échec de notification ne doit JAMAIS empêcher le ticket.
    return new;
end;
$$;

drop trigger if exists trg_zz_support_notify_create on public.support_requests;
create trigger trg_zz_support_notify_create
  after insert on public.support_requests
  for each row execute function public.fn_support_notify_create();

-- ─────────────────────────────────────────────────────────────────────────────
-- 6) Trigger résolution : notif user quand status → resolved (best-effort)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.fn_support_notify_resolution()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Ne fire qu'à l'entrée réelle dans 'resolved'.
  if new.status = 'resolved' and coalesce(old.status, '') is distinct from 'resolved' then
    -- Horodatage de résolution (si pas déjà posé par l'app).
    if new.resolved_at is null then
      new.resolved_at := now();
    end if;
  end if;
  return new;
end;
$$;

-- BEFORE UPDATE : pose resolved_at proprement avant l'écriture.
drop trigger if exists trg_support_set_resolved_at on public.support_requests;
create trigger trg_support_set_resolved_at
  before update on public.support_requests
  for each row execute function public.fn_support_notify_resolution();

-- AFTER UPDATE : crée la notification user (best-effort, séparé pour ne pas
-- bloquer l'UPDATE si l'insert notif échoue).
create or replace function public.fn_support_notify_resolution_after()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'resolved' and coalesce(old.status, '') is distinct from 'resolved' then
    insert into public.notifications
      (destinataire_id, type, titre, message, action_url, lien, donnees)
    values (
      new.user_id,
      'support_resolved',
      '✅ Réclamation ' || new.ref || ' traitée',
      coalesce(nullif(btrim(new.resolution_message), ''),
               'Votre réclamation a été traitée par notre équipe.'),
      '/support',
      '/support',
      jsonb_build_object('support_id', new.id, 'ref', new.ref)
    );
  end if;
  return new;
exception
  when others then
    return new;  -- best-effort
end;
$$;

drop trigger if exists trg_zz_support_notify_resolution on public.support_requests;
create trigger trg_zz_support_notify_resolution
  after update on public.support_requests
  for each row execute function public.fn_support_notify_resolution_after();

-- ═══════════════════════════════════════════════════════════════════════════
-- ROLLBACK (référence — ne PAS exécuter en application normale) :
--   drop trigger if exists trg_zz_support_notify_resolution on public.support_requests;
--   drop trigger if exists trg_support_set_resolved_at on public.support_requests;
--   drop trigger if exists trg_zz_support_notify_create on public.support_requests;
--   drop trigger if exists trg_support_set_ref on public.support_requests;
--   drop trigger if exists trg_support_updated_at on public.support_requests;
--   drop function if exists public.fn_support_notify_resolution_after();
--   drop function if exists public.fn_support_notify_resolution();
--   drop function if exists public.fn_support_notify_create();
--   drop function if exists public.fn_support_set_ref();
--   drop table if exists public.support_requests;
--   -- puis restaurer notifications_type_check sans les 3 types support.
-- ═══════════════════════════════════════════════════════════════════════════
