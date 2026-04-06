# 🗂️ Mock Data Removal & Data Layer Modernization Guide

Comprehensive guide to removing hardcoded mock data and replacing with live Supabase queries.

---

## Overview

**Current State**:
```
expo_app/data/
├── mockChevaux.ts        ← Hardcoded horses (3 examples)
├── mockServices.ts       ← Hardcoded coach services
├── mockConcours.ts       ← Hardcoded competitions
├── mockUsers.ts          ← Hardcoded users
├── mockAdresses.ts       ← Hardcoded addresses
├── mockVilles.ts         ← Hardcoded cities
├── notificationsStore.ts ← Notifications
├── store.ts              ← General store
└── tarification.ts       ← Pricing data
```

**Goal**: Replace all with Supabase queries and context-based state management.

---

## Mock Data Inventory

### 1. mockChevaux.ts (3 horses)
- Location: `/expo_app/data/mockChevaux.ts`
- Used By: `(tabs)/chevaux.tsx`, `reserver-coach.tsx`
- Size: ~300 lines
- Status: **TO REMOVE**

**Replacement**:
```tsx
// Instead of:
import { mockChevaux } from '../data/mockChevaux';
const horses = mockChevaux;

// Use:
const { data: horses } = await supabase
  .from('chevaux')
  .select('*')
  .eq('user_id', userId)
  .order('nom', { ascending: true });
```

### 2. mockServices.ts (Coach announcements)
- Location: `/expo_app/data/mockServices.ts`
- Used By: `(tabs)/coach-services.tsx`, `reserver-coach.tsx`
- Size: ~200 lines
- Status: **TO REMOVE**

**Replacement**:
```tsx
const { data: services } = await supabase
  .from('coach_annonces')
  .select('*, utilisateurs(prenom, nom, region)')
  .eq('published', true)
  .order('created_at', { ascending: false });
```

### 3. mockConcours.ts (Competitions)
- Location: `/expo_app/data/mockConcours.ts`
- Used By: `(tabs)/concours.tsx`
- Size: ~100 lines
- Status: **TO REMOVE**

**Replacement**:
```tsx
const { data: concours } = await supabase
  .from('concours')
  .select('*')
  .gte('date_debut', new Date().toISOString())
  .order('date_debut', { ascending: true });
```

### 4. mockUsers.ts (Users)
- Location: `/expo_app/data/mockUsers.ts`
- Used By: Various screens for profile data
- Size: ~100 lines
- Status: **TO REMOVE**

**Replacement**: Use `useAuth()` hook from Supabase session

### 5. mockAdresses.ts (Addresses)
- Location: `/expo_app/data/mockAdresses.ts`
- Used By: Address selection forms
- Size: ~100 lines
- Status: **CAN REMAIN** (static reference data)

**Decision**: Can remain as static data OR migrate to addresses table

### 6. mockVilles.ts (Cities)
- Location: `/expo_app/data/mockVilles.ts`
- Used By: City/region selection
- Size: ~50 lines
- Status: **CAN REMAIN** (static reference data)

**Decision**: Can remain as static data OR migrate to cities table in database

### 7. store.ts (State Management)
- Location: `/expo_app/data/store.ts`
- Used By: Global state
- Size: ~100 lines
- Status: **MODERNIZE**

**Replacement**: Use React Context + Supabase subscriptions

### 8. notificationsStore.ts (Notifications)
- Location: `/expo_app/data/notificationsStore.ts`
- Used By: Notification screens
- Size: ~80 lines
- Status: **TO REMOVE**

**Replacement**: Query notifications table from database

### 9. tarification.ts (Pricing)
- Location: `/expo_app/data/tarification.ts`
- Used By: Coach pricing display
- Size: ~150 lines
- Status: **DEPENDS**

**Decision**: If pricing is managed by coaches, migrate to database. If fixed, keep as static.

---

## Removal Strategy

### Phase 1: Low-Risk (Static Data)
✅ **Cities & Addresses** (can remain as static reference data)
- No screen changes needed
- No data loss risk
- Keep for offline access

### Phase 2: Moderate-Risk (User Data)
🟡 **Horses (Chevaux)** 
- Currently used in 2 screens
- Has auth context available
- Straightforward Supabase query

