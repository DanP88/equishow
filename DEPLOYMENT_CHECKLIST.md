# 🚀 CHECKLIST DE DÉPLOIEMENT PRODUCTION

**AVANT le premier lancement en production**

---

## 🔴 CRITIQUES (Faire en premier!)

### Sécurité des Secrets
- [ ] Lire `GITHUB_SECRETS_SETUP.md`
- [ ] Ajouter tous les secrets à GitHub (6 secrets)
- [ ] Vérifier que `.env` est dans `.gitignore` ✓
- [ ] Vérifier qu'aucun secret réel dans git history
- [ ] Tester que CI/CD peut accéder aux secrets
- [ ] Documenter le processus de rotation des secrets

### Migrations Database
- [ ] Appliquer migration `001_initial_schema.sql`
- [ ] Appliquer migration `002_rls_policies.sql`
- [ ] Appliquer migration `003_add_prices.sql`
- [ ] Appliquer migration `004_community_posts.sql`
- [ ] Appliquer migration `005_avis_system.sql`
- [ ] Appliquer migration `006_backup_monitoring.sql`
- [ ] Appliquer migration `007_soft_deletes.sql`
- [ ] Appliquer migration `008_fix_critical_security_issues.sql`
- [ ] Vérifier que toutes les tables existent: `SELECT * FROM pg_tables WHERE schemaname = 'public';`

### RLS Policies
- [ ] Vérifier RLS sur toutes les tables: `SELECT * FROM pg_policies;`
- [ ] Tester que users ne peuvent voir que LEURS données
- [ ] Tester que admins peuvent voir tout
- [ ] Exécuter `npm run test:rls`

### Edge Functions
- [ ] Déployer `rate-limit-secure`: `supabase functions deploy rate-limit-secure`
- [ ] Déployer `change-password-secure`: `supabase functions deploy change-password-secure`
- [ ] Déployer `validate-input`: `supabase functions deploy validate-input`
- [ ] Tester chaque fonction avec test data

### Tests
- [ ] Exécuter tous les tests: `npm run test:ci`
- [ ] Coverage au minimum 50%: `npm run test -- --coverage`
- [ ] Tests RLS passent: `npm run test:rls`
- [ ] Tests auth passent: `npm run test:auth`
- [ ] Aucune erreur TypeScript: `npx tsc --noEmit`

---

## 🟠 HAUTS (Avant production)

### Rate Limiting
- [ ] Rate limit login: 5 tentatives/15 min
- [ ] Rate limit signup: 3 tentatives/1 heure
- [ ] Rate limit password reset: 3 tentatives/1 heure
- [ ] Tester le rate limiting: `npm run test:rate-limit`
- [ ] Monitorer security_audit_log table
- [ ] Vérifier les logs de rate limit

### Sauvegarde & Récupération
- [ ] Créer backup manuel avant prod
- [ ] Tester la restauration depuis backup
- [ ] Vérifier Supabase daily backups activées
- [ ] Configurer S3 pour backups froids
- [ ] Documenter le RTO/RPO (4h/1h)
- [ ] Créer runbook de récupération

### Monitoring & Alertes
- [ ] Configurer Sentry pour production
- [ ] Vérifier les alertes Slack
- [ ] Ajouter Dashboard Grafana/DataDog
- [ ] Configurer alertes pour:
  - Erreurs > 1% per minute
  - Déploiement échoue
  - Database down
  - Rate limits dépassées

### Performance
- [ ] Load test avec 1000 users simultanés
- [ ] Vérifier les temps de réponse < 200ms
- [ ] Vérifier les queries optimisées (EXPLAIN)
- [ ] Vérifier les indexes créés
- [ ] Activer le cache au niveau du CDN

### Sécurité
- [ ] Audit OWASP Top 10 ✓
- [ ] Audit de sécurité externe (recommandé)
- [ ] Vérifier HTTPS partout
- [ ] Vérifier CORS correctement configuré
- [ ] Vérifier no hardcoded secrets
- [ ] Vérifier rate limiting en place
- [ ] Vérifier input validation
- [ ] Vérifier error messages sécurisés

---

