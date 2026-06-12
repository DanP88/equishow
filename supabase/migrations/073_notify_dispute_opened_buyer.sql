-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 073 — Notification « Litige ouvert » à l'ACHETEUR
--
-- Lot P0 Notifications. 100 % ADDITIVE. Complète 069 (qui notifie admins +
-- vendeur à l'ouverture d'un litige) en notifiant aussi l'ACHETEUR — mais
-- UNIQUEMENT si le litige n'a pas été ouvert par lui-même (source <> 'buyer'),
-- pour ne pas le notifier de sa propre action (chargeback Stripe / ouverture
-- admin).
--
-- Sources réelles de payment_disputes (CHECK mig 041) : 'buyer' | 'admin' |
-- 'stripe'. Donc source <> 'buyer' = {admin, stripe(chargeback)}.
--
-- TRIGGER SÉPARÉ et additif : ne modifie NI fn_notify_dispute_opened NI le
-- trigger trg_dispute_opened_notify de 069 (admins+vendeur intacts). N'altère
-- ni escrow ni paiements. Type 'dispute_opened' déjà autorisé (069) → aucun
-- changement de contrainte. Canal in-app uniquement.
--
-- Application prod : JAMAIS `db push`. Après feu vert :
--   supabase db query -f supabase/migrations/073_notify_dispute_opened_buyer.sql --linked
--   supabase migration repair --status applied 073 --linked
-- Rollback : voir bloc commenté en fin de fichier.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.fn_notify_dispute_opened_buyer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_buyer uuid;
begin
  -- L'acheteur qui ouvre lui-même le litige connaît déjà → on ne le notifie pas.
  if new.source = 'buyer' then
    return new;
  end if;

  select buyer_id into v_buyer from public.payments where id = new.payment_id;

  if v_buyer is not null then
    insert into public.notifications
      (destinataire_id, type, titre, message, donnees)
    values (
      v_buyer,
      'dispute_opened',
      '⚠️ Litige ouvert sur votre paiement',
      'Un litige a été ouvert concernant votre paiement. Notre équipe traite votre dossier ; vous serez tenu informé.',
      jsonb_build_object('event', 'dispute_opened', 'paymentId', new.payment_id,
                         'disputeId', new.id, 'source', new.source)
    );
  end if;

  return new;
exception
  when others then
    -- Best-effort : ne bloque jamais l'ouverture du litige.
    return new;
end;
$$;

-- Trigger SÉPARÉ (n'écrase pas trg_dispute_opened_notify de 069).
drop trigger if exists trg_dispute_opened_notify_buyer on public.payment_disputes;
create trigger trg_dispute_opened_notify_buyer
  after insert on public.payment_disputes
  for each row execute function public.fn_notify_dispute_opened_buyer();

-- ─────────────────────────────────────────────────────────────────────────────
-- ROLLBACK (manuel) :
--   drop trigger if exists trg_dispute_opened_notify_buyer on public.payment_disputes;
--   drop function if exists public.fn_notify_dispute_opened_buyer();
-- ─────────────────────────────────────────────────────────────────────────────
