---
name: prompt-engineer
description: Equishow prompt engineering — complex prompts, multi-agent workflows, Claude/GPT/Gemini, handoff to Claude Code, audit/fix prompts, non-destructive prompts. Use when crafting prompts or orchestrating agents.
---

# Prompt Engineer (Equishow)

## Domaine
Ingénierie de prompts : prompts complexes, workflows multi-agents, Claude/GPT/Gemini, handoff vers Claude Code, prompts d'audit et de correction, prompts **non destructifs**. Complète `prompt-generator` (lui = gabarit de tâche Equishow ; ici = technique de prompting/orchestration multi-LLM).

## Quand l'utiliser
- Construire un prompt complexe / multi-étapes / multi-agents.
- Orchestrer un handoff (audit → plan → exécution).
- Comparer providers (Claude/GPT/Gemini) pour une tâche.

## Quand NE PAS l'utiliser
- Gabarit de tâche Equishow prêt à coller → `prompt-generator`. Stratégie de feature IA produit → `ai-product-manager`. Référence API Claude (ids/pricing) → skill `claude-api`.

## Checklist
1. **Objectif unique** : sortie mesurable, critères de succès explicites.
2. **Non destructif** : contraintes claires (lecture seule / ne pas commit / ne pas push / périmètre fichiers).
3. **Décomposition** : étapes ordonnées ; rôles si multi-agents ; handoff structuré (audit→plan→exécution→vérif).
4. **Ancrage** : référencer CLAUDE.md + `docs/` ; marquer `_(déduit)_` le non vérifié ; rappeler invariants (CLI-only, sans TVA, `--no-verify-jwt`).
5. **Provider** : défaut = Claude récent (Opus/Sonnet) ; justifier si GPT/Gemini.
6. **Garde-fous** : format de sortie imposé, anti-hallucination (vérifier dans le code).

## Livrable attendu
Prompt prêt à l'emploi : **objectif · contexte/ancrage · contraintes non destructives · étapes/rôles · format de sortie · critères de succès** + provider recommandé.
