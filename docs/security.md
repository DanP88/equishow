# Sécurité — Equishow

## Principes

1. **Deny by default** — RLS activé sur toutes les tables, 0 accès sans policy.
2. **Zéro confiance frontend** — sécurité dans la DB, jamais dans Flutter.
3. **Zéro clé sensible côté client** — seule la clé `anon` dans Flutter.

## Variables d'environnement

| Variable                    | Flutter | CI/Backend |
|-----------------------------|---------|------------|
| `SUPABASE_URL`              | ✅      | ✅         |
| `SUPABASE_ANON_KEY`         | ✅      | ✅         |
| `SUPABASE_SERVICE_ROLE_KEY` | ❌      | ✅         |

## Modèle RLS

| Table              | Utilisateur | Admin   |
|--------------------|-------------|---------|
| `profiles`         | Ses données | Tout    |
| `roles`            | Lecture     | CRUD    |
| `user_consents`    | Ses données | Lecture |
| `audit_logs`       | ❌          | Lecture |
| `security_events`  | Ses events  | Tout    |
| `analytics_events` | Insert      | Lecture |
| `activity_logs`    | Ses logs    | Lecture |

## RGPD

- IPs et user-agents : stockés hashés (SHA-256) uniquement
- Tokens : `flutter_secure_storage` (Keychain / Keystore)
- Droit à l'oubli : `ON DELETE CASCADE` depuis `auth.users`
- Consentement requis avant analytics (`rgpd_analytics`)
