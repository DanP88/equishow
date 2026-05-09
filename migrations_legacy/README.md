# migrations_legacy/ — archives historiques

Ce dossier contient l'ancien jeu de migrations SQL du projet, conservé en
lecture seule pour référence historique.

## Statut

**Ne pas exécuter, ne pas modifier.**

Ces fichiers ont été écrits avant la séparation des projets Supabase
(2026-05-07) et avant la mise en place du dossier canonique
`supabase/migrations/`. Ils ne sont plus appliqués sur aucun projet
Supabase.

## Migrations canoniques

La source de vérité actuelle pour toute migration SQL est :

```
supabase/migrations/
```

C'est le seul dossier que la CLI `supabase db push` lit, et c'est le seul
dossier validé par la CI (cf `.github/workflows/ci-cd.yml`).

## Règles

- Tout nouveau changement de schéma doit être ajouté **uniquement** dans
  `supabase/migrations/` avec un numéro incrémental (ex : `010_*.sql`).
- Ne jamais ré-exécuter les fichiers de ce dossier sur la DB ; certains
  divergent du schéma actuel et casseraient les tables existantes.
- Si un détail historique est nécessaire pour comprendre une décision,
  consulter ce dossier en lecture, puis pointer la migration équivalente
  dans `supabase/migrations/`.

## Contexte de l'archivage

Audit P11 (mai 2026) : duplication des migrations entre `/migrations/`
(racine) et `/supabase/migrations/`. Le dossier racine a été renommé en
`migrations_legacy/` pour clarifier sans rien supprimer.