### Phase 3: Complex (Interconnected Data)
🟠 **Coach Services, Competitions, Notifications**
- Used in multiple screens
- Have complex relationships
- Require careful testing

---

## Step-by-Step Implementation

### Step 1: Create Data Fetching Hooks

**File**: `expo_app/hooks/useChevaux.ts`

```typescript
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Cheval } from '../types/cheval';

export const useChevaux = (userId?: string) => {
  const [data, setData] = useState<Cheval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchChevaux() {
      try {
        setLoading(true);
        
        // Get current user if not provided
        const targetUserId = userId || (await supabase.auth.getUser()).data.user?.id;
        if (!targetUserId) throw new Error('No user ID');

        const { data, error } = await supabase
          .from('chevaux')
          .select('*')
          .eq('user_id', targetUserId)
          .order('nom', { ascending: true });

        if (error) throw error;
        if (isMounted) setData(data || []);
      } catch (err) {
        if (isMounted) setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchChevaux();

    return () => { isMounted = false; };
  }, [userId]);

  return { data, loading, error };
};
```

**File**: `expo_app/hooks/useCoachServices.ts`

```typescript
export const useCoachServices = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetch() {
      try {
        const { data, error } = await supabase
          .from('coach_annonces')
          .select(`
            *,
            utilisateurs:coach_id(
              id,
              prenom,
              nom,
              region,
              photo_url
            )
          `)
          .eq('published', true)
          .order('created_at', { ascending: false });

        if (error) throw error;
        if (isMounted) setData(data || []);
      } catch (err) {
        if (isMounted) setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetch();
    return () => { isMounted = false; };
  }, []);

  return { data, loading, error };
};
```

**File**: `expo_app/hooks/useConcours.ts`

```typescript
export const useConcours = (userId?: string) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetch() {
      try {
        const query = supabase
          .from('concours')
          .select(`
            *,
            organisateur:organisateur_id(
              id,
              nom,
              region
            )
          `)
          .gte('date_debut', new Date().toISOString())
          .order('date_debut', { ascending: true });

        if (userId) {
          // Get engagements for this user
          const { data: engagements } = await supabase
            .from('engagements')
            .select('concours_id')
            .eq('user_id', userId);
          
          const engagedIds = engagements?.map(e => e.concours_id) || [];
          // Could filter or mark engagements
        }

        const { data, error } = await query;
        if (error) throw error;
        if (isMounted) setData(data || []);
      } catch (err) {
        if (isMounted) setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetch();
    return () => { isMounted = false; };
  }, [userId]);

  return { data, loading, error };
};
```

### Step 2: Migrate Individual Screens

#### Screen: (tabs)/chevaux.tsx

**Before**:
```tsx
import { mockChevaux } from '../data/mockChevaux';

export function ChevauxScreen() {
  const [chevaux, setChevaux] = useState(mockChevaux);
  // ... uses mockChevaux directly
}
```

**After**:
```tsx
import { useChevaux } from '../hooks/useChevaux';

export function ChevauxScreen() {
  const { data: chevaux, loading, error } = useChevaux();

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorScreen error={error} />;
  if (chevaux.length === 0) return <EmptyState />;

  return (
    <FlatList
      data={chevaux}
      renderItem={({ item }) => <ChevalCard cheval={item} />}
      keyExtractor={item => item.id}
    />
  );
}
```

#### Screen: (tabs)/coach-services.tsx

**Before**:
```tsx
import { mockServices } from '../data/mockServices';

export function CoachServicesScreen() {
  const [services, setServices] = useState(mockServices);
}
```

**After**:
```tsx
import { useCoachServices } from '../hooks/useCoachServices';

export function CoachServicesScreen() {
  const { data: services, loading, error } = useCoachServices();

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorScreen error={error} />;

  return (
    <FlatList
      data={services}
      renderItem={({ item }) => <ServiceCard service={item} />}
      keyExtractor={item => item.id}
    />
  );
}
```

#### Screen: (tabs)/concours.tsx

**Before**:
```tsx
import { mockConcours } from '../data/mockConcours';

export function ConcoursScreen() {
  const [concours, setConcours] = useState(mockConcours);
}
```

