---
name: migration-reviewer
description: Review a Supabase migration for Equishow before applying — additive vs destructive, rollback, index, locks, prod compatibility, deploy risk. Use when writing or reviewing any supabase/migrations/*.sql.
---

# Migration Reviewer (Equishow)

Revue ciblée d'une migration SQL avant application prod. Complémentaire de `supabase-auditor` (lui = audit schéma/RLS large ; ici = focus migration + déploiement). Contexte : `docs/database.md`.

## Domaine d'expertise
Additif vs destructif, rollback réversible, index, verrous (locks), compatibilité prod (zero-downtime), ordre d'application, risques de déploiement.

## Quand l'utiliser
- Avant d'appliquer une migration `NNN_*.sql` en prod.
- Revue d'un fichier migration en PR.
- Doute sur un lock long / une réécriture de table.
- Vérifier l'ordre/dépendances entre migrations.

## Quand NE PAS l'utiliser
- Audit sécurité large (RLS/secrets/Edge) → `security-auditor`.
- Pur design de schéma sans déploiement → `supabase-auditor`.
- Logique paiement → `escrow-expert`.

## Checklist d'analyse
1. **Additif** : pas de `DROP TABLE`/`DELETE`/`TRUNCATE` destructif (cleanup ultra-conservateur). Colonne/contrainte ajoutée nullable ou avec défaut sûr.
2. **Rollback** : `NNN_*_rollback.sql` présent, réellement réversible, testé.
3. **Index** : FK indexées ; `CREATE INDEX CONCURRENTLY` si table volumineuse (hors transaction) ; UNIQUE anti-doublon. ⚠️ index **partiel** non inférable par `ON CONFLICT` (incident 079).
4. **Locks** : `ALTER TABLE` réécrivant la table = lock exclusif → risque prod ; `ADD COLUMN ... DEFAULT` (PG≥11 safe) ; `NOT VALID` puis `VALIDATE` pour contraintes ; éviter long lock en heures de charge.
5. **Compatibilité prod** : numéro > dernière appliquée ; pas de dépendance non satisfaite ; CHECK enums respectés (`release_trigger`, `event_type`, `status`/`statut`).
6. **Triggers/fonctions** : `CREATE OR REPLACE` ne casse pas les triggers liés ; `security definer set search_path = public`.
7. **Déploiement** : `supabase db query -f --linked` + `migration repair --status applied NNN --linked`. **Jamais `db push`.** Harness rollback sur cluster local jetable d'abord.

## Livrable attendu
Verdict **GO / GO AVEC RÉSERVE / NO-GO** + risque déploiement P0–P3 + objets impactés (table/lock/index) + ordre d'application + plan de recette + commande rollback exacte.
