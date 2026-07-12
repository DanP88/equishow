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
4. **Discussion** : fil public par concours (Option C), identité pseudo+couleur+initiales, tout user connecté écrit. Tags **implicites** (#transport/#box/#coach/#stage par détection hashtag), réponses 1 niveau (parent_id+citation). **Fil des participants** (bandeau auteurs distincts → profil). Mentions typées cliquables `@[Nom](concours|user:UUID)`. Soft delete = contenu vidé. Notifs : `concours_reply` au parent + `concours_mention` à chaque user mentionné (trigger `fn_notify_concours_mention`, dédup, best-effort).
5. **Org** : revendique (`concours_claims`, 7 champs) → admin approuve → **Radar** (`fn_org_concours_radar`, agrégats RGPD-aware, masquage < 5).

## Migrations
074 (table + `concours_id` ×5 annonces), 075 (followers), 076/077 (claim + radar, `tr.statut`), 079 (fix import UNIQUE+RLS admin), 080/081 (radar LOT2 : réservations/CA/clics), 082/083 (discussions LOT1/LOT2-P1), 091 (discussions LOT2 : @user + notif `concours_mention`).

## Points sensibles
- **Dual-source** : 7 écrans lisent encore le mock `concoursStore` (`creer-concours`, `(tabs)/coach-concours`, `(tabs)/services`, `proposer-coach-annonce`, `(tabs)/concours`, `(tabs)/communaute`, `(tabs)/org-concours`). À brancher sur la table DB.
- `isMissingTable` doit couvrir `PGRST205` (+ 42P01/42703).
- Import : index partiel non inférable par ON CONFLICT (cf incident 079) ; RLS admin = `role='admin'`.
- Discussions LOT 2 = ✅ **prod** (fil participants + `@user` + notif de mention `concours_mention`, mig 091). Reste seulement le **push** de mention (web-only, mobile en attente EAS).

## Catégories FFE (mig 084)
- Table enfant **`concours_categories`** (`id`, `concours_id → concours(id) ON DELETE CASCADE`, `categorie`, `UNIQUE(concours_id, categorie)`, index `idx_cc_categorie`). RLS = miroir `concours` (select public / write admin). Vue read-only `v_concours_categories_counts` (`security_invoker`).
- Clé de jointure = `concours.id` (uuid), PAS `numero_ffe` (son index unique est partiel → inéligible comme cible de FK).
- Import (`import-concours.tsx`) : `parseCategories` (lib/categories.ts) découpe la colonne `categories` (séparateur `,`), trim, **dédup** ; persistance « replace » idempotente (delete+insert par `concours_id`), best-effort (tolère table absente).
- Format « fusion canonique » : parser CSV auto-détecte le séparateur `;` (lib/csv.ts) ; dates `DD/MM/YYYY`→ISO + repli `date_fin`→`date_debut` (`normalizeDate`). Catégories portées par les lignes `source_type=CSV` ; les lignes `XLS` ont `categories` vide (niveaux noyés dans `epreuves`, non extraits).
- Affichage : carte `ConcoursCategoriesCard` sur la fiche (`useConcoursCategories`). Pas de filtre hub (reporté).
