-- ============================================================================
-- ROLLBACK 118 — RETOUR AUX TEXTES DE NOTIFICATION DE LA MIGRATION 117
-- ============================================================================
-- 118 n'a fait que `create or replace function` sur les 4 fonctions déjà
-- créées par 117 (mêmes signatures, mêmes triggers). Ce rollback réapplique
-- simplement les corps de fonction tels qu'ils étaient dans 117 — aucune
-- colonne/table/trigger à toucher, rien à purger.
--
-- Application manuelle si besoin :
--   supabase db query -f supabase/rollbacks/118_recherche_notif_wording_rollback.sql --linked
-- (jamais via `migration repair` — ce fichier n'est pas une migration).
-- ============================================================================

begin;

create or replace function public.fn_notify_box_reponse_recue()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_demandeur_id uuid;
  v_lieu text;
begin
  select demandeur_id into v_demandeur_id from public.box_recherches where id = new.recherche_id;
  if v_demandeur_id is null or v_demandeur_id = new.offreur_id then
    return new;
  end if;
  select lieu into v_lieu from public.box_annonces where id = new.annonce_id;

  begin
    insert into public.notifications
      (destinataire_id, auteur_id, type, titre, message, action_url, lien, donnees)
    values
      (v_demandeur_id, new.offreur_id, 'box_reponse_recue',
       '🏠 Nouvelle réponse à ta recherche de box',
       format('Une réponse est arrivée pour ta recherche de box%s',
              case when v_lieu is not null then ' — ' || v_lieu else '' end),
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

create or replace function public.fn_notify_box_reservation_events()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_offreur_id uuid;
  v_other uuid;
begin
  if new.recherche_id is null then
    return new;
  end if;

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
             '✅ Ta réponse a été acceptée',
             format('Ta proposition de box a été acceptée%s',
                    case when new.lieu is not null then ' — ' || new.lieu else '' end),
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
           '💶 Paiement reçu',
           format('Le paiement de ta réservation box%s a été confirmé',
                  case when new.lieu is not null then ' — ' || new.lieu else '' end),
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
           format('Une réservation box%s a été annulée%s',
                  case when new.lieu is not null then ' — ' || new.lieu else '' end,
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
       format('Une réponse est arrivée pour ta recherche de transport%s',
              case when v_dest is not null then ' — vers ' || v_dest else '' end),
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
             '✅ Ta réponse a été acceptée',
             format('Ta proposition de transport a été acceptée%s',
                    case when new.ville_arrivee is not null then ' — vers ' || new.ville_arrivee else '' end),
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
           '💶 Paiement reçu',
           format('Le paiement de ta réservation transport%s a été confirmé',
                  case when new.ville_arrivee is not null then ' — vers ' || new.ville_arrivee else '' end),
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
           format('Une réservation transport%s a été annulée%s',
                  case when new.ville_arrivee is not null then ' — vers ' || new.ville_arrivee else '' end,
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
