# Architecture — Equishow

## Stack

| Couche       | Technologie                           |
|--------------|---------------------------------------|
| Mobile       | Flutter (Dart) + Riverpod + go_router |
| Backend/DB   | Supabase (PostgreSQL + Auth + Storage)|
| Déploiement  | App stores (iOS / Android)            |

## Structure Flutter

```
lib/
├── main.dart                    # Entrypoint + init Supabase
├── core/
│   ├── config/
│   │   └── env.dart             # Variables --dart-define
│   ├── router/
│   │   └── app_router.dart      # go_router + auth guard
│   ├── services/
│   │   ├── supabase_service.dart
│   │   ├── auth_service.dart
│   │   └── api_client.dart
│   ├── theme/
│   │   ├── app_colors.dart      # Orange Equistra #F97316
│   │   └── app_theme.dart
│   ├── utils/
│   │   └── logger.dart
│   └── widgets/
└── features/
    ├── auth/          # domain / data / presentation
    ├── chevaux/
    ├── concours/
    ├── planning/
    ├── agenda/
    ├── reservation/
    ├── transport/
    ├── communaute/
    ├── messagerie/
    ├── profil/
    ├── abonnement/
    └── paiement/
```

## Structure Supabase

```
supabase/
├── config.toml
├── seed.sql
└── migrations/
    ├── 001_init_schema.sql
    ├── 002_rls_policies.sql
    └── 003_analytics_events.sql
```

## Règles d'architecture

1. Jamais d'appel direct à `supabase.from()` hors d'un repository `data/`
2. Jamais de logique métier dans les widgets
3. Jamais de clé sensible dans Flutter (voir `env.dart`)
4. RLS actif sur toute table exposée au client
5. Modèles `domain/` = 0 dépendance Supabase