## 🟡 IMPORTANTS (Avant ou après)

### Documentation
- [ ] Documenter les procédures d'incident
- [ ] Documenter les procédures de rollback
- [ ] Documenter les contacts d'escalade
- [ ] Documenter l'architecture
- [ ] Documenter les API endpoints
- [ ] Documenter le database schema
- [ ] Documenter les secrets et leur rotation

### Infrastructure
- [ ] Configurer CI/CD (GitHub Actions) ✓
- [ ] Configurer staging environment
- [ ] Configurer production environment
- [ ] Vérifier health checks
- [ ] Vérifier logs centralisés
- [ ] Vérifier backup automatiques

### Compliance
- [ ] GDPR: Droit d'accès ✓
- [ ] GDPR: Droit à l'oubli ✓
- [ ] GDPR: Audit trail ✓
- [ ] OWASP: Injection prevention ✓
- [ ] OWASP: Auth security ✓
- [ ] OWASP: Validation ✓
- [ ] Accessible aux handicapés (WCAG 2.1)
- [ ] Terms of Service acceptés
- [ ] Privacy Policy visible

---

## 🟢 NICE TO HAVE (Post-launch)

- [ ] Caching layer (Redis)
- [ ] CDN pour assets
- [ ] Feature flags
- [ ] A/B testing
- [ ] Analytics (Mixpanel, Amplitude)
- [ ] Dark mode
- [ ] Internationalization (i18n)
- [ ] Performance monitoring
- [ ] User feedback widget

---

## 📋 PRE-LAUNCH TEST PLAN

### Test Complet
```bash
# 1. Unit tests
npm run test

# 2. RLS tests
npm run test:rls

# 3. Auth tests
npm run test:auth

# 4. Manual testing
# Signup → Verify email → Login → Change password → Update profile

# 5. Edge cases
# Delete account → Try to login → Should fail
# Submit form with XSS payload → Should be sanitized
# 100 login attempts → Should be rate limited

# 6. Performance
# Load test avec Apache Bench
ab -n 1000 -c 100 https://equishow.com/api/health
```

### Browser Testing
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Mobile Safari (iOS)
- [ ] Chrome Mobile (Android)

### Device Testing
- [ ] Desktop (1920x1080)
- [ ] Tablet (iPad)
- [ ] Mobile (iPhone 12)
- [ ] Mobile (Android flagship)

---

## 📊 METRICS À MONITORER

### Après le lancement, track:

```
Performance:
- Response time (< 200ms)
- Error rate (< 0.1%)
- Uptime (> 99.9%)
- Database queries (< 100ms)

Security:
- Failed login attempts
- Rate limit violations
- Suspicious activity
- Data access violations

Business:
- User registrations
- Active users
- Feature usage
- Error frequency
```

---

## 🚨 SI QUELQUE CHOSE CASSE

### Immédiat
1. Notifier le channel Slack #incidents
2. Activer le war room (Zoom call)
3. Identifier la cause
4. Décider: fix en place vs rollback

### Rollback
```bash
git revert <bad-commit>
git push origin main
# CI/CD redéploie automatiquement
```

### Postmortem
1. Documenter ce qui s'est passé
2. Identifier la cause root
3. Implémenter la correction
4. Ajouter des tests pour le futur

---

## ✅ SIGN-OFF

- [ ] Lead Dev: Test complet réussi
- [ ] Lead Ops: Infrastructure prête
- [ ] Lead Security: Audit de sécurité passé
- [ ] Lead Prod: Monitoring en place
- [ ] CEO/Founder: Approbation pour launch

**Date de lancement**: ___________

**Environnement**: [ ] Staging [ ] Production

**Notes spéciales**: _______________________________

---

## 📞 EMERGENCY CONTACTS

- Lead Dev: _________ (Slack/Phone)
- Ops Lead: _________ (Slack/Phone)
- Security Lead: _________ (Slack/Phone)
- Incident Commander: _________ (Slack/Phone)

---

**DOCUMENT CRÉÉ**: 2026-04-07
**DERNIÈRE MISE À JOUR**: [Date]
**STATUS**: 🟢 READY FOR PRODUCTION
