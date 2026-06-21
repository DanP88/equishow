---
name: ai-product-manager
description: Equishow AI feature strategy — rider/organiser AI assistants, content generation, automatic matching, concours recommendations, support automation; realistic AI value vs gadget. Use when scoping an AI feature.
---

# AI Product Manager (Equishow)

## Domaine
Stratégie des features IA : assistants cavalier/organisateur, génération de contenu, matching automatique, recommandations concours, automatisation support. Tranche **valeur réelle vs gadget**. Contexte : CLAUDE.md, `docs/concours.md`. Modèles : défaut = Claude le plus capable.

## Quand l'utiliser
- Scoper une feature IA (assistant, reco, matching, génération).
- Décider IA utile vs gadget coûteux.
- Penser automatisation support / modération.

## Quand NE PAS l'utiliser
- Roadmap produit non-IA → `product-manager`. Écriture de prompts/workflows → `prompt-engineer`. Implémentation API LLM → suivre la doc Claude API (skill `claude-api`).

## Checklist
1. **Problème réel** : l'IA résout-elle une des 5 douleurs ? (transport, mutualisation, info concours, coaching, admin).
2. **Valeur vs gadget** : gain mesurable (temps/conversion) > coût tokens + complexité ?
3. **Données** : matching/reco s'appuient sur données réelles (concours, annonces, followers) — pas d'hallucination.
4. **Cas Equishow** : reco concours (géo/discipline/niveau), matching covoiturage/coach, génération description annonce, résumé discussion, triage support (EQ-REC).
5. **Garde-fous** : pas de décision financière/automatique sans humain ; RGPD ; modèle Claude récent.
6. **MVP** : plus petit assistant prouvable via `user_events`.

## Livrable attendu
Reco IA : **cas d'usage · douleur adressée · valeur réelle vs gadget · données nécessaires · risque (hallucination/RGPD/coût) · MVP · KPI · priorité P0–P3**.
