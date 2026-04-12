# 🔄 Refactoring Examples: From Stores to Supabase

This file shows how to replace local stores with Supabase integration.

---

## Example 1: Chevaux Listing

### BEFORE (Local Store)

```typescript
// app/(tabs)/chevaux.tsx
import { useState, useEffect } from 'react';
import { chevauxStore } from '../data/store';

export default function ChevauxScreen() {
  const [chevaux, setChevaux] = useState(chevauxStore.list);

  return (
    <FlatList
      data={chevaux}
      renderItem={({ item }) => <ChevalCard cheval={item} />}
    />
  );
}
```

### AFTER (Supabase)

```typescript
// app/(tabs)/chevaux.tsx
import { useSupabaseAuth } from '../hooks/useSupabaseAuth';
import { useSyncData } from '../hooks/useSyncData';

export default function ChevauxScreen() {
  const { user } = useSupabaseAuth();
  
  // Real-time sync from Supabase!
  const { data: chevaux, isLoading, error, refresh } = useSyncData(
    'chevaux',
    `proprietaire_id.eq.${user?.id}`
  );

  if (error) {
    return <ErrorScreen message={error} />;
  }

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

**Benefits:**
✅ Real-time updates from other devices
✅ Automatic sync with database
✅ No manual refresh needed
✅ Automatic error handling

---

## Example 2: Creating a Cheval

### BEFORE (Local Store)

```typescript
function handleCreate(nom, type, race) {
  const newCheval = {
    id: `c_${Date.now()}`,
    nom,
    type,
    race,
    proprietaireId: userStore.id,
    disciplines: [],
  };

  // Store in memory only
  chevauxStore.list = [newCheval, ...chevauxStore.list];
  
  // Alert user
  Alert.alert('✅ Cheval créé');
  router.back();
}
```

### AFTER (Supabase)

```typescript
function handleCreate(nom, type, race) {
  const { create, isLoading, error } = useMutateData('chevaux');

  const newCheval = await create({
    nom,
    type,
    race,
    proprietaire_id: user?.id,
    disciplines: [],
  });

  if (newCheval) {
    Alert.alert('✅ Cheval créé et sauvegardé!');
    router.back();
    // Data automatically syncs to all screens!
  } else {
    Alert.alert('❌ Erreur', error);
  }
}
```

**Benefits:**
✅ Data persists in database
✅ Error handling built-in
✅ Automatically updates all screens
✅ Works on all devices

---

## Example 3: Concours Listing (Cavalier View)

### BEFORE (Static Mock Data)

```typescript
// app/(tabs)/concours.tsx
import { mockConcours } from '../data/mockConcours';

export default function ConcoursScreen() {
  const [concours, setConcours] = useState(
    mockConcours.filter(c => c.statut !== 'brouillon')
  );

  return (
    <FlatList
      data={concours}
      renderItem={({ item }) => <ConcoursCard concours={item} />}
    />
  );
}
```

### AFTER (Supabase Real-time)

```typescript
// app/(tabs)/concours.tsx
import { useSyncData } from '../hooks/useSyncData';

export default function ConcoursScreen() {
  // Always shows published concours
  const { data: concours, isLoading, refresh } = useSyncData(
    'concours',
    'statut.neq.brouillon',
    { order: { column: 'date_debut', ascending: false } }
  );

  return (
    <FlatList
      data={concours}
      onRefresh={refresh}
      refreshing={isLoading}
      renderItem={({ item }) => <ConcoursCard concours={item} />}
    />
  );
}
```

**Benefits:**
✅ Always shows latest concours (real organisateurs!)
✅ No need to mock data
✅ Automatic updates when organisateurs create concours
✅ Filtered at database level (better performance)

---

## Example 4: Coach Annonces

### BEFORE (Local Store)

```typescript
// app/(tabs)/coach-services.tsx
import { coachAnnoncesStore } from '../data/store';

export default function CoachServicesScreen() {
  const [annonces, setAnnonces] = useState(coachAnnoncesStore.list);

  return (
    <FlatList
      data={annonces}
      renderItem={({ item }) => <AnnonceCard annonce={item} />}
    />
  );
}
```

### AFTER (Supabase)

```typescript
// app/(tabs)/coach-services.tsx
import { useSupabaseAuth } from '../hooks/useSupabaseAuth';
import { useSyncData } from '../hooks/useSyncData';

