import { Redirect } from 'expo-router';

// ─────────────────────────────────────────────────────────────────────────────
// C6 — Écran unifié. `coach-pending-demands` était une implémentation parallèle
// (cours uniquement, sans nettoyage de la notif pending, sans les stages) de
// l'onglet « 📬 Demandes » = `coach-demandes.tsx`, qui est désormais la route
// canonique. Cet écran ne fait plus que rediriger : les anciens deep-links et
// les notifications déjà en base (`actionUrl: '/(tabs)/coach-pending-demands'`)
// continuent de fonctionner.
// ─────────────────────────────────────────────────────────────────────────────
export default function CoachPendingDemandsRedirect() {
  return <Redirect href="/(tabs)/coach-demandes" />;
}
