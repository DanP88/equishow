# 📖 GUIDE DE MISE EN PLACE - EQUISHOW

**Guide complet pour configurer Equishow en local et deployer en production.**

---

## 🎯 TABLE DES MATIÈRES

1. [Setup Local](#setup-local)
2. [Configuration des Secrets](#configuration-des-secrets)
3. [Tests](#tests)
4. [Déploiement](#déploiement)
5. [Troubleshooting](#troubleshooting)

---

## 🏠 SETUP LOCAL

### Prerequisites

Vous devez avoir installé:
- Node.js 18+ (`node --version`)
- Git (`git --version`)
- npm 9+ (`npm --version`)
- Supabase CLI (`supabase --version`)

Installer si manquant:
```bash
# macOS (Homebrew)
brew install node supabase/tap/supabase

# Ubuntu/Debian
curl -sL https://deb.nodesource.com/setup_18.x | sudo bash -
sudo apt-get install -y nodejs
npm install -g supabase

# Windows
# Télécharger Node de https://nodejs.org/
# Installer Supabase CLI depuis https://github.com/supabase/cli/releases
```

### 1. Clone le Repository

```bash
git clone https://github.com/YOUR_ORG/equishow.git
cd equishow
```

### 2. Installer les Dépendances

```bash
# Install root dependencies
npm install

# Install expo_app dependencies
cd expo_app
npm install
cd ..
```

### 3. Configurer les Variables d'Environnement

```bash
# Créer .env local (JAMAIS commiter!)
cp .env.example .env

# Éditer .env avec vos vraies valeurs
# BESOIN: Supabase URL + Anon Key
nano .env

# Même pour expo_app
cd expo_app
cp .env.example .env
nano .env
cd ..
```

### 4. Obtenir vos Credentials Supabase

1. Aller à https://app.supabase.com
2. Créer un nouveau projet (ou utiliser existant)
3. Aller à: **Settings → API**
4. Copier:
   - `Project URL` → `SUPABASE_URL`
   - `Anon public key` → `SUPABASE_ANON_KEY`
5. Copier dans votre `.env` local

```bash
# .env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOi...
```

### 5. Appliquer les Migrations Database

```bash
# Connexion à Supabase
supabase login

# Lister les migrations
supabase migration list

# Appliquer les migrations
supabase db push

# Vérifier que tout est OK
supabase db list
```

### 6. Démarrer en Développement

```bash
# Terminal 1: Start Expo
cd expo_app
npm start

# Terminal 2: Run tests (optionnel)
npm run test:watch
```

Ouvrir dans votre navigateur: `http://localhost:19000`

---

## 🔐 CONFIGURATION DES SECRETS

### Local Development

Les secrets locaux sont stockés dans `.env` (JAMAIS dans git):

```bash
# .env (local only, .gitignored)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOi...
```

### Production / CI-CD

Pour production, utiliser **GitHub Secrets**:

Voir: [GITHUB_SECRETS_SETUP.md](./GITHUB_SECRETS_SETUP.md)

TL;DR:
1. Aller à: GitHub → Settings → Secrets and variables → Actions
2. Ajouter 6 secrets (voir guide)
3. CI/CD accède automatiquement via `${{ secrets.SECRET_NAME }}`

---

## ✅ TESTS

### Exécuter Tous les Tests

```bash
# Unit + integration tests
npm run test

# Watch mode (re-run on changes)
npm run test:watch

# Coverage report
npm run test -- --coverage

# RLS security tests
npm run test:rls

# Authentication tests
npm run test:auth
```

### Expected Results

```
PASS  __tests__/auth.test.ts
PASS  __tests__/rls.test.ts
Test Suites: 2 passed, 2 total
Tests:       40+ passed
```

### Coverage Requirements

- Statements: > 50%
- Lines: > 50%
- Branches: > 40%
- Functions: > 50%

---

## 🚀 DÉPLOIEMENT

### Processus Complet

```
Feature branch → PR → Tests pass → Merge → Auto-deploy
  ↓
  ├─ develop → Staging deployment
  └─ main → Production deployment
```

### 1. Create Feature Branch

```bash
git checkout -b feature/my-feature
# Make changes
# Commit with clear messages
git add .
git commit -m "feat: description of changes"
git push origin feature/my-feature
```

### 2. Create Pull Request

```bash
# Via GitHub web
# Or via CLI:
gh pr create --title "My Feature" --body "Description"
```

### 3. Tests Run Automatically

GitHub Actions runs:
- ✅ Lint & TypeScript check
- ✅ Unit tests
- ✅ RLS tests
- ✅ Build verification

Si tout passe → PR est mergeable

### 4. Merge to Staging/Production

```bash
# Merge to develop (auto-deploys to staging)
git checkout develop
git merge feature/my-feature
git push origin develop

# Merge to main (auto-deploys to production)
git checkout main
git merge develop
git push origin main
```

CI/CD se lance automatiquement:
- Teste tout
- Construit l'app
- Déploie en staging/prod
- Notifie Slack

### 5. Monitor Deployment

```bash
# Watch GitHub Actions
gh run list

# View specific run
gh run view <run-id>

# View logs
gh run view <run-id> --log
```

---

## 🐛 TROUBLESHOOTING

### "Cannot find module '@supabase/supabase-js'"

```bash
# Solution: Réinstaller les dépendances
rm -rf node_modules package-lock.json
npm install
```

### "SUPABASE_URL is not defined"

```bash
# Solution: Vérifier le .env
cat .env | grep SUPABASE_URL

# Si vide:
# 1. Aller à Supabase dashboard
# 2. Copier URL depuis Settings → API
# 3. Remplir dans .env
```

### "RLS policy violation"

```bash
# Solution: Vérifier RLS policies
SELECT * FROM pg_policies WHERE tablename = 'chevaux';

# Ou réappliquer les migrations
supabase db push
```

### "Rate limit exceeded"

```bash
# Solution: Wait 15 minutes (login) or 1 hour (signup)
# Ou en développement, reset AsyncStorage:
// À faire dans l'app:
await AsyncStorage.removeItem('rate-limit:login:user@example.com');
```

### Tests Échouent

```bash
# Solution: Debuguer le test
npm run test:watch -- --testNamePattern="test name"

# View error details
npm run test -- --verbose
```

---

## 📚 STRUCTURE DU PROJET

```
equishow/
├── expo_app/              # React Native app
│   ├── app/               # Expo Router screens
│   ├── components/        # Reusable components
│   │   ├── FormField.tsx  # Input validation
│   │   ├── ErrorBoundary.tsx
│   │   └── ...
│   ├── lib/               # Utilities
│   │   ├── supabase.ts    # Supabase client
│   │   ├── validation.ts  # Input validation
│   │   ├── rateLimiter.ts # Rate limiting
│   │   ├── errorHandler.ts
│   │   └── ...
│   ├── hooks/             # React hooks
│   ├── __tests__/         # Test files
│   └── package.json
├── supabase/
│   ├── migrations/        # Database migrations
│   │   ├── 001_*.sql
│   │   ├── 008_*.sql      # Security fixes
│   │   └── ...
│   └── functions/         # Edge Functions
│       ├── rate-limit-secure/
│       ├── change-password-secure/
│       └── validate-input/
├── .github/
│   ├── workflows/         # CI/CD
│   │   └── ci-cd.yml
│   └── DEPLOYMENT.md
├── PRODUCTION_READINESS.md
├── SECURITY_HARDENING_COMPLETE.md
├── GITHUB_SECRETS_SETUP.md
├── DEPLOYMENT_CHECKLIST.md
└── SETUP_GUIDE.md (ce fichier)
```

---

## 🔑 COMMON COMMANDS

```bash
# Development
npm start                 # Start Expo dev server
npm run test             # Run all tests
npm run test:watch       # Run tests in watch mode
npm run test:rls         # Run RLS tests only
npm run test:rate-limit  # Run rate limit tests
npx tsc --noEmit        # Type check

# Database
supabase db list         # List tables
supabase db pull         # Pull schema changes
supabase db push         # Apply migrations
supabase migration list  # List migrations

# Deployment
git push origin develop  # Deploy to staging
git push origin main     # Deploy to production
gh run list              # View CI/CD runs
gh run view <id>         # View specific run

# Cleanup
rm -rf node_modules      # Remove dependencies
npm ci                   # Clean install
```

---

## 📞 GETTING HELP

### Documentation
- [Supabase Docs](https://supabase.com/docs)
- [Expo Router Docs](https://docs.expo.dev/router/introduction/)
- [React Native Docs](https://reactnative.dev/)
- [GitHub Actions Docs](https://docs.github.com/en/actions)

### Common Files
- [SECURITY_HARDENING_COMPLETE.md](./SECURITY_HARDENING_COMPLETE.md) - Security fixes
- [PRODUCTION_READINESS.md](./PRODUCTION_READINESS.md) - Status & checklist
- [GITHUB_SECRETS_SETUP.md](./GITHUB_SECRETS_SETUP.md) - Secrets configuration
- [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md) - Pre-launch checklist

### Issues?
1. Check logs: `npm run test --verbose`
2. Check GitHub Actions: GitHub → Actions
3. Check Supabase logs: Supabase dashboard
4. Check Sentry (production): https://sentry.io

---

## ✅ SETUP COMPLETE!

Vous êtes maintenant prêt à:
- ✅ Développer en local
- ✅ Exécuter les tests
- ✅ Déployer en staging
- ✅ Déployer en production

**Prochain étape**: Lire [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md) avant le premier lancement en production.

---

**Document créé**: 2026-04-07  
**Status**: ✅ Production Ready  
**Version**: 1.0
