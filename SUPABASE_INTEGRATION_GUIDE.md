# 🚀 Supabase Integration Guide - Equishow

## Overview

This guide covers the integration of Supabase into the Equishow Expo app for real data persistence, authentication, and real-time synchronization.

---

## 📋 What Was Created

### 1. **Core Supabase Client** (`lib/supabase.ts`)
- Initializes Supabase client with auto-refresh tokens
- Type definitions for database tables
- Helper functions: signUp, signIn, signOut, getUserProfile
- Real-time subscription utilities

### 2. **Authentication Hook** (`hooks/useSupabaseAuth.ts`)
- Manages session state
- Auto-refresh tokens
- Routes based on auth state
- Handles auth events

### 3. **Data Sync Hook** (`hooks/useSyncData.ts`)
- Real-time data fetching with filtering
- Auto-subscribe to table changes
- INSERT, UPDATE, DELETE tracking
- Single item sync hook

### 4. **Mutation Hook** (`hooks/useMutateData.ts`)
- Create items
- Update items
- Delete items
- Batch operations

### 5. **Environment Configuration** (`.env.example`)
- Supabase credentials
- API configuration
- Monitoring setup

---

## 🔧 Setup Instructions

### Step 1: Get Supabase Credentials

1. Go to https://app.supabase.com/project/wdhgsuulsuwdrtbvetaf/settings/api
2. Copy:
   - **Project URL**: `https://wdhgsuulsuwdrtbvetaf.supabase.co`
   - **Anon Public Key**: (labeled "anon - public")
   - **Service Role Key**: (labeled "service_role - secret")

### Step 2: Configure Environment Variables

```bash
# Copy template
cp expo_app/.env.example expo_app/.env

# Edit .env with your credentials
EXPO_PUBLIC_SUPABASE_URL=https://wdhgsuulsuwdrtbvetaf.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_key_here
```

### Step 3: Install Dependencies

```bash
cd expo_app
npm install @supabase/supabase-js
```

### Step 4: Apply Database Migrations

In Supabase Dashboard:
1. Go to **SQL Editor**
2. Click **New Query**
3. Paste content from `migrations/001_initial_schema.sql`
4. Click **Run**

Verify tables are created:
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public';
```

### Step 5: Restart Expo

```bash
cd expo_app
expo start --clear
```

---

## 💻 Usage Examples

### Authentication

```typescript
import { useSupabaseAuth } from './hooks/useSupabaseAuth';

export default function LoginScreen() {
  const { isSignedIn, user, isLoading } = useSupabaseAuth();

  if (isLoading) return <LoadingScreen />;

  return isSignedIn ? <AppScreen /> : <LoginFormScreen />;
}
```

### Fetch Data with Real-time Updates

```typescript
import { useSyncData } from './hooks/useSyncData';

export default function ChevauxScreen() {
  const userId = useAuth().user.id;
  
  const { data: chevaux, isLoading, refresh } = useSyncData(
    'chevaux',
    `proprietaire_id.eq.${userId}`
  );

  return (
    <FlatList
      data={chevaux}
      onRefresh={refresh}
      refreshing={isLoading}
      renderItem={({ item }) => <ChevalCard cheval={item} />}
    />
  );
}
```

### Create Item

```typescript
import { useMutateData } from './hooks/useMutateData';

export default function CreateChevalScreen() {
  const { create, isLoading, error } = useMutateData('chevaux');

  const handleCreate = async (nom, type, race) => {
    const newCheval = await create({
      nom,
      type,
      race,
      proprietaire_id: userId,
      disciplines: ['CSO'],
    });

    if (newCheval) {
      router.back();
    }
  };

  return <FormScreen onSubmit={handleCreate} isLoading={isLoading} />;
}
```

### Update Item

```typescript
const { update, isLoading } = useMutateData('chevaux');

const handleUpdate = async () => {
  await update(chevalId, {
    nom: 'New Name',
    disciplines: ['CSO', 'Dressage'],
  });
};
```

### Delete Item

```typescript
const { delete: deleteItem, isLoading } = useMutateData('chevaux');

