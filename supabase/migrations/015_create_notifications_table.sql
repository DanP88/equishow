-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 015 — Table `notifications` (système de notifications)
--
-- Avant cette migration, notificationsStore vivait en mémoire dans data/store.ts
-- → 0 persistance entre sessions, 0 cross-user, multi-clients désynchronisés,
--   IDOR sur delete (déjà mitigé côté front en avril 2026 mais source de bugs).
--
-- Cette migration crée la table + RLS mailbox + contraintes anti-abus + trigger
-- auto-fill des champs auteur (snapshot, gabarit P20 avis).
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.notifications (
  id                  uuid primary key default gen_random_uuid(),
  destinataire_id     uuid not null references public.users(id) on delete cascade,
  auteur_id           uuid references public.users(id) on delete set null,
  auteur_nom          text,
  auteur_pseudo       text,
  auteur_initiales    text,
  auteur_couleur      text,
  type                text not null check (type in (
    'stage_reservation','box_reservation','transport_reservation',
    'course_request','reservation_request','message','like','comment','mention'
  )),
  titre               text not null,
  message             text not null,
  status              text check (status in ('pending','accepted','rejected','paid')),
  lu                  boolean not null default false,
  donnees             jsonb not null default '{}'::jsonb,
  action_url          text,
  lien                text,
  created_at          timestamptz not null default now()
);

create index if not exists idx_notifications_destinataire_created
  on public.notifications(destinataire_id, created_at desc);

create index if not exists idx_notifications_unread
  on public.notifications(destinataire_id)
  where lu = false;

alter table public.notifications enable row level security;

-- Mailbox model : on ne voit que ses propres notifs.
create policy "notifications_select_own" on public.notifications
  for select to authenticated using (destinataire_id = auth.uid());

-- INSERT : authentifié, doit signer ses notifs avec auteur_id = auth.uid().
-- Les notifs système (auteur_id null) passent par service_role (Edge functions /
-- webhooks Stripe) qui contourne RLS — donc le check verrouille bien les users.
create policy "notifications_insert_authored" on public.notifications
  for insert to authenticated with check (auteur_id = auth.uid());

-- UPDATE : on ne marque comme lu que ses propres notifs.
create policy "notifications_update_own" on public.notifications
  for update to authenticated
  using (destinataire_id = auth.uid())
  with check (destinataire_id = auth.uid());

-- DELETE : ferme le risque IDOR — on ne supprime que ses propres notifs.
create policy "notifications_delete_own" on public.notifications
  for delete to authenticated using (destinataire_id = auth.uid());

-- ── Auto-fill des champs auteur depuis public.users (snapshot) ──────────────
-- Gabarit avis (mig 013). Si auteur_id null (notif système), on skip.
create or replace function public.fill_notification_author_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prenom    text;
  v_nom       text;
  v_pseudo    text;
  v_initiales text;
  v_couleur   text;
begin
  if new.auteur_id is null then
    return new;
  end if;

  select prenom, nom, pseudo, initiales, avatar_color
    into v_prenom, v_nom, v_pseudo, v_initiales, v_couleur
  from public.users
  where id = new.auteur_id;

  if v_prenom is null and v_nom is null then
    raise exception 'auteur_id % introuvable dans public.users', new.auteur_id;
  end if;

  new.auteur_nom       := coalesce(new.auteur_nom,
                                   trim(coalesce(v_prenom, '') || ' ' || coalesce(v_nom, '')));
  new.auteur_pseudo    := coalesce(new.auteur_pseudo, v_pseudo);
  new.auteur_initiales := coalesce(new.auteur_initiales, v_initiales);
  new.auteur_couleur   := coalesce(new.auteur_couleur, v_couleur);
  return new;
end;
$$;

drop trigger if exists trg_notifications_fill_author on public.notifications;
create trigger trg_notifications_fill_author
  before insert on public.notifications
  for each row execute function public.fill_notification_author_fields();
