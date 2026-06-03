# Tests sécurité financière — Migration 051

Scripts rejouables pour auditer la protection des montants des réservations
(course / stage / box / transport) introduite par
`supabase/migrations/051_financial_amounts_authoritative.sql`.

## Failles couvertes
- **B1** — INSERT à prix arbitraire (transport).
- **S5** — UPDATE post-INSERT des montants (4 modules).
- **S2** — `seller_id` / `coach_id` client-trusted.

## Exécution
Tous les scripts se lancent en lecture/écriture **annulée** (transaction `rollback`),
donc **sans modifier la prod**. Projet lié = `vhkjvnpxcqlmpokrgymx`.

```bash
# 1) Audit des données existantes (montant stocké ≠ recalculé, seller/coach incohérent)
supabase db query --linked -f supabase/tests/051_financial_amounts/audit.sql

# 2) Vérification post-déploiement : rejoue les fraudes contre les triggers/policies LIVE
supabase db query --linked -f supabase/tests/051_financial_amounts/verify_postdeploy.sql

# 3) Démonstration AVANT (fraudes réussies si la 051 n'était pas déployée)
supabase db query --linked -f supabase/tests/051_financial_amounts/demo_avant.sql
```

## Fichiers
| Fichier | Rôle |
|---|---|
| `audit.sql` | Détection d'anomalies financières sur données réelles (doit renvoyer 0 anomalie). |
| `harness.sql` | Jeu de 12 tests (T4–T8, B1+S5, S2, location, non-régression). À jouer **après** le DDL 051 dans la même transaction. |
| `verify_postdeploy.sql` | `begin;` + `harness.sql` : rejoue les 12 tests contre les objets **déjà déployés**. |
| `demo_avant.sql` | Rejoue les fraudes **sans** la 051 → prouve l'exploitabilité (avant/après). |

## Résultat attendu
`verify_postdeploy.sql` → **12/12 PASS** ; `audit.sql` → **0 anomalie**.

## IDs utilisés (snapshot prod 2026-06-03)
Acheteur `93947e0c…` ; course `833f252b…` (218,00) ; stage `51840226…` (545,00) ;
box `ca5f403c…` (94,50) ; transport route-priced `0d18a272…` (1655,64) ;
annonce trajet `5b273461…` ; annonce location `89acbf43…`.
Adapter si les seeds changent.
