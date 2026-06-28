import { Redirect } from 'expo-router';

// Écran d'abonnement cavalier SUPPRIMÉ : Equishow est gratuit pour les cavaliers.
// Cette route legacy (deep links éventuels) redirige vers l'écran Tarifs unifié,
// qui affiche « Cavalier : Gratuit » et les offres PRO (coach / organisateur).
export default function AbonnementScreen() {
  return <Redirect href="/tarification" />;
}
