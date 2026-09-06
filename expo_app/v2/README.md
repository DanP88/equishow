# EquiShow V2 — Phase 1 (FRONT-ONLY)

Dossier d'isolation de la V2 expérimentale. **Tout le code V2 vit ici.**
Les fichiers V1 hors de ce dossier ne sont modifiés qu'a minima, toujours
derrière `V2_ENABLED` / `isV2(flag)`.

## Où on en est

- **V1 de référence** : `chore/eas-ios-testflight` @ `bc81b94`
  (= TestFlight #12 `3173f8f` + fix filtre concours coach).
  Tags : `v1.0.0-testflight-12`, `backup-before-equishow-v2-front`.
  Poussée sur `origin`.
- **V2** : branche `feature/equishow-v2-front`, worktree `/Users/dan/equishow-v2-front`.
- **LOT courant** : F0 · F1 · F1+ · F2 · **F3** terminés. F4 non commencé.
  - F3 = Agenda / Notifications / Messagerie branchés sur les **moteurs réels V1**
    (lecture seule) via `v2/adapters/*` ; repli sur données de démo sans session.
  - F2 = nouvelle navigation V2 : groupe de routes `app/(v2)/`, bottom bar +
    top bar fixes, Accueil omni, Concours + sous-onglets, fiche concours centre
    de contrôle, Je cherche / Je propose, opt-in Coach, Chevaux adaptatif,
    Agenda unifié, Profil unique, Notifications, aperçu Communauté.
  - Entrée V2 : `/v2-dev` › « Entrer dans la V2 », ou `V2_ENABLED=true` +
    `V2_FLAGS.navigation=true` (→ `app/index.tsx` redirige vers `/(v2)/accueil`).

## Règles absolues Phase 1

1. **Aucune modification backend** : Supabase, migrations, RLS, RPC, triggers,
   views, edge functions, Auth backend, Stripe, Stripe Connect, escrow, paiements.
2. **Lectures PROD autorisées** via les hooks V1 existants.
3. **Aucune écriture PROD depuis la V2.** Toute mutation (onboarding omni,
   « Mes activités », « Je cherche », « Préparer mon concours », validation
   organisateur, etc.) est **simulée / interceptée côté front** :
   `v2/mocks/`, `v2/adapters/`, état local, AsyncStorage.
   Garde-fou : `assertNoProdWrite()` dans `v2/flags.ts`.
4. **Aucun build EAS / TestFlight** de la V2.
5. **Aucun merge vers `main`.** `main` non touché (remise à niveau traitée
   séparément, plus tard).
6. Pas de `search/replace` global sur le rôle : chaque point de dépendance au
   rôle reçoit un adaptateur V2 opt-in.

## Tester la V2 (worktree feature/equishow-v2-front)

```
cd /Users/dan/equishow-v2-front/expo_app
npx expo start --web --port 8092
```
Ouvrir **http://localhost:8092** → l'app entre directement dans la V2
(`/(v2)/accueil`), **sans connexion** (build de dev). Le panneau capacités
(7 combinaisons) est sur **http://localhost:8092/v2-dev**.

Sur cette branche : `V2_ENABLED = true`, `V2_FLAGS.navigation = true`.
`app/_layout.tsx` exempte le groupe `(v2)` de la garde d'auth **uniquement en
`__DEV__` + V2 activée** (comme les galeries `proto`). Aucun effet en prod, aucun
effet si les flags repassent à `false` (→ comportement V1 exact). La V1
(`/Users/dan/equishow`, `main`) n'est pas touchée.

## Activer / désactiver la V2 (autres branches)

Éditer `v2/flags.ts` :
- `V2_ENABLED = false` → l'app est **exactement** la V1.
- `V2_ENABLED = true` + `V2_FLAGS.navigation = true` → l'app démarre dans la V2.

## Supprimer entièrement la V2 (retour V1 total)

```
git worktree remove /Users/dan/equishow-v2-front
git branch -D feature/equishow-v2-front
```

La V1 (`chore/eas-ios-testflight`, tag `v1.0.0-testflight-12`) est intacte.
Aucune opération backend n'est nécessaire pour annuler la V2 (rien n'a été
appliqué côté serveur).

## Arborescence

```
v2/
  flags.ts        interrupteur unique + garde-fou anti-écriture PROD
  README.md       ce fichier
  capabilities/   F1 — useCapabilities() : Set<'cavalier'|'coach'|'organisateur'>
  auth/           F1 — useV2Session() : session SIMULÉE (signup/login local,
                  AUCUN Supabase Auth) fusionnée avec la vraie session useAuth
  nav/            F2 — bottom bar + navConfig + accueil omni
  screens/        écrans V2 (OnboardingV2, V2EntryFlow, DevCapabilitiesPanel)
  components/     composants V2 (OrganisateurPendingModal…)
  adapters/       wrappent les hooks V1 réels + fusionnent avec des mocks
  mocks/          données simulées — préfixe MOCK_ + champ __mock:true
  fixtures/       jeux de démo réalistes (concours à venir, élèves coach…)
  design/         F11 — icônes, tokens, composants pill/chip/status
  lib/            helpers V2 (persist.ts = surcouche AsyncStorage préfixe v2:)
```

## Parcours d'entrée V2 (F1)

`app/v2-dev.tsx` (route `__DEV__`) → 3 entrées :
- **Parcours nouvel utilisateur** (`V2EntryFlow`) : Bienvenue → Se connecter /
  Créer un compte → identifiants (prénom, nom, email, tél, mot de passe ×2) →
  activités multi-select → infos complémentaires adaptatives → « compte créé et
  connecté » — **100 % simulé**, session dans `v2:session` (AsyncStorage).
- **Panneau Capacités** (`DevCapabilitiesPanel`) : 7 combinaisons + toggles.
- **Onboarding V2** (`OnboardingV2`) : cas « déjà connecté, choix des activités ».

Clés AsyncStorage V2 : `v2:capabilities`, `v2:session`, `v2:onboarding:draft`.

Chaque objet simulé porte `__mock: true`. Inventaire exhaustif tenu à jour dans
`v2/mocks/INVENTORY.md` (livré en F12).

## Baseline F0 (V1 @ bc81b94)

- `tsc --noEmit` : **0 erreur**.
- Jest : **cassé projet-wide, PRÉ-EXISTANT** (11/11 suites échouent —
  `expo/src/winter` : "import a file outside of the scope of the test code").
  Déjà signalé dans le commit V1 `0fdc714`. Gate qualité = `tsc`, pas Jest.
