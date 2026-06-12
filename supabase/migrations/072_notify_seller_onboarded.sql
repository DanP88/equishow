-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 072 — Notification « Compte vendeur validé » (Stripe Connect)
--
-- Lot P0 Notifications. 100 % ADDITIVE. Notifie le vendeur (in-app) au moment où
-- il devient éligible aux paiements : stripe_charges_enabled = true ET
-- stripe_payouts_enabled = true (colonnes users mises à jour par les Edge
-- Functions complete-seller-onboarding / check-seller-status — NON modifiées).
--
-- Ne touche : ni escrow, ni paiements, ni les triggers 056/067/068/069.
-- Canal : in-app uniquement (push/email hors périmètre de ce lot).
--
-- Idempotence : la garde de transition (WHEN) ne fire QUE sur le passage
-- false/null → (true,true). Un UPDATE no-op (les 2 déjà true) ne renotifie pas.
--
-- Application prod : JAMAIS `db push`. Après feu vert :
--   supabase db query -f supabase/migrations/072_notify_seller_onboarded.sql --linked
--   supabase migration repair --status applied 072 --linked
-- Rollback : voir bloc commenté en fin de fichier.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) Type `seller_onboarded` ajouté au CHECK (liste 069 complète + 1, aucun retrait)
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (
  type = any (array[
    'stage_reservation','box_reservation','transport_reservation','course_request',
    'reservation_request','message','like','comment','mention','trajet_complet',
    'support_request','support_ack','support_resolved',
    'escrow_alert',
    'escrow_prestation_done','escrow_release_soon','dispute_resolved',
    'dispute_opened',
    'seller_onboarded'
  ])
);

-- 2) Fonction : notifie le vendeur devenu éligible (best-effort)
create or replace function public.fn_notify_seller_onboarded()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications
    (destinataire_id, type, titre, message, donnees)
  values (
    new.id,
    'seller_onboarded',
    '✅ Compte vendeur validé',
    'Votre compte Stripe est validé : vous pouvez désormais recevoir des paiements pour vos annonces.',
    jsonb_build_object('event', 'seller_onboarded')
  );
  return new;
exception
  when others then
    -- Best-effort : un échec de notif ne doit jamais bloquer l'UPDATE users.
    return new;
end;
$$;

-- 3) Trigger AFTER UPDATE ON users — garde de transition false/null → (true,true)
--    Préfixe trg_zz_ : « fire last » (convention projet, cf. 059/065).
drop trigger if exists trg_zz_notify_seller_onboarded on public.users;
create trigger trg_zz_notify_seller_onboarded
  after update on public.users
  for each row
  when (
        new.stripe_charges_enabled is true
    and new.stripe_payouts_enabled is true
    and (
          coalesce(old.stripe_charges_enabled, false) is not true
       or coalesce(old.stripe_payouts_enabled, false) is not true
    )
  )
  execute function public.fn_notify_seller_onboarded();

-- ─────────────────────────────────────────────────────────────────────────────
-- ROLLBACK (manuel) :
--   drop trigger if exists trg_zz_notify_seller_onboarded on public.users;
--   drop function if exists public.fn_notify_seller_onboarded();
--   -- restaurer le CHECK 069 (sans 'seller_onboarded') :
--   alter table public.notifications drop constraint if exists notifications_type_check;
--   alter table public.notifications add constraint notifications_type_check check (
--     type = any (array[
--       'stage_reservation','box_reservation','transport_reservation','course_request',
--       'reservation_request','message','like','comment','mention','trajet_complet',
--       'support_request','support_ack','support_resolved','escrow_alert',
--       'escrow_prestation_done','escrow_release_soon','dispute_resolved','dispute_opened'
--     ]));
-- ─────────────────────────────────────────────────────────────────────────────
