-- ============================================================================
-- 118 — MEILLEURS TEXTES POUR LES NOTIFICATIONS RECHERCHES OUVERTES (117)
-- ============================================================================
-- Retour direct de Dan après premier test réel (2026-09-22) : les notifs de
-- 117 fonctionnaient ("tout le process marche") mais le texte était trop
-- générique ("Nouvelle réponse à ta recherche de box") — il veut le contexte
-- concret (lieu + dates) directement dans le message, ton plus naturel.
--
-- `create or replace function` UNIQUEMENT — mêmes 4 fonctions, mêmes
-- triggers, mêmes signatures, même logique de destinataire/dédup/best-effort.
-- Rien de nouveau créé, aucune colonne/table touchée. Dates formatées en
-- DD/MM (pas de nom de mois localisé — dépendant de la locale serveur,
-- fragile). Transport : pas de dates par réservation (le modèle n'en a pas,
-- contrairement à Box) — lieu de destination uniquement, même ton amélioré.
--
-- Rollback : supabase/rollbacks/118_recherche_notif_wording_rollback.sql
-- Application prod : supabase db query -f <file> --linked
--   puis supabase migration repair --status applied 118 --linked. JAMAIS db push.
-- ============================================================================

begin;

-- ── BOX — réponse reçue (+ dates, absentes de la version 117) ──────────────
create or replace function public.fn_notify_box_reponse_recue()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_demandeur_id uuid;
  v_lieu text;
  v_date_debut date;
  v_date_fin date;
  v_periode text;
begin
  select demandeur_id, date_debut, date_fin into v_demandeur_id, v_date_debut, v_date_fin
    from public.box_recherches where id = new.recherche_id;
  if v_demandeur_id is null or v_demandeur_id = new.offreur_id then
    return new;
  end if;
  select lieu into v_lieu from public.box_annonces where id = new.annonce_id;

  v_periode := case when v_date_debut is not null and v_date_fin is not null
    then ' du ' || to_char(v_date_debut, 'DD/MM') || ' au ' || to_char(v_date_fin, 'DD/MM')
    else '' end;

  begin
    insert into public.notifications
      (destinataire_id, auteur_id, type, titre, message, action_url, lien, donnees)
    values
      (v_demandeur_id, new.offreur_id, 'box_reponse_recue',
       '🏠 Nouvelle réponse à ta recherche de box',
       format('Tu as reçu une réponse pour ta demande de box%s%s !',
              case when v_lieu is not null then ' à ' || v_lieu else '' end, v_periode),
       '/box/mes-box', '/box/mes-box',
       jsonb_build_object('recherche_id', new.recherche_id, 'reponse_id', new.id))
    on conflict ((donnees->>'reponse_id'), destinataire_id)
      where type = 'box_reponse_recue' do nothing;
  exception when others then null;
  end;

  return new;
exception when others then return new;
end;
$$;

-- ── BOX — acceptée / payée / annulée (lieu + dates déjà sur box_reservations) ──
create or replace function public.fn_notify_box_reservation_events()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_offreur_id uuid;
  v_other uuid;
  v_periode text;
begin
  if new.recherche_id is null then
    return new;
  end if;

  v_periode := case when new.date_debut is not null and new.date_fin is not null
    then ' du ' || to_char(new.date_debut, 'DD/MM') || ' au ' || to_char(new.date_fin, 'DD/MM')
    else '' end;

  if new.status = 'accepted' and old.status is distinct from 'accepted' then
    if new.recherche_reponse_id is not null then
      select offreur_id into v_offreur_id
        from public.box_recherche_reponses where id = new.recherche_reponse_id;
      if v_offreur_id is not null and v_offreur_id <> new.buyer_id then
        begin
          insert into public.notifications
            (destinataire_id, auteur_id, type, titre, message, action_url, lien, donnees)
          values
            (v_offreur_id, new.buyer_id, 'box_reponse_acceptee',
             '✅ Ta proposition a été acceptée !',
             format('Ta proposition de box%s%s a été acceptée. Retrouve les détails dans Mes box.',
                    case when new.lieu is not null then ' à ' || new.lieu else '' end, v_periode),
             '/box/mes-box', '/box/mes-box',
             jsonb_build_object('reservation_id', new.id, 'recherche_id', new.recherche_id))
          on conflict ((donnees->>'reservation_id'), destinataire_id)
            where type = 'box_reponse_acceptee' do nothing;
        exception when others then null;
        end;
      end if;
    end if;
  end if;

  if new.status = 'paid' and old.status is distinct from 'paid' then
    if new.seller_id is not null and new.seller_id <> new.buyer_id then
      begin
        insert into public.notifications
          (destinataire_id, auteur_id, type, titre, message, action_url, lien, donnees)
        values
          (new.seller_id, new.buyer_id, 'box_paiement_recu',
           '💶 Paiement reçu !',
           format('Le paiement de ta réservation box%s%s a été confirmé.',
                  case when new.lieu is not null then ' à ' || new.lieu else '' end, v_periode),
           '/box/mes-box', '/box/mes-box',
           jsonb_build_object('reservation_id', new.id, 'recherche_id', new.recherche_id))
        on conflict ((donnees->>'reservation_id'), destinataire_id)
          where type = 'box_paiement_recu' do nothing;
      exception when others then null;
      end;
    end if;
  end if;

  if new.status = 'cancelled' and old.status = 'accepted' then
    v_other := case when new.cancelled_by = new.buyer_id then new.seller_id else new.buyer_id end;
    if v_other is not null and new.cancelled_by is not null and v_other <> new.cancelled_by then
      begin
        insert into public.notifications
          (destinataire_id, auteur_id, type, titre, message, action_url, lien, donnees)
        values
          (v_other, new.cancelled_by, 'box_annulation',
           '❌ Réservation annulée',
           format('La réservation de box%s%s a été annulée%s.',
                  case when new.lieu is not null then ' à ' || new.lieu else '' end, v_periode,
                  case when new.cancellation_reason is not null
                       then ' (' || new.cancellation_reason || ')' else '' end),
           '/box/mes-box', '/box/mes-box',
           jsonb_build_object('reservation_id', new.id, 'recherche_id', new.recherche_id))
        on conflict ((donnees->>'reservation_id'), destinataire_id)
          where type = 'box_annulation' do nothing;
      exception when others then null;
      end;
    end if;
  end if;

  return new;
