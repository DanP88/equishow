-- ============================================================================
-- 113 — ANNULATION D'UNE RÉSERVATION TRANSPORT ISSUE D'UNE RECHERCHE OUVERTE
--       (LOT 7, suite migration 111/112)
-- ============================================================================
-- Diagnostic (session précédente, lecture seule, aucun changement) :
-- `trg_guard_statut_transition` (mig 047, incident P0 fraude) empêche TOUT
-- compte authentifié — y compris le buyer/seller légitime — de transitionner
-- `statut` vers paid/cancelled/completed/expired/payment_expired. Seul
-- `service_role`/connexion directe/admin (`fn_can_bypass_reservation_guard`)
-- lève ce blocage. Conséquence : aucune réservation issue de la migration 111
-- ne pouvait être légitimement annulée par un cavalier ou un transporteur —
-- trou découvert lors des tests des Lots 5/6 (nettoyage de test contourné par
-- une suppression physique + restauration manuelle, jamais une solution
-- métier).
--
-- `trg_guard_statut_transition`/`fn_can_bypass_reservation_guard` sont une
-- infrastructure PARTAGÉE (même fonction réutilisée par `trg_guard_status_
-- transition` sur box_reservations/stage_reservations/course_demands) —
-- **ni l'un ni l'autre n'est modifié ici**. Le contournement légitime passe
-- par le mécanisme standard Postgres SECURITY DEFINER : pendant l'exécution
-- d'une fonction SECURITY DEFINER dont le propriétaire n'est ni
-- `authenticated` ni `anon` ni `authenticator` (ici `postgres`, comme
-- `accept_transport_recherche_response`), `current_user` devient
-- temporairement ce propriétaire → `fn_can_bypass_reservation_guard()`
-- renvoie true via sa condition n°2, SANS aucune modification du guard.
-- Preuve déjà apportée empiriquement : `accept_transport_recherche_response`
-- (même schéma) écrit déjà avec succès dans des tables protégées par RLS en
-- tant qu'utilisateur authenticated (Lots 5/6, testé réel).
--
-- Décisions produit (validées par Dan avant ce fichier) :
--   - Buyer OU seller de la réservation peuvent l'annuler (symétrique).
--   - Périmètre STRICT : statut = 'accepted' uniquement. awaiting_payment/
--     paid/completed explicitement HORS PÉRIMÈTRE (aucune session Stripe
--     créée à 'accepted' ; awaiting_payment/paid impliquent de l'argent
--     déjà engagé côté Stripe → lot dédié quand le paiement du parcours
--     recherches sera branché, ou flux refund/dispute existant si déjà payé).
--   - Traçabilité : cancelled_by/cancelled_at/cancellation_reason (additif,
--     nullable) plutôt qu'un DELETE physique — historique préservé.
--   - Notification à l'autre partie : REPORTÉE à un lot suivant (cf. rapport
--     de session) — aucun type/status de `notifications` existant ne
--     correspond proprement à « réservation annulée » sans soit réutiliser
--     'rejected' (dérive sémantique sur du code V1 partagé) soit élargir le
--     CHECK de la table `notifications` (infrastructure V1 partagée,
--     hors scope de ce lot).
--
-- Impact : transport_reservations UNIQUEMENT (2 ALTER additifs + 1 fonction).
-- Aucune table V1 modifiée en profondeur, aucun trigger existant modifié,
-- 0 impact Box/Coach/Stage. La cascade capacité/couverture/statut recherche
-- est entièrement déléguée aux triggers déjà audités et déjà en prod :
--   - fn_availability_transport (BEFORE UPDATE OF statut) restitue
--     nb_places_disponibles quand statut sort de l'ensemble consommant.
--   - fn_recompute_transport_recherche_status / trg_zz_sync_transport_
--     recherche_on_reservation (111) rouvre automatiquement la recherche si
--     un cheval redevient non couvert.
-- Rien de tout cela n'est dupliqué ici.
--
-- Rollback : supabase/rollbacks/113_cancel_transport_recherche_reservation_rollback.sql
-- Application prod : supabase db query -f <file> --linked
--   puis supabase migration repair --status applied 113. JAMAIS db push.
-- ============================================================================

begin;

-- ── 0. Précondition ─────────────────────────────────────────────────────────
do $$
begin
  if to_regclass('public.transport_reservations') is null then
    raise exception '113 requiert public.transport_reservations (mig 004).';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'transport_reservations' and column_name = 'recherche_id'
  ) then
    raise exception '113 requiert 111 : colonne transport_reservations.recherche_id absente.';
  end if;
end $$;

