# docs/concours.md — Module Concours

> Détail extrait de CLAUDE.md. Le concours = **point d'entrée de découverte contextuel** (jamais obligatoire). Pas de panier/escrow unique multi-modules ; chaque module reste indépendant.

## Tables
`concours`, `concours_followers`, `concours_claims`, `concours_messages`, `concours_thread_reads`.

## Écrans
`(tabs)/concours.tsx`, `(tabs)/concours-hub.tsx`, `concours/[id]/index.tsx` (fiche), `concours/[id]/discussion.tsx`, `creer-concours.tsx`, `import-concours.tsx`, `(tabs)/org-concours.tsx`, `org-revendiquer.tsx`, `admin-concours-claims.tsx`.

## Hooks / libs
`useConcours`, `useConcoursClaims`, `useConcoursDiscussion`, `useConcoursModuleCounts`, `useConcoursWeather`, `useOrgRadar`, `useFollow`. Libs : `epreuves.ts`, `mentions.ts`, `csv.ts`, `discipline.ts`.

## Workflow
1. **Import CSV FFE** (admin) → upsert sur `numero_ffe` (297 concours prod, 292 avec épreuves).
2. **Fiche** : météo (Open-Meteo front-only, 0 DB), épreuves parsées depuis `liste_epreuves`, services filtrés par `concours_id`.
3. **Follow** (`concours_followers`, compteur dénormalisé).
4. **Discussion** : fil public par concours (Option C), identité pseudo+couleur+initiales, tout user connecté écrit. Tags **implicites** (#transport/#box/#coach/#stage par détection hashtag), réponses 1 niveau (parent_id+citation), mentions `@[Nom](concours:UUID)` cliquables. Soft delete = contenu vidé. Notif `concours_reply` au parent.
5. **Org** : revendique (`concours_claims`, 7 champs) → admin approuve → **Radar** (`fn_org_concours_radar`, agrégats RGPD-aware, masquage < 5).

## Migrations
074 (table + `concours_id` ×5 annonces), 075 (followers), 076/077 (claim + radar, `tr.statut`), 079 (fix import UNIQUE+RLS admin), 080/081 (radar LOT2 : réservations/CA/clics), 082/083 (discussions LOT1/LOT2).

## Points sensibles
- **Dual-source** : 7 écrans lisent encore le mock `concoursStore` (`creer-concours`, `(tabs)/coach-concours`, `(tabs)/services`, `proposer-coach-annonce`, `(tabs)/concours`, `(tabs)/communaute`, `(tabs)/org-concours`). À brancher sur la table DB.
- `isMissingTable` doit couvrir `PGRST205` (+ 42P01/42703).
- Import : index partiel non inférable par ON CONFLICT (cf incident 079) ; RLS admin = `role='admin'`.
- Discussions LOT 2 reste : fil participants, `@user`, push, notif de mention (archi prête, non câblée).
