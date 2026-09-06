import { Redirect } from 'expo-router';
import { V2_ENABLED, V2_FLAGS } from '../v2/flags';

export default function Index() {
  // V2 (LOT F2) — bascule unique. flag=false ⇒ comportement V1 strict (ligne
  // d'origine ci-dessous, inchangée). flag=true ⇒ l'app démarre dans le groupe
  // de routes (v2). On peut aussi entrer dans la V2 sans toucher au flag via
  // /v2-dev › « Entrer dans la V2 » (route __DEV__).
  if (V2_ENABLED && V2_FLAGS.navigation) {
    return <Redirect href={'/(v2)/accueil' as any} />;
  }

  // Pour l'instant on redirige direct vers les tabs
  // Plus tard : vérifier l'auth ici
  return <Redirect href="/(tabs)/chevaux" />;
}
