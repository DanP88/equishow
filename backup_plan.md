# Backup & Infrastructure Plan - Equishow

## 📊 Supabase Project
- **Project**: equishow (wdhgsuulsuwdrtbvetaf)
- **Region**: us-east-1
- **Status**: ACTIVE_HEALTHY
- **Database**: PostgreSQL 17.6.1.104

## 🗄️ Database Schema
Tables à créer:
1. users (cavaliers, coaches, organisateurs)
2. chevaux
3. concours
4. coach_annonces
5. transport_annonces
6. box_annonces
7. notifications
8. disponibilites

## 🔄 N8N Workflows
- Daily data sync from local store to Supabase
- Real-time notification triggers
- Backup exports to S3/Cloud Storage

## 💾 Backup Strategy
- Daily SQL dumps
- Weekly archive exports
- Version control: Git + GitHub

## 🚀 Deployment
- Supabase for database & auth
- Edge Functions for business logic
- Real-time subscriptions