-- ── 1. Traçabilité additive (nullable, jamais renseignée hors annulation) ──
-- cancelled_by en ON DELETE SET NULL (comme cheval_id/recherche_id/
-- recherche_reponse_id, 111) et PAS en CASCADE (comme buyer_id/seller_id) :
-- si le compte de l'annulant est supprimé plus tard, la réservation et son
-- historique doivent survivre — seule la référence à l'annulant s'efface.
alter table public.transport_reservations
  add column if not exists cancelled_by uuid references public.users(id) on delete set null;
alter table public.transport_reservations
  add column if not exists cancelled_at timestamptz;
alter table public.transport_reservations
  add column if not exists cancellation_reason text;

comment on column public.transport_reservations.cancelled_by is
  '113 (Lot 7) — buyer ou seller ayant annulé via cancel_transport_recherche_reservation. NULL hors annulation.';
comment on column public.transport_reservations.cancelled_at is
  '113 (Lot 7) — horodatage de l''annulation. NULL hors annulation.';
comment on column public.transport_reservations.cancellation_reason is
  '113 (Lot 7) — raison libre optionnelle saisie par l''annulant. NULL si non renseignée.';

-- ── 2. RPC — annulation, SECURITY DEFINER, périmètre strict ────────────────
-- Ne modifie NI trg_guard_statut_transition NI fn_can_bypass_reservation_guard
-- (cf. en-tête). Ne recalcule NI capacité NI couverture NI statut recherche :
-- délègue entièrement aux triggers déjà en place (fn_availability_transport,
-- fn_recompute_transport_recherche_status via trg_zz_sync_transport_
-- recherche_on_reservation, tous deux déclenchés par le seul UPDATE OF statut
-- ci-dessous).
create or replace function public.cancel_transport_recherche_reservation(
  p_reservation_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_resa public.transport_reservations%rowtype;
begin
  if auth.uid() is null then
    raise exception 'cancel_transport_recherche_reservation: authentification requise';
  end if;

  select * into v_resa from public.transport_reservations where id = p_reservation_id for update;
  if not found then
    raise exception 'réservation introuvable (%)', p_reservation_id;
  end if;

  -- Périmètre strict : uniquement les réservations issues d'une recherche
  -- ouverte (111). Une réservation V1 directe (recherche_id null) est HORS
  -- PÉRIMÈTRE de cette fonction — garantie structurelle de non-impact V1.
  if v_resa.recherche_id is null then
    raise exception 'réservation hors périmètre : ne provient pas d''une recherche ouverte (recherche_id null)';
  end if;

  if auth.uid() <> v_resa.buyer_id and auth.uid() <> v_resa.seller_id then
    raise exception 'seul le cavalier (buyer) ou le transporteur (seller) de cette réservation peut l''annuler';
  end if;

  -- Périmètre strict : uniquement 'accepted' (pré-paiement). awaiting_payment/
  -- paid/completed sont explicitement hors périmètre (cf. en-tête) — message
  -- d'erreur volontairement explicite pour orienter vers le bon flux.
  if v_resa.statut is distinct from 'accepted' then
    raise exception 'annulation non permise depuis le statut "%" via cette fonction — seul "accepted" est couvert (lot dédié à venir pour awaiting_payment/paid/completed)',
      coalesce(v_resa.statut, '<null>');
  end if;

  update public.transport_reservations
    set statut = 'cancelled',
        cancelled_by = auth.uid(),
        cancelled_at = now(),
        cancellation_reason = p_reason
  where id = p_reservation_id;
end;
$fn$;

comment on function public.cancel_transport_recherche_reservation(uuid, text) is
  '113 (Lot 7) — annulation d''une réservation transport issue d''une recherche '
  'ouverte (111), limitée au statut ''accepted''. Buyer ou seller de la '
  'réservation uniquement. Contourne trg_guard_statut_transition via le '
  'mécanisme standard SECURITY DEFINER (current_user = propriétaire de la '
  'fonction pendant son exécution) — AUCUNE modification du guard ni de '
  'fn_can_bypass_reservation_guard. Capacité (fn_availability_transport), '
  'couverture et statut de la recherche (fn_recompute_transport_recherche_'
  'status, 111) recalculés automatiquement par les triggers existants sur '
  'UPDATE OF statut — aucune logique dupliquée ici. awaiting_payment/paid/'
  'completed hors périmètre : lot dédié (paiement du parcours recherches) '
  'ou flux refund/dispute existant si déjà payé.';

grant execute on function public.cancel_transport_recherche_reservation(uuid, text) to authenticated;

commit;
