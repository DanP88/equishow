# V2 FRONT — VALIDATION REPORT

> Chantier **V2 expérimentale, front-only**. Worktree `/Users/dan/equishow-v2-front`,
> branche `feature/equishow-v2-front`. **Aucun impact V1 / PROD.**
> Rapport de fin de lot **F12** — 2026-09-07.

---

## 1. Périmètre & garanties

| Garantie | État |
|---|---|
| Zéro écriture Supabase / PROD | ✅ tout l'état V2 = AsyncStorage préfixé `v2:` |
| Zéro migration | ✅ |
| Zéro Stripe / paiement | ✅ toutes les réservations sont **simulées** localement |
| Zéro modification V1 | ✅ groupe de routes `(tabs)` jamais touché ; `main` (`3ba54f8`) intact |
| Isolation | ✅ tout dans `expo_app/v2/**` + `expo_app/app/(v2)/**` ; bascule unique `v2/flags.ts` |
| Réversibilité | ✅ `git worktree remove` + `git branch -D` → V1 intacte, aucune opération backend |

**Lecture des données réelles** : les hooks V1 (`useConcoursList`, `useMyChevaux`,
`useCoachAnnonces`, `useBoxAnnonces`, `useTransportAnnonces`, `useMyCourseDemands`,
`useMyConcours`, `useOrgRadar`, `useAvis`, `useCommunautePosts`, …) sont utilisés
**en lecture seule uniquement**. Aucun `create*` / `update*` / `delete*` /
`toggleLike` / `addComment` n'est appelé.

---

## 2. Architecture livrée — « Concours-first »

- Bottom bar **FIXE** identique pour les 7 combinaisons de capacités :
  `Accueil · Concours · Chevaux · Agenda · Profil`.
- Top bar : logo → Accueil · Notifications · Messagerie · avatar → Profil.
- **Aucun sélecteur de rôle.** Les activités Cavalier + Coach + Organisateur
  coexistent ; l'ajout de la capacité Coach est un **opt-in explicite**.
- **Fiche concours = centre de contrôle** : `J'y serai` → « Mon concours X/5 »
  → cartes Préparer → passerelles contextualisées vers Transport / Box / Coach.
- Le **choix des chevaux** se fait **une seule fois** dans « Préparer mon
  concours › Cheval » (multi-sélection). Transport / Box / Coach **réutilisent**
  ce contexte — aucun ne redemande le cheval.
- Communauté hors bottom bar ; fils **selon les capacités** détenues.

**Chiffres** : 66 fichiers `v2/`, 34 routes `app/(v2)/`.

---

## 3. Lots

| Lot | Commit | Contenu |
|---|---|---|
| F0 | `2749d7f` | isolation + scaffolding |
| F1 / F1+ | `68ac781` / `e1a0688` | `useCapabilities()` (7 combos) · onboarding omni · parcours nouvel utilisateur simulé |
| F2 | `41c7957` | navigation V2 complète (bottom/top bar, tous les écrans, `v2/ui/kit`) |
| F3 | `14b5b10` / `ffec9a5` | Agenda / Notifications / Messagerie sur moteurs réels V1 (lecture seule) + repli démo |
| F4 | `fbebe8c` / `94931ba` | fiche concours = tableau de bord (`concoursLocal`, préparation X/5) |
| F5 | `3bbcaba` | **Transport V2** (Je cherche / Je propose / réservation simulée / synchro Mon concours) |
| F6 | `253aa2e` | **Box V2** (symétrie F5) |
| — | `b446f12` | date pickers unifiés (`V2DateField` / `V2DateRange`) |
| F7 | `d146850` | **Coach V2** (double position, opt-in capacité, demande / annonce / séance simulées) |
| F8 | `8c6da37` | **Cheval central** (`selectedHorseIds` par concours, chevaux V2 locaux `v2c-…`) |
| F8.1 | `f8912b8` | champs cheval standardisés (`V2SelectField`) |
| — | `51ee071` | réordo écran Chevaux |
| F9 | `c958144` | **profil unique** : compteurs d'activité réels + avis contextualisés (`AvisV2`) |
| F10 | `5f5d3ff` | **espace organisateur** (`OrganisateurV2` / `OrgRadarV2`) + Communauté par capacité |
| F11 | `0c116db` (+ `feb08be`, `5a618a6`) | passe design : iconographie MCI (`v2/ui/Icon`), tokens couleur, **statut santé réel** (`v2/lib/santeStatus` — corrige le « Valide » codé en dur de la V1) |
| F12 | (ce commit) | nettoyage mocks + tests 7 combos + ce rapport |