**After**:
```tsx
import { useConcours } from '../hooks/useConcours';
import { useAuth } from '../hooks/useAuth';

export function ConcoursScreen() {
  const auth = useAuth();
  const { data: concours, loading, error } = useConcours(auth.user?.id);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorScreen error={error} />;

  return (
    <FlatList
      data={concours}
      renderItem={({ item }) => <ConcoursCard concours={item} />}
      keyExtractor={item => item.id}
    />
  );
}
```

### Step 3: Remove Mock Data Files

After all screens migrated:

```bash
rm expo_app/data/mockChevaux.ts
rm expo_app/data/mockServices.ts
rm expo_app/data/mockConcours.ts
rm expo_app/data/mockUsers.ts
# Keep: mockAdresses.ts, mockVilles.ts (static reference data)
```

### Step 4: Update Imports

Search and replace:
```bash
# Find all imports of mock data
grep -r "import.*mock" expo_app/app/ --include="*.ts" --include="*.tsx"

# Remove them one by one
```

---

## Testing Strategy

### 1. Unit Tests for Hooks

```typescript
describe('useChevaux', () => {
  it('should fetch chevaux from Supabase', async () => {
    const { result, waitForNextUpdate } = renderHook(() => useChevaux('user-123'));
    
    expect(result.current.loading).toBe(true);
    await waitForNextUpdate();
    
    expect(result.current.loading).toBe(false);
    expect(result.current.data.length).toBeGreaterThan(0);
  });

  it('should handle errors', async () => {
    jest.spyOn(supabase, 'from').mockImplementation(() => ({
      select: () => Promise.reject(new Error('Network error'))
    }));

    const { result, waitForNextUpdate } = renderHook(() => useChevaux());
    await waitForNextUpdate();

    expect(result.current.error).toBeDefined();
  });
});
```

### 2. Integration Tests

```typescript
describe('Chevaux Screen', () => {
  it('should display chevaux from database', async () => {
    const { findByText } = render(<ChevauxScreen />);
    
    await waitFor(() => {
      expect(findByText('Éclipse du Vent')).toBeDefined();
    });
  });

  it('should show loading state', () => {
    const { getByText } = render(<ChevauxScreen />);
    expect(getByText('Chargement...')).toBeDefined();
  });
});
```

### 3. Migration Verification

```sql
-- Verify data exists in database
SELECT COUNT(*) as total_chevaux FROM chevaux WHERE deleted_at IS NULL;
SELECT COUNT(*) as total_services FROM coach_annonces WHERE published = true;
SELECT COUNT(*) as total_concours FROM concours WHERE date_debut > NOW();

-- Check for any remaining mock data
SELECT * FROM chevaux WHERE user_id LIKE 'mock%' OR nom LIKE 'Mock%';
```

---

## Data Cleanup

### Remove Mock Test Accounts

```sql
-- Find test data
SELECT * FROM utilisateurs WHERE email LIKE 'test%' OR prenom LIKE 'Test%';

-- Archive (soft delete) mock user data
UPDATE utilisateurs 
SET deleted_at = NOW()
WHERE email IN ('testuser@example.com', 'coach@example.com', 'admin@example.com');

-- Delete associated mock data
UPDATE chevaux SET deleted_at = NOW() WHERE user_id IN (SELECT id FROM utilisateurs WHERE deleted_at IS NOT NULL);
UPDATE coach_annonces SET deleted_at = NOW() WHERE coach_id IN (SELECT id FROM utilisateurs WHERE deleted_at IS NOT NULL);
```

### Verify Database Integrity

```sql
-- Check for orphaned data
SELECT COUNT(*) FROM chevaux WHERE user_id NOT IN (SELECT id FROM utilisateurs WHERE deleted_at IS NULL);

-- Check for missing data
SELECT COUNT(*) FROM coach_annonces WHERE coach_id NOT IN (SELECT id FROM utilisateurs WHERE deleted_at IS NULL);

-- Verify indexes exist
SELECT * FROM pg_indexes WHERE tablename IN ('chevaux', 'coach_annonces', 'concours');
```

---

## Migration Checklist

### Pre-Migration
- [ ] Create backup of current production database
- [ ] Prepare test data in staging environment
- [ ] Create data fetching hooks
- [ ] Update screens one by one
- [ ] Test each screen thoroughly

### Migration
- [ ] Deploy updated screens to staging
- [ ] Run integration tests
- [ ] Verify all data displays correctly
- [ ] Check for performance issues
- [ ] Test error states and loading states

