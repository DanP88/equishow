# Conventions — Equishow

## Flutter / Dart

| Élément               | Convention          | Exemple                     |
|-----------------------|---------------------|-----------------------------|
| Fichiers              | `snake_case.dart`   | `cheval_edit_sheet.dart`    |
| Classes               | `PascalCase`        | `ChevalEditSheet`           |
| Variables / fonctions | `camelCase`         | `currentUser`, `signIn()`   |
| Providers Riverpod    | `camelCaseProvider` | `authServiceProvider`       |
| Widgets privés        | `_PascalCase`       | `_ObligatoireBloc`          |

## SQL

- Tables : `snake_case` pluriel
- PKs : `id uuid default gen_random_uuid()`
- FKs : `{table_singulier}_id`
- Timestamps : `created_at`, `updated_at` (timestamptz not null)
- Index : `idx_{table}_{colonne}`
- Policies RLS : `"{table}_{action}_{scope}"`

## Git / Branches

| Branche   | Usage                              |
|-----------|------------------------------------|
| `main`    | Production, protégée, PR required  |
| `develop` | Intégration                        |
| `feat/*`  | Fonctionnalité                     |
| `fix/*`   | Correction                         |
| `sql/*`   | Migrations Supabase                |

## Commits

Format : `type(scope): description`

```
feat(chevaux): ajout sélecteur type Cheval/Poney
fix(planning): boutons non cliquables sur fond transparent
sql(rls): policies analytics_events
```
