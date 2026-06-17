// Écran concours legacy (données mock concoursStore) — REMPLACÉ par le hub DB.
// Toute entrée vers /(tabs)/concours est redirigée vers /(tabs)/concours-hub
// (source = table public.concours via useConcoursList, épreuves importées réelles).
// On garde le fichier comme simple redirection pour ne casser aucun lien existant
// (ex profil.tsx). Le mock concoursStore/mockConcours n'alimente plus aucun écran.
import { Redirect } from 'expo-router';

export default function ConcoursScreenRedirect() {
  return <Redirect href={'/(tabs)/concours-hub' as any} />;
}
