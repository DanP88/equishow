// LOT 1 Org V2 — cet écran affichait des listes de concours CODÉES EN DUR
// (EN_COURS / PASSE, « 156 cavaliers » fictifs). Données fabriquées → retirées.
// La vue réelle des concours de l'organisateur = onglet org-concours (claims réels).
// On redirige pour ne casser aucun lien existant (profil-org, etc.).
import { Redirect } from 'expo-router';

export default function OrgConcoursListRedirect() {
  return <Redirect href={'/(tabs)/org-concours' as any} />;
}
