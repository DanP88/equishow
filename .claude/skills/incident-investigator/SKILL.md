---
name: incident-investigator
description: Post-mortem analysis for Equishow incidents — timeline, root cause, impact, reproduction, fix, prevention. Use when something broke in prod (payments, signup, cron, RLS, webhook) and you need a structured diagnosis.
---

# Incident Investigator (Equishow)

Analyse post-mortem structurée. Historique de référence : `docs/incidents.md` (036 TVA, signup, 077 status/statut, 066 cron, 060 surbooking, 079 import, webhook jwt, 011/012 MCP).

## Domaine d'expertise
Timeline, root cause analysis, mesure d'impact, reproduction, correction minimale, prévention (règle durable).

## Quand l'utiliser
- Un comportement prod casse (paiement pending, fonds non libérés, signup en erreur, cron silencieux, surbooking, webhook 401).
- Régression après un déploiement.
- Écart inexpliqué entre attendu et observé.

## Quand NE PAS l'utiliser
- Conception d'une feature neuve (pas d'incident) → `product-manager`/skills techniques.
- Revue préventive avant merge → `migration-reviewer`/`security-auditor`/`test-engineer`.

## Checklist d'analyse
1. **Symptôme** : ce qui est observé, où, depuis quand, fréquence, qui est touché.
2. **Timeline** : dernier déploiement/migration/secret avant l'apparition (`git log`, `migration list`, secrets).
3. **Reproduction** : isoler le chemin minimal (statuts, rôle, module). Stripe **test** 4242, comptes `.app`.
4. **Root cause** : la VRAIE cause, pas le symptôme. Vérifier les pièges connus :
   - cron pg_net → lire `net._http_response.status_code`, PAS `cron.job_run_details` ;
   - CHECK enums (`release_trigger=auto_cron`, pas `cron`) ;
   - colonne `statut` (transport) vs `status` ;
   - RLS admin `role='admin'` ; upsert front `anon` au signup ;
   - MCP voit InstallCom → CLI only ; webhook `--no-verify-jwt`.
5. **Impact** : données corrompues ? argent bloqué/perdu ? surbooking ? combien d'users/résa.
6. **Correction** : minimale, additive, avec rollback. Migration ciblée si DB.
7. **Prévention** : règle durable → proposer ajout dans `docs/incidents.md` + CLAUDE.md.

## Livrable attendu
Post-mortem : **Symptôme · Timeline · Reproduction · Root cause · Impact · Correction (avec rollback) · Prévention** + sévérité P0–P3. Si la cause crée une règle réutilisable → proposer la doc à mettre à jour.
