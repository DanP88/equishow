-- Rollback migration 085 — restaure les plans cavalier legacy depuis le snapshot.
-- Restaure exactement les valeurs (plan, plan_id) sauvegardées avant l'UPDATE,
-- puis supprime la table de backup. Aucune perte de données.

update public.users u
set plan = b.old_plan, plan_id = b.old_plan_id, updated_at = now()
from public._backup_users_plan_085 b
where u.id = b.user_id;

drop table if exists public._backup_users_plan_085;
