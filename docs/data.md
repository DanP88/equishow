# Données — Equishow

## Tables structurantes

| Table              | Rôle                                         |
|--------------------|----------------------------------------------|
| `profiles`         | Profil cavalier/propriétaire (auth.users)    |
| `roles`            | cavalier / propriétaire / entraineur / admin |
| `user_consents`    | Consentements RGPD versionnés                |
| `audit_logs`       | Journal immuable des actions critiques       |
| `security_events`  | Événements de sécurité                       |
| `analytics_events` | Événements produit                           |
| `activity_logs`    | Actions métier tracées                       |

## Conventions analytics

Format event_name : `{objet}_{action}` en snake_case

| Catégorie      | Exemples                                        |
|----------------|-------------------------------------------------|
| `navigation`   | `screen_view`, `tab_switched`                   |
| `interaction`  | `button_tap`, `form_submitted`                  |
| `conversion`   | `cheval_added`, `concours_entered`, `reservation_created` |
| `error`        | `api_error`, `form_validation_error`            |

## RGPD

- Conservation `analytics_events` : 13 mois (à implémenter via pg_cron)
- Conservation `audit_logs` : 5 ans
- Suppression profil → cascade sur toutes les tables liées
