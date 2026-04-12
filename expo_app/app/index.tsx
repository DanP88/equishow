import { Redirect } from 'expo-router';

export default function Index() {
  // Pour l'instant on redirige direct vers les tabs
  // Plus tard : vérifier l'auth ici
  return <Redirect href="/(tabs)/chevaux" />;
}