export default function CoachServicesScreen() {
  const { user } = useSupabaseAuth();
  
  // Show only this coach's annonces
  const { data: annonces, isLoading, refresh } = useSyncData(
    'coach_annonces',
    `auteur_id.eq.${user?.id}`
  );

  return (
    <FlatList
      data={annonces}
      onRefresh={refresh}
      refreshing={isLoading}
      renderItem={({ item }) => <AnnonceCard annonce={item} />}
    />
  );
}
```

---

## Example 5: Creating Coach Annonce

### BEFORE (Local Store)

```typescript
function submit() {
  const nouvelleAnnonce = {
    id: `ca_${Date.now()}`,
    auteurId: userStore.id,
    titre,
    type,
    prix_heure: parseFloat(prixHeure),
    // ... other fields
  };

  coachAnnoncesStore.list = [nouvelleAnnonce, ...coachAnnoncesStore.list];
  Alert.alert('Annonce publiée');
  router.replace('/(tabs)/coach-services');
}
```

### AFTER (Supabase)

```typescript
function submit() {
  const { create, isLoading, error } = useMutateData('coach_annonces');

  const success = await create({
    auteur_id: user?.id,
    titre,
    type,
    discipline,
    niveau,
    prix_heure: parseFloat(prixHeure),
    date_debut: dateDebut,
    date_fin: dateFin,
    disponibilites: [],
  });

  if (success) {
    Alert.alert('✅ Annonce publiée et sauvegardée!');
    router.replace('/(tabs)/coach-services');
    // Automatically appears in other screens!
  } else {
    Alert.alert('❌ Erreur', error);
  }
}
```

---

## Example 6: User Profile Management

### BEFORE (Store)

```typescript
// Display
<Text>{userStore.prenom} {userStore.nom}</Text>

// Update (local only!)
userStore.prenom = 'New Name';
setUser({ ...userStore });
```

### AFTER (Supabase)

```typescript
import { useSupabaseAuth } from '../hooks/useSupabaseAuth';
import { useMutateData } from '../hooks/useMutateData';

export default function ProfilScreen() {
  const { user } = useSupabaseAuth();
  const { update, isLoading, error } = useMutateData('users');

  const handleUpdate = async () => {
    await update(user?.id, {
      prenom: newPrenom,
      nom: newNom,
      region: newRegion,
    });
    Alert.alert('✅ Profil mis à jour!');
  };

  return (
    <View>
      <Text>{user?.prenom} {user?.nom}</Text>
      <Button onPress={handleUpdate} loading={isLoading} />
    </View>
  );
}
```

---

## Migration Checklist

For each screen, follow this process:

- [ ] Import `useSupabaseAuth()` for user context
- [ ] Replace store imports with `useSyncData()` for reading
- [ ] Replace store mutations with `useMutateData()` for writing
- [ ] Add error handling with `error` state
- [ ] Add loading state with `isLoading`
- [ ] Add pull-to-refresh with `onRefresh`
- [ ] Test real-time updates (open on 2 devices)
- [ ] Remove local store imports
- [ ] Delete mock data

---

## Performance Optimization

### Use Filtering at Database Level

```typescript
// ❌ BAD: Fetch all, filter in app
const { data: allChevaux } = useSyncData('chevaux');
const myChevaux = allChevaux.filter(c => c.proprietaire_id === userId);

// ✅ GOOD: Filter in database query
const { data: myChevaux } = useSyncData(
  'chevaux',
  `proprietaire_id.eq.${userId}`
);
```

### Use Ordering at Database Level

```typescript
// ❌ BAD: Sort in app
const { data: concours } = useSyncData('concours');
const sorted = concours.sort((a, b) => a.date_debut - b.date_debut);

// ✅ GOOD: Order in database
const { data: concours } = useSyncData('concours', undefined, {
  order: { column: 'date_debut', ascending: true }
});
```

### Use Limits for Large Tables

```typescript
// Only fetch first 20
const { data: topAnnonces } = useSyncData('coach_annonces', undefined, {
  limit: 20,
  order: { column: 'created_at', ascending: false }
});
```

---

## Testing

Before deploying, test:

1. **Create** - Add item on device A, verify appears on device B
2. **Update** - Change item on device A, verify updates on device B
3. **Delete** - Delete item on device A, verify disappears on device B
4. **Offline** - Turn off network, make changes, turn on, verify sync
5. **Errors** - Try invalid data, verify error messages

---

**Status**: Ready to refactor! Start with the simplest screen first. 🚀
