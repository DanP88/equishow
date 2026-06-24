---
name: expo-expert
description: Equishow Expo/React Native stack — expo-router, EAS, push notifications, builds, mobile/web navigation, iOS/Android/Web compatibility. Use when working on app structure, routing, builds, or platform compatibility.
---

# Expo Expert (Equishow)

## Domaine
Stack Expo : Expo 54 · RN 0.81 · expo-router 6 · React Native Web · EAS · push · builds · navigation mobile/web · compat iOS/Android/Web. Contexte : CLAUDE.md (Stack), `expo_app/`.

## Quand l'utiliser
- Structure de routes (`app/`, nested, `(tabs)`), navigation, deep-links.
- Builds (`expo export --platform web` pour Vercel), config EAS.
- Push notifications (expo-notifications), compat web vs natif.

## Quand NE PAS l'utiliser
- État/hooks/cache → `state-management-expert`. UX/parcours → `mobile-ux-expert`. Backend/SQL → skills DB. Release/CI → `release-manager`.

## Checklist
1. **Routing** : expo-router fichier ; nested (`concours/[id]/index.tsx` + `discussion.tsx`) ; URL inchangée si refacto.
2. **Web** : RN Web — attention API web-only (`position:'fixed'`, cf erreurs TS) ; build `expo export --platform web` doit être vert.
3. **Push** : expo-notifications ; sender Edge `send-push` prêt ; ⚠️ mobile EAS **en pause** (0 projet, Apple Dev 99 $) → web only.
4. **Compat** : tester web (Vercel) + viser natif ; SDK54 gotchas (`toReversed` Node 20, `NotificationBehavior` champs).
5. **Builds** : Node 20 ; cache bundle (hard refresh post-deploy).
6. **TS** : 18 erreurs pré-existantes (`reserver-transport`, `boost-coach`, `AddressAutocomplete`, `usePushNotifications`) — ne pas en ajouter.

## Livrable attendu
Reco Expo : **zone (routing/build/push/compat) · cause · correctif · plateformes impactées (iOS/Android/Web) · vérif (tsc + export web vert) · priorité P0–P3**.
