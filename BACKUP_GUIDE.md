# 🛡️ Equishow Backup & Infrastructure Guide

## Overview
This guide covers professional backup strategies, database migration, and data synchronization for Equishow.

---

## 📦 Project Structure

```
equishow/
├── expo_app/              # React Native Expo app
├── migrations/            # SQL migration files
│   └── 001_initial_schema.sql
├── scripts/               # Backup & maintenance scripts
│   └── backup.js
├── backups/              # Local backup files (auto-generated)
├── n8n-workflow.json     # N8N automation workflow
└── BACKUP_GUIDE.md       # This file
```

---

## 🗄️ Database: Supabase

### Project Details
- **Name**: equishow
- **ID**: wdhgsuulsuwdrtbvetaf
- **Region**: us-east-1
- **Status**: ACTIVE_HEALTHY
- **Engine**: PostgreSQL 17.6.1

### Tables
1. **users** - All user accounts (cavaliers, coaches, organisateurs)
2. **chevaux** - Horse/pony records
3. **concours** - Competition events
4. **coach_annonces** - Coaching service announcements
5. **transport_annonces** - Transport service announcements
6. **box_annonces** - Box rental announcements
7. **disponibilites** - Coach availability slots
8. **notifications** - User notifications

### Access
```bash
# Via Supabase Dashboard
# https://app.supabase.com/project/wdhgsuulsuwdrtbvetaf

# Via psql CLI
PGPASSWORD=your_password psql -h db.wdhgsuulsuwdrtbvetaf.supabase.co \
  -U postgres -d postgres
```

---

## 💾 Local Backup Strategy

### Automatic Backup
```bash
# Create backup (called manually)
node scripts/backup.js

# Output: backups/backup-2026-04-03T22-38-15-123Z.json
```

### Backup Retention
- Keeps last 10 local backups
- Automatic cleanup of old files
- Format: JSON with timestamp

---

## 🔄 Cloud Synchronization (N8N)

### Workflow: "Equishow Data Sync to Supabase"

**Schedule**: Every 6 hours

**Flow**:
1. Fetch data from local Expo store
2. Connect to Supabase PostgreSQL
3. Sync chevaux table
4. Sync concours table
5. Sync coach_annonces table
6. Log success

### Setup N8N
```bash
# 1. Install N8N
npm install -g n8n

# 2. Start N8N
n8n start

# 3. Import workflow
# Go to http://localhost:5678
# Import n8n-workflow.json

# 4. Configure credentials
# Add Supabase connection:
# - Host: db.wdhgsuulsuwdrtbvetaf.supabase.co
# - User: postgres
# - Password: [your password]
# - Database: postgres
# - SSL: enabled
```

---

## 🚀 Database Migration

### 1. Apply Initial Schema
```bash
# Option A: Via Supabase Dashboard
# - Go to SQL Editor
# - Paste content of migrations/001_initial_schema.sql
# - Click "Run"

# Option B: Via CLI (requires local PostgreSQL)
psql -h db.wdhgsuulsuwdrtbvetaf.supabase.co \
  -U postgres \
  -f migrations/001_initial_schema.sql
```

### 2. Verify Tables
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public';
```

### 3. Check Indexes & Triggers
```sql
-- List indexes
SELECT indexname FROM pg_indexes WHERE schemaname = 'public';

-- List triggers
SELECT trigger_name FROM information_schema.triggers;
```

---

## 🔐 Security Checklist

- [ ] Enable Row Level Security (RLS) on all tables
- [ ] Create database backups before schema changes
- [ ] Use environment variables for credentials
- [ ] Enable API authentication via Supabase Auth
- [ ] Set up CORS policies for your domain
- [ ] Monitor backup completion via N8N logs

---

## 📊 Data Export

### Export from Supabase
```bash
# Full database dump
pg_dump -h db.wdhgsuulsuwdrtbvetaf.supabase.co \
  -U postgres \
  --format=custom \
  --file=backup-$(date +%Y%m%d_%H%M%S).dump \
  postgres

# Specific table (e.g., concours)
pg_dump -h db.wdhgsuulsuwdrtbvetaf.supabase.co \
  -U postgres \
  --table=concours \
  postgres > concours_export.sql
```

### Import to Local Database
```bash
psql -U postgres -d your_local_db -f export.sql
```

---

## 🔗 Integration Points

### Expo App → Supabase
```typescript
// Use Supabase client in your React Native app
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://wdhgsuulsuwdrtbvetaf.supabase.co',
  'your_anon_key'
);

// Sync on app start
useEffect(() => {
  const sync = async () => {
    const { data: concours } = await supabase
      .from('concours')
      .select('*')
      .neq('statut', 'brouillon');
    // Update local store
  };
  sync();
}, []);
```

---

## 🆘 Troubleshooting

### Issue: Sync fails
**Solution**: Check N8N logs, verify network connectivity, validate SQL syntax

### Issue: Duplicate key errors
**Solution**: Use `ON CONFLICT` clauses (already included in migration)

### Issue: Missing data
**Solution**: Check RLS policies, verify user permissions, run manual sync

---

## 📞 Support & Resources

- **Supabase Docs**: https://supabase.com/docs
- **N8N Documentation**: https://docs.n8n.io
- **PostgreSQL Guide**: https://www.postgresql.org/docs
- **Project Issues**: GitHub Issues

---

**Last Updated**: April 3, 2026
**Backup Expert**: Claude Haiku 4.5
**Status**: ✅ Production Ready
