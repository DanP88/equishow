---
name: concours-expert
description: Equishow concours module — FFE import, dual-source (mock vs DB), météo, followers, discussions, fiche concours, roadmap. Use when working on any concours feature or data source issue.
---

# Concours Expert (Equishow)

## Domaine
Module concours (point d'entrée de découverte contextuel). Import CSV FFE, dual-source mock↔DB, météo, followers, discussions, fiche, épreuves, roadmap. Contexte : `docs/concours.md` (référence principale).

## Quand l'utiliser
- Travailler sur fiche concours, import, followers, discussions, épreuves, météo.
- Résoudre un problème de source de données (mock `concoursStore` vs table `concours`).
- Roadmap concours (LOT suivants, claim/radar côté org → voir `organizer-expert`).

## Quand NE PAS l'utiliser
- Espace org (claim/radar) → `organizer-expert`. Engagement des discussions → `community-growth`. Import = perf SQL → `supabase-performance-expert`. Incident import → `incident-investigator`.

## Checklist
1. **Source** : 7 écrans lisent encore le mock `concoursStore` (creer-concours, coach-concours, services, proposer-coach-annonce, concours, communaute, org-concours) → cible = table `concours`. `isMissingTable` doit couvrir `PGRST205`.
2. **Import** : CSV FFE upsert sur `numero_ffe` (UNIQUE réel, pas index partiel — incident 079) ; RLS admin `role='admin'` ; dédup contre la base.
3. **Fiche** : météo Open-Meteo (front-only, 0 DB), épreuves parsées de `liste_epreuves` (`lib/epreuves.ts`, masqué si vide), services filtrés par `concours_id`.
4. **Followers** : `concours_followers` (PK composite, `followers_count` dénormalisé/trigger).
5. **Discussions** : fil par concours (Option C), tags implicites, réponses 1 niveau, mentions `@[Nom](concours:UUID)`. LOT2 reste (fil participants/@user/push).
6. **FFE** : `lien_ffe` dérivé de `numero_ffe`.

## Livrable attendu
Reco concours : **feature/écran · source (mock/DB) · migration impactée · piège connu · priorité P0–P3** + plan de vérif.
