# docs/concours.md — Module Concours

> Détail extrait de CLAUDE.md. Le concours = **point d'entrée de découverte contextuel** (jamais obligatoire). Pas de panier/escrow unique multi-modules ; chaque module reste indépendant.

## Tables
`concours`, `concours_followers`, `concours_claims`, `concours_messages`, `concours_thread_reads`.

## Écrans
`(tabs)/concours.tsx`, `(tabs)/concours-hub.tsx`, `concours/[id]/index.tsx` (fiche), `concours/[id]/discussion.tsx`, `creer-concours.tsx`, `import-concours.tsx`, `(tabs)/org-concours.tsx`, `org-revendiquer.tsx`, `admin-concours-claims.tsx`.

## Hooks / libs
`useConcours` (dont `useConcoursList` + `createConcours`), `useConcoursClaims`, `useConcoursDiscussion`, `useConcoursModuleCounts`, `useConcoursWeather`, `useOrgRadar`, `useFollow`. Libs : `epreuves.ts`, `mentions.ts`, `csv.ts`, `discipline.ts`, `encoding.ts` (décodage import), `categories.ts`.

## Workflow
1. **Import CSV FFE** (admin) → upsert sur `numero_ffe` (297 concours prod, 292 avec épreuves). **Décodage robuste de l'encodage** (cf. § Import & encodage).
2. **Création organisateur** (`creer-concours.tsx` → `createConcours()` dans `useConcours.ts`, mig 092) : INSERT réel dans `public.concours`, **`statut='brouillon'`**, `source_import='manual'`, `organisateur_id = auth.uid()` (jamais de service role). Champs sans colonne dédiée (ville, horaires, options logistiques…) → colonne **`infos jsonb`**. Le front garde la session + le rôle `organisateur` ; la RLS `concours_insert_organisateur` (`organisateur_id = auth.uid()` **ET** `users.role='organisateur'`) l'impose côté serveur (un cavalier/coach → erreur RLS). Verrou synchrone `useRef` anti double-submit ; navigation uniquement après succès réel de l'insert.
3. **Cycle brouillon → publication** : un concours créé est en `brouillon` (invisible du public). La visibilité DB est gouvernée par la RLS `concours_select_visible` (`statut='publie'` OR owner OR admin — brouillons masqués public/anon au niveau DB). **Publication/édition = PR2-C (non livrée)** : la bascule `brouillon→publie` et l'affichage des brouillons dans `org-concours` restent à faire (aujourd'hui `org-concours` liste via claims).
4. **Filtrage public** : `useConcoursList()` applique **`.eq('statut','publie')`** — défense en profondeur au-dessus de la RLS. Tous les écrans de **découverte** passent par ce hook (hub, services, claim org, annonce coach, autocomplétion @mention) → seuls les concours publiés y apparaissent. La fiche `useConcours(id)` et les flux org/admin ne passent PAS par ce filtre.
5. **Fiche** : météo (Open-Meteo front-only, 0 DB), épreuves parsées depuis `liste_epreuves`, services filtrés par `concours_id`.
6. **Follow** (`concours_followers`, compteur dénormalisé).
7. **Discussion** : fil public par concours (Option C), identité pseudo+couleur+initiales, tout user connecté écrit. Tags **implicites** (#transport/#box/#coach/#stage par détection hashtag), réponses 1 niveau (parent_id+citation). **Fil des participants** (bandeau auteurs distincts → profil). Mentions typées cliquables `@[Nom](concours|user:UUID)`. Soft delete = contenu vidé. Notifs : `concours_reply` au parent + `concours_mention` à chaque user mentionné (trigger `fn_notify_concours_mention`, dédup, best-effort).
8. **Org** : revendique (`concours_claims`, 7 champs) → admin approuve → **Radar** (`fn_org_concours_radar`, agrégats RGPD-aware, masquage < 5).

## Import & encodage (`lib/encoding.ts`, mig — front-only)
Les exports FFE/Excel arrivent dans des encodages variés. `import-concours.tsx` lit désormais le fichier **à l'octet** (`readAsArrayBuffer`, plus `readAsText('UTF-8')`) puis appelle `decodeImportedText(buffer)` :
1. décodage **UTF-8** par défaut ; un fichier UTF-8 propre ressort inchangé ;
2. octet invalide (caractère U+FFFD) → le fichier est **Windows-1252 / Latin-1** → re-décodage `TextDecoder('windows-1252')` (repli `try/catch` : si le label n'est pas supporté, garde l'UTF-8) ;
3. UTF-8 valide mais **double-encodé** (« PrÃ©paratoire ») → réparation conservatrice (réinterprète les chars comme octets Latin-1, re-décode UTF-8 en mode `fatal`), conservée uniquement si elle supprime les marqueurs mojibake (jamais destructrice sinon).
Écran admin **web-only** (FileReader/DOM). 100 % lecture seule sur le contenu importé, aucune dépendance React Native.

## Migrations
074 (table + `concours_id` ×5 annonces), 075 (followers), 076/077 (claim + radar, `tr.statut`), 079 (fix import UNIQUE+RLS admin), 080/081 (radar LOT2 : réservations/CA/clics), 082/083 (discussions LOT1/LOT2-P1), 091 (discussions LOT2 : @user + notif `concours_mention`), **092 (création organisateur : colonnes `statut`+`infos jsonb`, FK `organisateur_id→users`, RLS insert/update own-row + garde rôle organisateur, SELECT durcie `concours_select_visible`)**.

## Points sensibles
- **Mock→DB (quasi terminé)** : `creer-concours` (écrit en DB, PR #74) et `coach-concours` (lit `useConcoursList`, PR #72) sont branchés sur la table `public.concours`. **Reste PR2-C** : édition + publication `brouillon→publie` + affichage des brouillons dans `org-concours` (qui liste aujourd'hui via claims, donc un brouillon fraîchement créé n'y apparaît pas encore — limitation connue, non régression).
- **Filtre public** : `useConcoursList().eq('statut','publie')` — ne jamais retirer sans revoir la découverte ; les brouillons ne doivent pas fuiter dans le hub/services/@mention.
- `isMissingTable` doit couvrir `PGRST205` (+ 42P01/42703).
- Import : index partiel non inférable par ON CONFLICT (cf incident 079) ; RLS admin = `role='admin'` ; **décodage à l'octet obligatoire** (`readAsArrayBuffer`+`decodeImportedText`, cf. § Import & encodage) — ne pas revenir à `readAsText` sous peine de mojibake.
- Discussions LOT 2 = ✅ **prod** (fil participants + `@user` + notif de mention `concours_mention`, mig 091). Reste seulement le **push** de mention (web-only, mobile en attente EAS).

## Catégories FFE (mig 084)
- Table enfant **`concours_categories`** (`id`, `concours_id → concours(id) ON DELETE CASCADE`, `categorie`, `UNIQUE(concours_id, categorie)`, index `idx_cc_categorie`). RLS = miroir `concours` (select public / write admin). Vue read-only `v_concours_categories_counts` (`security_invoker`).
- Clé de jointure = `concours.id` (uuid), PAS `numero_ffe` (son index unique est partiel → inéligible comme cible de FK).
- Import (`import-concours.tsx`) : `parseCategories` (lib/categories.ts) découpe la colonne `categories` (séparateur `,`), trim, **dédup** ; persistance « replace » idempotente (delete+insert par `concours_id`), best-effort (tolère table absente).
- Format « fusion canonique » : parser CSV auto-détecte le séparateur `;` (lib/csv.ts) ; dates `DD/MM/YYYY`→ISO + repli `date_fin`→`date_debut` (`normalizeDate`). Catégories portées par les lignes `source_type=CSV` ; les lignes `XLS` ont `categories` vide (niveaux noyés dans `epreuves`, non extraits).
- Affichage : carte `ConcoursCategoriesCard` sur la fiche (`useConcoursCategories`). Pas de filtre hub (reporté).
