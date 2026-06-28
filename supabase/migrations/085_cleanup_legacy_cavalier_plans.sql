-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 085 — Nettoyage des plans cavalier LEGACY
--
-- ⚠️ NON APPLIQUÉE EN PROD à ce stade. Livrée dans la PR #63, à appliquer
--    seulement après validation (db query -f --linked + migration repair,
--    JAMAIS db push). Testée d'abord en rollback sur cluster jetable.
--
-- Contexte : la suppression de l'abonnement cavalier (#63) a retiré les offres
-- Cavalier+/Premium/Famille, mais les comptes existants gardent ces valeurs dans
-- users.plan / users.plan_id (« Cavalier+ », « Premium »…). On les ramène au plan
-- gratuit/neutre pour que plus aucune notion de plan cavalier ne subsiste.
--
-- Périmètre STRICT :
--   • UNIQUEMENT role = 'cavalier'  → coach & organisateur NON impactés
--   • UNIQUEMENT les valeurs legacy connues (liste explicite)
--   • Réversible : snapshot dans _backup_users_plan_085 avant l'UPDATE
--   • Idempotent : re-jouable sans effet de bord
--   • Aucun impact escrow / réservation / paiement. Le trigger trg_subscription_paid
--     (032) ne s'active PAS (on passe VERS gratuit → fn_is_paid_plan = false).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Snapshot (réversibilité) ─────────────────────────────────────────────
create table if not exists public._backup_users_plan_085 (
  user_id      uuid primary key references public.users(id) on delete cascade,
  old_plan     text,
  old_plan_id  text,
  backed_up_at timestamptz not null default now()
);

insert into public._backup_users_plan_085 (user_id, old_plan, old_plan_id)
select id, plan, plan_id
from public.users
where role = 'cavalier'
  and (
    lower(coalesce(plan_id, '')) in
      ('cavalier-plus', 'cavalier-premium', 'cavalier-famille', 'cavalier-decouverte')
    or lower(coalesce(plan, '')) in
      ('cavalier+', 'premium', 'famille', 'découverte', 'decouverte')
  )
on conflict (user_id) do nothing;

-- ── 2. Normalisation vers le plan gratuit/neutre ────────────────────────────
update public.users
set plan = 'Gratuit', plan_id = 'gratuit', updated_at = now()
where role = 'cavalier'
  and (
    lower(coalesce(plan_id, '')) in
      ('cavalier-plus', 'cavalier-premium', 'cavalier-famille', 'cavalier-decouverte')
    or lower(coalesce(plan, '')) in
      ('cavalier+', 'premium', 'famille', 'découverte', 'decouverte')
  );

-- Contrôle post-migration attendu (doit renvoyer 0) :
--   select count(*) from public.users
--   where role='cavalier'
--     and lower(coalesce(plan,'')) in ('cavalier+','premium','famille');