const handleDelete = async () => {
  const success = await deleteItem(chevalId);
  if (success) {
    router.back();
  }
};
```

---

## 🔐 Security Setup

### Enable Row Level Security (RLS)

1. Go to Supabase Dashboard → **Authentication** → **Policies**
2. Click on each table and enable RLS

### Add RLS Policy for Cavaliers

```sql
-- Cavaliers can only see their own chevaux
CREATE POLICY "Users can view own chevaux"
ON chevaux FOR SELECT
USING (auth.uid() = proprietaire_id);

CREATE POLICY "Users can insert own chevaux"
ON chevaux FOR INSERT
WITH CHECK (auth.uid() = proprietaire_id);

CREATE POLICY "Users can update own chevaux"
ON chevaux FOR UPDATE
USING (auth.uid() = proprietaire_id)
WITH CHECK (auth.uid() = proprietaire_id);

CREATE POLICY "Users can delete own chevaux"
ON chevaux FOR DELETE
USING (auth.uid() = proprietaire_id);
```

### Add RLS Policy for Coaches

```sql
-- Coaches can see published concours
CREATE POLICY "Coaches can view published concours"
ON concours FOR SELECT
USING (statut != 'brouillon');

-- Coaches can see their own annonces
CREATE POLICY "Coaches can view own annonces"
ON coach_annonces FOR SELECT
USING (auth.uid() = auteur_id);
```

---

## 🔄 Real-time Features

### Automatic Sync

All data fetched with `useSyncData()` automatically syncs:
- ✅ New items (INSERT)
- ✅ Updated items (UPDATE)
- ✅ Deleted items (DELETE)

No manual refresh needed!

### Example: Live Coach Availability

```typescript
// Coach creates/updates availability
const { create } = useMutateData('disponibilites');
await create({
  annonce_id,
  jour: new Date(),
  heure_debut: '09:00',
  heure_fin: '17:00',
});

// Cavaliers automatically see update in real-time
const { data: disponibilites } = useSyncData(
  'disponibilites',
  `annonce_id.eq.${annonceId}`
);
// ^^ Automatically updates when coach adds availability!
```

---

## 📊 Monitoring & Debugging

### Enable Debug Logging

In `expo_app/.env`:
```
EXPO_PUBLIC_DEBUG_LOGS=true
```

### Monitor Real-time Events

Watch Supabase Dashboard → **Realtime** → **Inspector**

### Check Database Logs

Supabase Dashboard → **Logs** → **Database** or **REST API**

---

## 🚨 Common Issues & Solutions

### Issue: "Supabase credentials not configured"

**Solution:**
```bash
# Ensure .env exists and is configured
cp .env.example .env
# Edit .env with your credentials
expo start --clear
```

### Issue: "Row Level Security denied"

**Solution:** Check RLS policies are created for your user role

### Issue: Real-time updates not working

**Solution:**
1. Check WebSocket connection in browser DevTools
2. Verify RLS policies allow the operation
3. Check Supabase logs for errors

### Issue: "Cannot read property 'id' of null"

**Solution:** User not authenticated. Check `useSupabaseAuth()` returns valid user.

---

## 🎯 Migration Plan: Local → Supabase

### Phase 1: Current State ✅
- Stores are in-memory only
- Data lost on app restart
- No multi-device sync

### Phase 2: Supabase Read-Only (Next)
- Read data from Supabase
- Fallback to local stores
- Keep writing to local stores

### Phase 3: Full Migration
- Read from Supabase
- Write to Supabase
- Remove local stores

### Phase 4: Real-time (Final)
- Automatic sync across devices
- Optimistic updates
- Offline support

---

## 📚 Resources

- **Supabase Docs**: https://supabase.com/docs
- **React Native Auth**: https://supabase.com/docs/reference/javascript/auth-signup
- **Real-time Subscriptions**: https://supabase.com/docs/guides/realtime
- **RLS Policies**: https://supabase.com/docs/guides/auth/row-level-security

---

## ✅ Checklist

- [ ] Credentials added to `.env`
- [ ] Dependencies installed (`@supabase/supabase-js`)
- [ ] Database migrations applied
- [ ] RLS policies created
- [ ] `useSupabaseAuth()` integrated into main flow
- [ ] Replace first store with `useSyncData()`
- [ ] Test real-time updates
- [ ] Monitor WebSocket connection

---

**Status**: 🟢 Ready for integration
**Next Step**: Start replacing stores with `useSyncData()` hooks

Let me know if you need help with specific screens! 🚀
