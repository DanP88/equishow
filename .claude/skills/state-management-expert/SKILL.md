---
name: state-management-expert
description: Equishow front-end state — hooks, stores, cache, sync, optimistic updates, invalidation, React Query-like patterns, React hooks-order bugs. Use when debugging state, cache, or instant-UI behavior.
---

# State Management Expert (Equishow)

## Domaine
État front : hooks, stores, cache, synchronisation, mises à jour optimistes, invalidation, patterns type React Query, bugs React (ordre des hooks). Contexte : CLAUDE.md (Frontend), `expo_app/hooks/`.

## Quand l'utiliser
- Données pas à jour / cache désynchronisé / UI non instantanée.
- Concevoir un update optimiste + invalidation.
- Bug React #310 (hooks après early return).

## Quand NE PAS l'utiliser
- Routing/build/push → `expo-expert`. Ergonomie/écran → `mobile-ux-expert`. Lenteur côté DB → `supabase-performance-expert`.

## Checklist
1. **Pattern UI instantané (3 couches)** : optimistic update + pubsub in-process + realtime Supabase. Exigence produit = tout instantané.
2. **Hooks dédiés** : `hooks/use*.ts` par domaine ; pas de logique Supabase inline dans l'écran.
3. **Invalidation** : après mutation, refléter immédiatement (optimistic) puis confirmer (realtime/refetch).
4. **Cas hors realtime** : `conversation_reads`/`concours_thread_reads` → décrément via bus pubsub (`emitMessagesRead`).
5. **Bug ordre hooks** : pas de hook après early return (React #310, récurrent dans `reserver-*.tsx`).
6. **Cohérence** : badges/compteurs recountés au focus (tables hors realtime) via `useFocusEffect`.

## Livrable attendu
Reco état : **symptôme · couche concernée (optimistic/pubsub/realtime) · cause · correctif · garde React (#310/ordre hooks) · vérif (UI instantanée multi-appareils)**.