exception when others then
  return new;
end;
$$;

-- ── TRANSPORT — réponse reçue (ton amélioré, pas de dates : modèle sans date) ──
create or replace function public.fn_notify_transport_reponse_recue()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_demandeur_id uuid;
  v_dest text;
begin
  select demandeur_id into v_demandeur_id from public.transport_recherches where id = new.recherche_id;
  if v_demandeur_id is null or v_demandeur_id = new.offreur_id then
    return new;
  end if;
  select ville_arrivee into v_dest from public.transport_annonces where id = new.annonce_id;

  begin
    insert into public.notifications
      (destinataire_id, auteur_id, type, titre, message, action_url, lien, donnees)
    values
      (v_demandeur_id, new.offreur_id, 'transport_reponse_recue',
       '🚚 Nouvelle réponse à ta recherche de transport',
       format('Tu as reçu une réponse pour ta demande de transport%s !',
              case when v_dest is not null then ' vers ' || v_dest else '' end),
       '/transport/mes-transports', '/transport/mes-transports',
       jsonb_build_object('recherche_id', new.recherche_id, 'reponse_id', new.id))
    on conflict ((donnees->>'reponse_id'), destinataire_id)
      where type = 'transport_reponse_recue' do nothing;
  exception when others then null;
  end;

  return new;
exception when others then return new;
end;
$$;

-- ── TRANSPORT — acceptée / payée / annulée (ton amélioré) ──────────────────
create or replace function public.fn_notify_transport_reservation_events()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_offreur_id uuid;
  v_other uuid;
begin
  if new.recherche_id is null then
    return new;
  end if;

  if new.statut = 'accepted' and old.statut is distinct from 'accepted' then
    if new.recherche_reponse_id is not null then
      select offreur_id into v_offreur_id
        from public.transport_recherche_reponses where id = new.recherche_reponse_id;
      if v_offreur_id is not null and v_offreur_id <> new.buyer_id then
        begin
          insert into public.notifications
            (destinataire_id, auteur_id, type, titre, message, action_url, lien, donnees)
          values
            (v_offreur_id, new.buyer_id, 'transport_reponse_acceptee',
             '✅ Ta proposition a été acceptée !',
             format('Ta proposition de transport%s a été acceptée. Retrouve les détails dans Mes transports.',
                    case when new.ville_arrivee is not null then ' vers ' || new.ville_arrivee else '' end),
             '/transport/mes-transports', '/transport/mes-transports',
             jsonb_build_object('reservation_id', new.id, 'recherche_id', new.recherche_id))
          on conflict ((donnees->>'reservation_id'), destinataire_id)
            where type = 'transport_reponse_acceptee' do nothing;
        exception when others then null;
        end;
      end if;
    end if;
  end if;

  if new.statut = 'paid' and old.statut is distinct from 'paid' then
    if new.seller_id is not null and new.seller_id <> new.buyer_id then
      begin
        insert into public.notifications
          (destinataire_id, auteur_id, type, titre, message, action_url, lien, donnees)
        values
          (new.seller_id, new.buyer_id, 'transport_paiement_recu',
           '💶 Paiement reçu !',
           format('Le paiement de ta réservation transport%s a été confirmé.',
                  case when new.ville_arrivee is not null then ' vers ' || new.ville_arrivee else '' end),
           '/transport/mes-transports', '/transport/mes-transports',
           jsonb_build_object('reservation_id', new.id, 'recherche_id', new.recherche_id))
        on conflict ((donnees->>'reservation_id'), destinataire_id)
          where type = 'transport_paiement_recu' do nothing;
      exception when others then null;
      end;
    end if;
  end if;

  if new.statut = 'cancelled' and old.statut = 'accepted' then
    v_other := case when new.cancelled_by = new.buyer_id then new.seller_id else new.buyer_id end;
    if v_other is not null and new.cancelled_by is not null and v_other <> new.cancelled_by then
      begin
        insert into public.notifications
          (destinataire_id, auteur_id, type, titre, message, action_url, lien, donnees)
        values
          (v_other, new.cancelled_by, 'transport_annulation',
           '❌ Réservation annulée',
           format('La réservation de transport%s a été annulée%s.',
                  case when new.ville_arrivee is not null then ' vers ' || new.ville_arrivee else '' end,
                  case when new.cancellation_reason is not null
                       then ' (' || new.cancellation_reason || ')' else '' end),
           '/transport/mes-transports', '/transport/mes-transports',
           jsonb_build_object('reservation_id', new.id, 'recherche_id', new.recherche_id))
        on conflict ((donnees->>'reservation_id'), destinataire_id)
          where type = 'transport_annulation' do nothing;
      exception when others then null;
      end;
    end if;
  end if;

  return new;
exception when others then
  return new;
end;
$$;

commit;
