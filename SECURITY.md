# 🔐 Security & Credentials Management

## Credentials Policy

### ✅ SAFE TO COMMIT
- `SUPABASE_URL` - Project URL (public)
- `SUPABASE_ANON_KEY` - Anonymous key (public, limited permissions)
- Configuration templates (`.env.example`)

### ❌ NEVER COMMIT
- Real `.env` or `.env.local` files
- `SUPABASE_SERVICE_ROLE_KEY` (server-side only)
- Database passwords
- API keys for paid services
- Private tokens or secrets

## File Structure

```
equishow/
├── .env                    ❌ LOCAL ONLY (git ignored)
├── .env.local              ❌ LOCAL ONLY (git ignored)
├── .env.example            ✅ TEMPLATE ONLY (safe to commit)
└── .gitignore              ✅ Prevents accidental commits
```

## Setup Local Development

```bash
# 1. Copy template
cp .env.example .env.local

# 2. Edit with real Supabase keys from:
# https://app.supabase.com/project/YOUR_PROJECT/settings/api

# 3. Verify it's ignored
git status  # Should NOT show .env.local

# 4. Verify .gitignore has it
grep ".env" .gitignore
```

## Production Deployment

### GitHub Actions
```yaml
# Store in: Settings → Secrets and variables → Actions
env:
  SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
  SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
  SENTRY_DSN: ${{ secrets.SENTRY_DSN }}
```

### Supabase Edge Functions
```bash
# Deploy with environment variables
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=YOUR_KEY
supabase functions deploy --no-verify-jwt my-function
```

## Key Rotation Policy

### Incident Response: Exposed Credentials

If credentials are accidentally committed:

```bash
# 1. IMMEDIATELY rotate in Supabase Dashboard
# Settings → API → Regenerate Keys

# 2. Check git history for exposure
git log --all --full-history -- ".env" | head -20

# 3. If exposed, clean git history
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch .env' \
  --prune-empty --tag-name-filter cat -- --all

# 4. Force push to remove from history
git push origin --force --all
git push origin --force --tags

# 5. Verify it's gone
git log --all -- .env  # Should be empty

# 6. Monitor Supabase logs for unauthorized access
# Dashboard → Logs → Check for unusual activity

# 7. Document incident
# Create issue: "Security: Credentials exposed in commit ABC123"
```

## Supabase Key Types

### Anonymous Key (Public)
- ✅ Safe to commit
- ✅ Limited by RLS policies
- ✅ Used in client apps
- Usage: Expo app, web browsers

### Service Role Key (Private)
- ❌ NEVER commit
- ❌ Full database access
- ❌ Bypass RLS policies
- Usage: Backend servers, CI/CD only

## Environment-Specific Configuration

### Development
```bash
APP_ENV=development
SUPABASE_URL=https://dev.supabase.co
SENTRY_DSN=  # Optional
```

### Staging
```bash
APP_ENV=staging
SUPABASE_URL=https://staging.supabase.co
SENTRY_DSN=https://staging@sentry.io/123456
```

### Production
```bash
APP_ENV=production
SUPABASE_URL=https://prod.supabase.co
SENTRY_DSN=https://production@sentry.io/789012
# Everything in GitHub Secrets
```

## Security Checklist

- [ ] `.env.local` is in `.gitignore`
- [ ] No real credentials committed in git
- [ ] GitHub Secrets configured for CI/CD
- [ ] Service role key stored safely (backend only)
- [ ] Supabase API keys rotated monthly
- [ ] Monitoring enabled for unauthorized access
- [ ] Backup of production keys (encrypted, offline)
- [ ] Incident response plan documented
- [ ] Team trained on security practices

## Emergency Contacts

If credentials are compromised:

1. Notify team immediately on Slack: `#security-incidents`
2. Rotate all exposed keys in Supabase Dashboard
3. Check logs for unauthorized access
4. File security incident report
5. Post-mortem after 24 hours

---

**Last Updated**: 2026-04-06
**Responsible**: Dan (Project Owner)
**Review Frequency**: Quarterly
