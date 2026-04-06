# 🚀 Deployment & CI/CD Pipeline

## Overview

This project uses GitHub Actions for automated testing, building, and deployment to staging and production environments.

## Pipeline Stages

```
Push to main/develop
    ↓
├─ Lint & Type Check
├─ Test Suite (Unit + Integration)
├─ Security Tests (RLS, Auth)
├─ Database Migrations Check
    ↓
└─ Build Application
    ↓
    ├─ [develop] Deploy to Staging
    └─ [main] Deploy to Production
```

## Required GitHub Secrets

Set these in: **Settings → Secrets and variables → Actions**

### Supabase

```
SUPABASE_ACCESS_TOKEN_STAGING
SUPABASE_ACCESS_TOKEN_PROD
```

Get tokens from:
1. https://app.supabase.com/account/tokens
2. Create personal access token with project access

### Deployment URLs

```
STAGING_URL=https://staging.equishow.com
PROD_URL=https://equishow.com
```

### Slack Notifications

```
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

Create webhook:
1. Go to Slack workspace settings
2. Custom Integrations → Incoming Webhooks
3. Create new webhook for #deployments channel
4. Copy URL to GitHub secrets

### Firebase (Optional)

```
FIREBASE_TOKEN=token_here
```

Get token: `firebase login:ci`

## Branch Strategy

### `main` → Production
- Automatic deployment on every push
- Creates GitHub release
- Runs smoke tests
- Notifies Slack

### `develop` → Staging
- Automatic deployment on every push
- For pre-production testing
- Notifies Slack

### Feature Branches
- Run tests only
- No deployment
- PR required before merge to develop/main

## Workflow Execution

### What Runs on Every Push

1. **Lint & Type Check** (5-10 min)
   - TypeScript compilation
   - Code style validation

2. **Tests** (5-15 min)
   - Unit tests
   - Integration tests
   - Coverage report

3. **Security** (5-10 min)
   - RLS policy tests
   - Authentication tests
   - Vulnerability scanning

4. **Database** (1-2 min)
   - Migration validation
   - SQL syntax check

5. **Build** (10-20 min)
   - Web build
   - Android APK (optional)
   - iOS IPA (optional)

6. **Deployment** (5-10 min)
   - Only on main/develop
   - Upload artifacts
   - Notify Slack

**Total Time: ~30-60 minutes**

## Local Testing Before Push

```bash
# Run all tests locally first
npm run test:ci

# Lint check
npx tsc --noEmit

# Security tests
npm run test:rls
npm run test:auth

# Build locally
npx expo export --platform web
```

## Troubleshooting

### Tests Failing

```bash
# Run locally to debug
npm run test:watch

# Run specific test
npm run test:rls

# Check coverage
npm run test -- --coverage
```

### Build Failures

Check logs in: **Actions → [Workflow Run] → [Job Name]**

Common issues:
- Missing environment variables
- TypeScript compilation errors
- Missing dependencies

### Deployment Issues

1. Check Slack notifications for errors
2. View full logs in GitHub Actions
3. Verify Supabase token is valid
4. Check if migrations were applied

## Manual Deployment

If you need to deploy without pushing to git:

```bash
# Deploy to staging (develop branch)
supabase deploy --project-id=$STAGING_PROJECT_ID

# Deploy to production (main branch)
supabase deploy --project-id=$PROD_PROJECT_ID

# Notify team
# Post in #deployments on Slack
```

## Monitoring

### View Status
- Dashboard: https://github.com/username/equishow/actions
- Latest run: Shows pass/fail status
- Click run for detailed logs

### Set Up Slack Integration
- Get notified of failures instantly
- Track deployment history
- Subscribe to #deployments channel

### View Logs
1. GitHub Actions → [Workflow] → [Run]
2. Click job name to expand logs
3. Search for errors with Ctrl+F

## Rollback Strategy

If production deployment fails:

1. **Automatic Rollback**
   - If smoke tests fail, don't proceed
   - Previous version stays live

2. **Manual Rollback**
   ```bash
   # Revert to previous version
   git revert [bad-commit-hash]
   git push origin main
   ```

3. **Emergency Hotfix**
   - Push fix directly to main
   - Triggers immediate deployment
   - Notify team on Slack

## Deployment Checklist

Before merging to main:

- [ ] All tests pass locally
- [ ] No linting errors
- [ ] Security tests pass
- [ ] No breaking changes
- [ ] Database migrations tested
- [ ] CHANGELOG updated
- [ ] Code review approved
- [ ] Changelog entry added

## Performance Optimization

### Caching

Builds are cached to speed up workflows:
- Node modules (npm ci cache)
- Build artifacts
- Coverage reports

### Parallel Jobs

Jobs run in parallel when possible:
- Lint, Test, Security run simultaneously
- Build depends on all three

### Skip CI

To skip CI for a commit:
```bash
git commit --no-verify -m "chore: update docs [skip ci]"
```

## Contact

For deployment issues:
1. Check GitHub Actions logs
2. Check Slack #deployments
3. Contact: deployment-team@equishow.com

---

**Last Updated**: 2026-04-06
**Maintained By**: DevOps Team
