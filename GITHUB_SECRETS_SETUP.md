# 🔐 GitHub Secrets Setup Guide

Configuration complète des secrets GitHub pour CI/CD sécurisé.

---

## 📋 WHAT ARE GITHUB SECRETS?

GitHub Secrets allows you to store sensitive information (API keys, credentials, tokens) **securely** without exposing them in your repository.

- ✅ **Encrypted**: Stored encrypted, only accessible to GitHub Actions
- ✅ **Masked in logs**: Automatically redacted from build logs
- ✅ **Revocable**: Can be rotated anytime
- ✅ **Auditable**: All access logged

---

## 🛠️ HOW TO ADD SECRETS

### Step 1: Go to GitHub Repository Settings

1. Open your repository: `https://github.com/YOUR_ORG/equishow`
2. Click **Settings** (top right)
3. Click **Secrets and variables** → **Actions** (left sidebar)

### Step 2: Create Each Secret

Click **New repository secret** for each value below:

---

## 📝 REQUIRED SECRETS

### 1. SUPABASE_ACCESS_TOKEN_STAGING

**What**: Supabase API token for staging deployments

**How to get**:
1. Go to https://app.supabase.com/account/tokens
2. Click **Generate new token**
3. Copy the token

**Name**: `SUPABASE_ACCESS_TOKEN_STAGING`  
**Value**: `your_token_here`

---

### 2. SUPABASE_ACCESS_TOKEN_PROD

**What**: Supabase API token for production deployments (MOST CRITICAL)

**How to get**:
1. Go to https://app.supabase.com/account/tokens
2. Click **Generate new token** (create separate from staging!)
3. Copy the token

**Name**: `SUPABASE_ACCESS_TOKEN_PROD`  
**Value**: `your_token_here`

⚠️ **CRITICAL**: This token should only have access to production project!

---

### 3. SUPABASE_SERVICE_ROLE_KEY

**What**: Supabase service role key (for backend operations)

**How to get**:
1. Go to Supabase Dashboard → Settings → API
2. Copy the **Service Role** key (NOT Anon key!)

**Name**: `SUPABASE_SERVICE_ROLE_KEY`  
**Value**: `eyJhbGc...`

⚠️ **NEVER expose in client code**

---

### 4. SLACK_WEBHOOK_URL

**What**: Slack webhook for CI/CD notifications

**How to get**:
1. Go to your Slack workspace
2. Create incoming webhook: https://api.slack.com/apps
3. Click "Create New App" → "From scratch"
4. Name: "Equishow CI/CD"
5. Select workspace
6. Go to "Incoming Webhooks" → Activate
7. "Add New Webhook to Workspace"
8. Select channel: #deployments
9. Copy the webhook URL

**Name**: `SLACK_WEBHOOK_URL`  
**Value**: `https://hooks.slack.com/services/...`

---

### 5. STRIPE_PUBLISHABLE_KEY (Optional)

**What**: Stripe public key (safe to expose, but better in Secrets)

**How to get**:
1. Go to https://dashboard.stripe.com/apikeys
2. Copy **Publishable key** (starts with `pk_`)

**Name**: `STRIPE_PUBLISHABLE_KEY`  
**Value**: `pk_test_...` or `pk_live_...`

---

### 6. SENTRY_DSN (Optional)

**What**: Sentry error tracking DSN

**How to get**:
1. Go to https://sentry.io
2. Select project
3. Settings → Client Keys (DSN)
4. Copy the DSN

**Name**: `SENTRY_DSN`  
**Value**: `https://key@sentry.io/project`

---

## ✅ COMPLETE CHECKLIST

```
REPOSITORY SECRETS (GitHub Settings → Secrets and variables → Actions):

☐ SUPABASE_ACCESS_TOKEN_STAGING
☐ SUPABASE_ACCESS_TOKEN_PROD
☐ SUPABASE_SERVICE_ROLE_KEY
☐ SLACK_WEBHOOK_URL
☐ STRIPE_PUBLISHABLE_KEY (optional)
☐ SENTRY_DSN (optional)

ORGANIZATION SECRETS (if using shared across repos):
☐ (Same as above, available to all repos)
```

---

## 🔒 SECURITY BEST PRACTICES

### DO ✅
- Rotate secrets every 3 months
- Use separate tokens for staging vs production
- Grant least privilege (minimal permissions)
- Audit who has access to secrets
- Log all uses of secrets
- Have a secret rotation plan

### DON'T ❌
- Never commit secrets to git
- Never paste secrets in Slack/Discord
- Never share in emails unencrypted
- Never use same secret for multiple environments
- Never grant unnecessary permissions
- Never forget to rotate after rotation

---

## 🔄 USING SECRETS IN CI/CD

Once secrets are added, they're automatically available in GitHub Actions:

```yaml
- name: Deploy to Supabase
  env:
    SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN_PROD }}
  run: supabase deploy
```

The secret is:
- ✅ Available as environment variable
- ✅ Automatically masked in logs (`***`)
- ✅ Encrypted in transit
- ✅ Only accessible to Actions

---

## 🚨 EMERGENCY: SECRET LEAKED?

If a secret is exposed:

1. **IMMEDIATELY revoke it**:
   - Supabase: Generate new token at https://app.supabase.com/account/tokens
   - Stripe: Rotate keys at https://dashboard.stripe.com/apikeys
   - Slack: Delete webhook at https://api.slack.com/apps

2. **Update GitHub Secrets**:
   - Add new secret with new value
   - Delete old secret

3. **Audit logs**:
   - Check if secret was used maliciously
   - Monitor for unauthorized deployments

4. **Notify team**:
   - Post in Slack #security channel
   - Document incident
   - Update security procedures

---

## 📖 REFERENCE

- [GitHub Docs: Using secrets](https://docs.github.com/en/actions/security-guides/using-secrets-in-github-actions)
- [Supabase Tokens](https://app.supabase.com/account/tokens)
- [Stripe API Keys](https://dashboard.stripe.com/apikeys)
- [Slack Webhooks](https://api.slack.com/apps)

---

**✅ COMPLETE THIS SETUP BEFORE PRODUCTION DEPLOYMENT**

Without proper secrets management, you risk:
- 🔴 Credential exposure
- 🔴 Unauthorized deployments
- 🔴 Data breaches
- 🔴 Service takeover

---

**Status**: Required for production  
**Effort**: 15-30 minutes  
**Priority**: 🔴 CRITICAL
