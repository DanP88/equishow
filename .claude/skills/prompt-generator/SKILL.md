---
name: prompt-generator
description: Generate structured, technical prompts for Equishow tasks (migrations, features, audits, fixes) so a future Claude session can execute reliably. Use when the user wants a reusable task brief or to hand off work.
---

# Prompt Generator (Equishow)

Produit un prompt technique structuré, exécutable par une future session Claude Code, ancré sur CLAUDE.md + `docs/`.

## Gabarit de sortie
```
# OBJECTIF
<but unique, mesurable>

# CONTEXTE
- Module/écrans/tables concernés (réf CLAUDE.md + docs/<x>.md)
- État actuel observé (ne pas supposer la prod)
- Contraintes : préserver UI/RLS/routes/escrow existants

# IMPACT À VÉRIFIER
- Métier · DB (RLS/index/triggers) · Stripe/escrow · sécurité · analytics

# TRAVAIL
1. <étapes ordonnées, additives>
2. Migration NNN + rollback si DB (CLI, jamais db push)

# VALIDATION
- Plan de test (Stripe test 4242, comptes .app, harness rollback local)
- tsc sans nouvelle erreur + build web vert

# RISQUE
P0/P1/P2/P3 + justification

# ROLLBACK
<procédure>

# LIVRABLE
<fichiers touchés, ne rien commiter sauf demande explicite>
```

## Règles
- Toujours référencer les faits du repo (pas d'invention) ; marquer `_(déduit)_` ce qui n'est pas vérifié.
- Rappeler les invariants Equishow : sans TVA, montants serveur-authoritative, `--no-verify-jwt` webhooks, `statut` transport, `event_type` figé, prod = merge.
- Garder le prompt concis et actionnable.

## Sortie attendue
Un prompt prêt à coller, auto-suffisant, avec critères de succès explicites.