### Post-Migration
- [ ] Remove mock data files
- [ ] Update imports in all screens
- [ ] Run full test suite
- [ ] Performance testing with production data volume
- [ ] Monitor error rates in production
- [ ] Remove old mock data from database

### Cleanup
- [ ] Document which mock files were removed
- [ ] Update developer onboarding guide
- [ ] Update architecture documentation
- [ ] Close any related GitHub issues

---

## Performance Considerations

### Before (Mock Data)
```
- Load time: ~50ms (local data)
- Memory: ~5MB (mock data arrays)
- Network: None
```

### After (Supabase Queries)
```
- Load time: ~200-500ms (network + query)
- Memory: Variable (depends on result set)
- Network: 1 query per screen
- Latency: 50-200ms depending on location
```

### Optimization Strategies

1. **Add Loading States**
   ```tsx
   return loading ? <Skeleton /> : <Content />;
   ```

2. **Pagination for Large Lists**
   ```typescript
   const { data } = await supabase
     .from('chevaux')
     .select('*')
     .range(0, 20) // Only load first 20
     .order('nom');
   ```

3. **Caching with SWR**
   ```typescript
   import useSWR from 'swr';
   
   const { data } = useSWR('chevaux-' + userId, () => 
     supabase.from('chevaux').select('*').eq('user_id', userId)
   );
   ```

4. **Subscriptions for Real-Time Updates**
   ```typescript
   useEffect(() => {
     const subscription = supabase
       .on('postgres_changes', 
         { event: '*', schema: 'public', table: 'chevaux' },
         payload => setChevaux(prev => [...prev, payload.new])
       )
       .subscribe();
     
     return () => subscription.unsubscribe();
   }, []);
   ```

---

## Troubleshooting

### Data Not Loading
**Symptoms**: Blank screens, loading spinner forever

**Debug**:
```typescript
const { data, error, loading } = useChevaux();
console.log('Loading:', loading);
console.log('Error:', error);
console.log('Data:', data);
```

**Common Causes**:
- User not authenticated: Check `useAuth()` returns user
- Wrong user ID: Verify `userId` is passed correctly
- RLS policy blocking: Check RLS in `(tabs)/chevaux.tsx`
- Network error: Check Supabase connection

### Performance Issues
**Symptoms**: Slow screen loads, jank

**Solutions**:
1. Add pagination: only load 20 items initially
2. Use skeleton loaders: show UI while loading
3. Cache with SWR/React Query
4. Optimize indexes in database

### Too Much Data
**Symptoms**: Mobile app crashes with large datasets

**Solutions**:
1. Implement pagination/infinite scroll
2. Add filters: `where({ published: true })`
3. Limit fields: `.select('id, nom, race')` instead of `*`
4. Archive old data: soft delete old concours

---

## Timeline Estimate

| Phase | Effort | Tasks |
|-------|--------|-------|
| **1. Setup** | 2h | Create hooks, setup utilities |
| **2. Chevaux** | 4h | Migrate 2 screens, test |
| **3. Services** | 4h | Migrate 2 screens, test |
| **4. Concours** | 3h | Migrate 1 screen, test |
| **5. Cleanup** | 2h | Remove files, update docs |
| **6. Testing** | 4h | Full integration testing |
| **7. Deploy** | 1h | Staging → Production |
| **TOTAL** | **~20 hours** | ~3 days for one developer |

---

## Completed vs Remaining

✅ **Already Done**:
- Database schema (all tables exist)
- Supabase client setup
- Authentication system
- Type definitions

🟡 **Remaining**:
- Data fetching hooks (6 hooks)
- Screen migrations (12 screens)
- Testing (integration + performance)
- Cleanup and documentation

---

## Resources

- [Supabase React Documentation](https://supabase.com/docs/guides/getting-started/react)
- [React Hooks Patterns](https://react.dev/reference/react/hooks)
- [Testing Library Documentation](https://testing-library.com/)
- [Data Fetching Best Practices](https://react.dev/learn/you-might-not-need-an-effect#fetching-data)

---

**Last Updated**: 2026-04-06
**Status**: Ready for Implementation
**Effort**: 3-5 days for one developer
**Impact**: Remove technical debt, enable real-time data, improve production readiness