---

## 4. Réel vs simulé (état final)

### Lu en RÉEL (Supabase, lecture seule) quand la personne est connectée
- concours (liste, fiche, mes concours organisés), épreuves importées
- mes chevaux + fiche cheval (identité, santé)
- annonces transport / box / coach du marché
- mes réservations transport / box, mes demandes de cours, mes stages
- avis reçus / déposés, note moyenne
- posts communauté (3 espaces, RLS DB), notifications, conversations
- Radar organisateur (RPC `fn_org_concours_radar`, agrégats RGPD)

### SIMULÉ / LOCAL (`v2:*`, AsyncStorage)
| Domaine | Clé | Contenu |
|---|---|---|
| préparation concours | `v2:concours-local` | `J'y serai` / `Suivre` / chevaux sélectionnés / épreuves saisies / besoin transport-box-coach |
| transport | `v2:transport` | recherches, annonces, **réservations simulées** |
| box | `v2:box` | idem |
| coaching | `v2:coach` | demandes, annonces, **séances simulées** |
| chevaux V2 | `v2:chevaux` | chevaux créés dans le prototype (id `v2c-…`, zéro collision) + santé locale |
| capacités | `v2:capabilities` | overlay local sur le vrai `users.role` |
| session | `v2:session` | parcours « nouvel utilisateur » simulé (aucun Supabase Auth) |

### Repli DÉMONSTRATION (uniquement si non connecté / aucune donnée réelle)
`v2/mocks/` : `transport.ts`, `box.ts`, `coach.ts`, `f2.ts` (`MOCK_ACTIONS`,
`MOCK_AGENDA`, `MOCK_STUDENT_HORSES`), + jeux internes des adapters
`notifications` / `messaging` / `avis` / `community` / `org`. Toujours **étiquetés**
« aperçu » / « démonstration » à l'écran.

**Nettoyage F12** : `MOCK_COMMUNITY`, `MOCK_CONVERSATIONS`, `MOCK_COACH_DEMANDS`,
`MOCK_COACHES_ON_CONCOURS` supprimés (remplacés par les adapters réels).
`ServiceV2` réduit à un shim de redirection.

---

## 5. Tests

### Qualité statique
- `tsc --noEmit` : **0 erreur** (à chaque lot, F12 inclus).
- **Jest** : cassé projet-wide (`expo/winter`, **pré-existant**, hors périmètre V2) →
  la gate qualité est `tsc` + rendu headless.

### Rendu — 7 combinaisons de capacités × 16 écrans (112 chargements)
Chromium headless, `localStorage` seedé par combo.

| Combinaison | Écrans rendus | Erreurs console |
|---|---|---|
| cavalier | 16 / 16 | 0 |
| coach | 16 / 16 | 0 |
| organisateur | 16 / 16 | 0 |
| cavalier + coach | 16 / 16 | 0 |
| cavalier + organisateur | 16 / 16 | 0 |
| coach + organisateur | 16 / 16 | 0 |
| cavalier + coach + organisateur | 16 / 16 | 0 |

**Total : 0 erreur console.**

Écrans couverts : accueil, concours, chevaux, agenda, profil, communauté,
notifications, messagerie, avis, organisateur, coach, coach (élèves),
transport (cherche), box (cherche), cherche, propose.

### Parcours fonctionnels vérifiés (smokes dédiés, 0 erreur)
- Concours → J'y serai → Préparer → sélection **multi-chevaux** → statut carte ✅/🟠
- Indépendance de la sélection entre 2 concours · persistance après reload
- Transport / Box / Coach : contexte cheval **affiché, jamais redemandé** ;
  recherche → résultats (réels + démo) → détail → **réservation simulée** (récap
  + commission, aucun Stripe) ; « Publier ma recherche / mon annonce » locale
- Coach : opt-in capacité → publication d'annonce → « Mes élèves » (accept/refus visuel)
- Cheval : création locale (`v2c-…`), sélecteurs race/robe/année/taille, « Autre »
  libre, section **Santé** avec statut calculé (À jour / Rappel à prévoir / dépassé)
