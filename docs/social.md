# docs/social.md — Graphe social (Follow)

> Détail extrait de CLAUDE.md. Brique fondatrice du **Hub Concours « réseau social des concours »** (PR1, mig 088, `main` @ `422fd50`).
> Principe : *« Equishow sait qui sera au paddock »* — le graphe « personnes que je connais » alimentera la présence concours et le hero « X que vous connaissez ».
> **Périmètre invariant : ne touche JAMAIS payments / escrow / Stripe / webhooks.** Additif pur.

## Décision produit
Follow **asymétrique type Instagram** : suivre = INSERT, désuivre = DELETE. **Pas de demande/acceptation.** Le lien est public (IDs uniquement, aucune donnée sensible exposée).

## Tables
`user_follows` (mig 088).

```
user_follows (
  follower_id  uuid → users(id) on delete cascade,
  followee_id  uuid → users(id) on delete cascade,
  created_at   timestamptz,
  primary key (follower_id, followee_id),     -- anti-doublon natif
  check (follower_id <> followee_id)          -- anti auto-follow
)
index idx_user_follows_followee (followee_id)  -- "qui me suit"
```

**RLS** : `SELECT` authenticated (compteurs + « est-ce que je suis X ») · `INSERT`/`DELETE` own-only (`follower_id = auth.uid()`) · **pas d'`UPDATE`**.

## RPC `fn_people_i_know(viewer uuid) → (user_id, relation)`
Read-only, `SECURITY DEFINER`, `stable`. Reconstitue le graphe « personnes que je connais » en **UNION robuste** de sources **déjà en base** :

| Source | relation | Origine |
|---|---|---|
| follows directs | `following` | `user_follows` |
| messagerie 1:1 | `messaged` | `conversations` (038) |
| réservations (l'autre partie) | `booked` | `box_reservations`, `stage_reservations`, `course_demands`, `transport_reservations` |
| même club | `club` | `users.club_name` **(absent aujourd'hui → ignorée, voir Dette)** |

- **Robustesse** : chaque source au-delà des follows est gardée par `to_regclass` / `information_schema` → si une table/colonne manque, la source est ignorée, la fonction ne casse jamais (construction dynamique via `EXECUTE`).
- **Dé-doublonnage** : `distinct on (user_id)` avec priorité `following > messaged > booked > club`.
- **Anti-énumération** : un appelant authentifié ne peut demander que **son propre** graphe (`viewer = auth.uid()`), sauf `role='admin'`. Inactif en service_role/harness (`auth.uid()` NULL).
- **Contrainte** : ne lit **jamais** `payments`. Ne retourne que des IDs + un tag.
- `grant execute … to authenticated`.

## Front
- `hooks/useFollow.ts` — **DB-backed** (remplace l'ancien mock store). API rétro-compatible (`following` / `toggle` / `followersCount` / `followingCount`) + explicite (`isFollowing` / `loading` / `follow` / `unfollow` / `toggleFollow` / `isSelf` / `canFollow`). Optimistic + rollback sur erreur. No-op si déconnecté ou `targetUserId` non-UUID.
- `components/FollowButton.tsx` — bouton « Suivre / ✓ Suivi » réutilisable (masqué sur son propre profil).
- `app/user-profile/[name].tsx` — si le paramètre de route est un **UUID**, résout le **vrai profil** (`users_public` via `useUsersByIds`) et cible le follow sur ce `users.id` réel → **persistance**. Chemin **mock legacy** (par nom) conservé en repli (`chevaux`/`concours`/`posts` mock affichés uniquement dans ce cas).
- **Navigation câblée sur de vrais `users.id`** (option C) : Communauté (`communaute` / `communaute-coach` / `communaute-org`, posts **et** commentaires via `auteurId`) + Services (`transport`/`box` via `auteurId`). C'est ce qui rend **cavalier→cavalier** réellement fonctionnel.

## Analytics
`follow_click` / `unfollow_click` (via `cta_click`, screen `follow`).

## Tests
Harness `supabase/tests/088_user_follows/harness.sql` (Postgres jetable) : **9/9 PASS** + rollback propre.
follow OK · auto-follow rejeté (check) · doublon rejeté (PK) · INSERT pour autrui bloqué (RLS) · SELECT authenticated OK · delete d'autrui sans effet (RLS) · unfollow own OK · `fn_people_i_know` rend les suivis directs · anti-énumération (`viewer ≠ auth.uid()` → erreur, admin autorisé).

## Limites connues / Dette
- **`users.club_name` absent** : la colonne club est sur la table legacy `public.profiles`, pas sur `public.users` → la source `club` de `fn_people_i_know` est **automatiquement ignorée**. À normaliser (table `clubs` dédiée) dans un lot futur.
- **`FollowListModal` encore mock** : lit toujours l'ancien store mock (`data/store`), déconnecté de `user_follows`. Hors périmètre PR1 — à brancher sur la DB.
- **Pas de compteur dénormalisé** : `followers/following` se lisent par `COUNT(*)` sur `user_follows` (volume faible attendu ; on a évité un trigger de plus).
- **Pas de notification de follow** ni de fil d'activité — prévu pour les lots suivants.

## Application prod
`supabase db query -f supabase/migrations/088_user_follows_graph.sql --linked` puis `supabase migration repair --status applied 088`. **Jamais `db push`.** Rollback : `088_user_follows_graph_rollback.sql` (drop RPC + table cascade).
Mig 088 **appliquée prod le 2026-06-30** (`vhkjvnpxcqlmpokrgymx`), historique `088 | 088 | 088`.

## Lots suivants (vision Hub Concours social)
- **PR2** — présence concours (`concours_presence`, déclarée puis détectée) + hero « X personnes que vous connaissez » (intersection `concours_presence` × `fn_people_i_know`).
- Puis : résultats crowdsourcés + kudos (l'« après »), progression/Wrapped, coach mis en avant, cartes concours sociales.
