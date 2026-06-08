-- ═══════════════════════════════════════════════════════════════════════════
-- 061_notify_trajet_complet.sql
-- L3 — Notification IN-APP « trajet complet » au vendeur (auteur de l'annonce).
--
-- Quand une annonce transport de type 'trajet' passe de nb_places_disponibles > 0
-- à <= 0, l'auteur reçoit 1 notification in-app. Le passage à 0 est provoqué par
-- le trigger F1 (mig 060) au moment du paiement de la dernière place.
--
-- Règles :
--   - type_transport = 'trajet' uniquement (location jamais notifiée) ;
--   - franchissement strict old>0 → new<=0 (déjà à 0 ⇒ pas de notif) ;
--   - anti-doublon = la clause WHEN (transition) ; si une place se libère puis
--     l'annonce redevient complète, une nouvelle notif est émise (accepté) ;
--   - in-app uniquement (le push `trg_zz_push_on_message` ne fire que type='message').
--
-- Réutilise : table `notifications` (realtime), `trg_notifications_fill_author`.
-- Périmètre STRICT transport. Stage/Box non touchés. Front non touché.
--
-- Rollback :
--   drop trigger if exists trg_zz_notify_trajet_complet on public.transport_annonces;
--   drop function if exists public.fn_notify_trajet_complet();
--   + restaurer le CHECK type d'origine (sans 'trajet_complet').
-- ═══════════════════════════════════════════════════════════════════════════

-- 1) Étendre le CHECK type pour autoriser 'trajet_complet'.
alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type = any (array[
    'stage_reservation','box_reservation','transport_reservation',
    'course_request','reservation_request','message','like','comment','mention',
    'trajet_complet'
  ]));

-- 2) Fonction : crée la notification pour l'auteur de l'annonce.
create or replace function public.fn_notify_trajet_complet()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Défensif : destinataire_id est NOT NULL → sans auteur, on ne notifie pas.
  if new.auteur_id is null then
    return new;
  end if;

  insert into public.notifications
    (destinataire_id, type, titre, message, action_url, lien, donnees)
  values (
    new.auteur_id,
    'trajet_complet',
    '🚐 Votre trajet est complet',
    format('Toutes les places de votre annonce %s → %s ont été réservées.',
           coalesce(nullif(btrim(new.ville_depart), ''), '?'),
           coalesce(nullif(btrim(new.ville_arrivee), ''), '?')),
    '/services?tab=transport',
    '/services?tab=transport',
    jsonb_build_object('annonce_id', new.id)
  );
  return new;
exception
  when others then
    -- SÉCURITÉ : ce trigger fire dans le chemin de paiement (via le trigger F1
    -- mig 060 qui décrémente les places). Une notif ne doit JAMAIS faire échouer
    -- la mise à jour des places ni le paiement → on avale toute erreur.
    return new;
end;
$$;

-- 3) Trigger : franchissement >0 → <=0 sur un trajet.
drop trigger if exists trg_zz_notify_trajet_complet on public.transport_annonces;
create trigger trg_zz_notify_trajet_complet
  after update of nb_places_disponibles on public.transport_annonces
  for each row
  when (old.nb_places_disponibles > 0
        and new.nb_places_disponibles <= 0
        and new.type_transport = 'trajet')
  execute function public.fn_notify_trajet_complet();