- Profil : compteurs réels · section Réputation → `/(v2)/avis`
- Organisateur : mes concours (brouillon/publié/archivé) · Radar par concours
  (6 sections, masquage RGPD affiché)
- Communauté : 3 fils si omni, 1 fil si cavalier seul

### iOS
Non exécuté (pas de device / build). Compatibilité **par construction** :
`V2DateField` / `V2SelectField` / `Icon` n'utilisent que des primitives RN
(`Modal`, `ScrollView`, `TextInput`, `@expo/vector-icons`) déjà présentes dans
l'app V1 shippée en TestFlight ; les routes sont du `expo-router` standard.

---

## 6. Limites connues (à traiter en Phase 2 backend)

| # | Limite | Impact |
|---|---|---|
| L1 | **Réservation = 1 enregistrement logique** (`chevalId` = 1ᵉʳ cheval sélectionné) | la réservation multi-box / multi-séance par cheval et le calcul tarifaire associé = lot ultérieur (signalé à l'écran). |
| L2 | **Aucun dépôt** : publier un post / liker / commenter / déposer un avis / accepter une demande de coaching | tout ça est un write Supabase → montré en lecture seule, gating avis `completed` non appliqué. |
| L3 | **Chevaux V2 locaux** (`v2c-…`) ≠ chevaux réels | pas de photo, pas de synchro ; un cheval réel se modifie via l'app V1 (lien de navigation). |
| L4 | **Validation organisateur** simulée (pop-up) ; **création / édition / publication de concours** renvoient vers la V1 | pas de wrap V2 du formulaire `creer-concours`. |
| L5 | **« Chevaux que je coache »** = démo | pas de source réelle avant un modèle « élèves / coaching récurrent » (Phase 2). |
| L6 | **Emojis résiduels** en **titre d'écran** et **métadonnées inline** (`📅 12 sept`) | non structurels ; les slots d'icônes (nav, Row, EmptyState) sont vectoriels. |
| L7 | **Référentiel concours périmé** (hérité V1 : ~2/314 concours à venir) | la V2 n'y peut rien ; réimport FFE = chantier V1. |
| L8 | Bundle web **+750 Ko** (fonts MaterialCommunityIcons) | acceptable web ; sur natif le tree-shaking des glyphes réduit l'impact. |

---

## 7. Décision

Deux voies, au choix de l'utilisateur :

### A — Abandon
```
git worktree remove /Users/dan/equishow-v2-front
git branch -D feature/equishow-v2-front
git push origin --delete feature/equishow-v2-front   # si poussée
```
→ V1 strictement intacte, aucune opération backend.

### B — Validation → Phase 2 backend (Supabase **STAGING** séparé)
Chantiers, dans l'ordre, sur un projet Supabase de staging (jamais PROD directement) :
1. **Modèle multi-capacités** : table `user_capabilities` additive + backfill
   `[users.role]` → réécriture des RLS `role = …` en `capacité`.
2. **Préparation concours** : `concours_presence` + colonnes `epreuves` /
   `besoin_transport|box|coach` + **chevaux du concours** (table de liaison).
3. **Demandes** : `transport_demandes` / `box_demandes` (+ RLS + anti-spam) ;
   réservation réelle via les flux `*_reservations` + **escrow existant** (non modifié).
4. **Organisateur** : validation réelle (`organisateur_requests` + email admin) ;
   wrap V2 de `creer-concours` (dual-mode).
5. **Communauté / avis** : publication + likes + commentaires ; gating avis
   `reservation.status = 'completed'`.
6. **Référentiel concours** : import FFE automatisé.
7. Vue `v_user_activity_counts` (ou agrégat serveur) pour le profil.

**Stripe / escrow : non touchés.** Puis TestFlight STAGING → migration PROD contrôlée.

---

## 8. Comment relancer

```bash
cd /Users/dan/equishow-v2-front/expo_app
pkill -f "expo start"
npx expo start --web --port 8092          # http://localhost:8092
# /v2-dev  → panneau « Capacités » (les 7 combinaisons)
```
V1 en parallèle : `cd /Users/dan/equishow/expo_app && npx expo start --web --port 8090`.
