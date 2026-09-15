// ─────────────────────────────────────────────────────────────────────────────
// app/(v2)/_layout — CHROME DE NAVIGATION V2 (LOT F2).
//
// Groupe de routes SÉPARÉ du groupe V1 (tabs). Le groupe (tabs) n'est jamais
// modifié. On n'atteint (v2) que par :
//   - /v2-dev › « Entrer dans la V2 »  (route __DEV__) ;
//   - la redirection conditionnelle de app/index.tsx quand
//     V2_ENABLED && V2_FLAGS.navigation.
//
// TopBar + BottomBar FIXES (identiques pour toutes les capacités).
// La BottomBar n'apparaît que sur les 5 onglets racine ; les sous-écrans
// (fiche concours, hubs, opt-in…) prennent toute la hauteur.
// ─────────────────────────────────────────────────────────────────────────────
import { View, StyleSheet } from 'react-native';
import { Stack, usePathname, Redirect } from 'expo-router';
import { TopBarV2 } from '../../v2/nav/TopBarV2';
import { BottomBarV2 } from '../../v2/nav/BottomBarV2';
import { AdminTopBarV2 } from '../../v2/nav/AdminTopBarV2';
import { AdminBottomBarV2 } from '../../v2/nav/AdminBottomBarV2';
import { V2_TABS } from '../../v2/nav/navConfig';
import { ADMIN_TABS } from '../../v2/nav/adminNavConfig';
import { BL, injectBlushFonts } from '../../v2/ui/blush';
import { useCapabilities } from '../../v2/capabilities';

injectBlushFonts(); // web : charge Fraunces + Hanken Grotesk (no-op natif)

export default function V2Layout() {
  const pathname = usePathname();
  const caps = useCapabilities();
  // Espace ADMIN = chrome SÉPARÉ (jamais la bottom bar cavalier/coach/organisateur).
  const isAdminSpace = pathname.startsWith('/admin') || pathname.startsWith('/(v2)/admin');
  const onRootTab = isAdminSpace
    ? ADMIN_TABS.some((t) => t.match.some((m) => pathname === m || pathname === m.replace('/(v2)', '')))
    : V2_TABS.some((t) => t.match.some((m) => pathname === m || pathname === m.replace('/(v2)', '')));

  // Garde : /(v2)/admin/* réservé aux vrais comptes admin (mirroir AuthGuard
  // requiredRole="admin" de V1, redirection V2-native au lieu de /(tabs)).
  // <Redirect> (déclaratif) plutôt que router.replace() en effet : évite
  // « Attempted to navigate before mounting the Root Layout component » sur
  // une entrée directe/à froid dans /(v2)/admin/*.
  if (isAdminSpace && !caps.ready) return <View style={s.root} />;
  if (isAdminSpace && caps.realRole !== 'admin') return <Redirect href={'/(v2)/accueil' as any} />;

  return (
    <View style={s.root}>
      {isAdminSpace ? <AdminTopBarV2 /> : <TopBarV2 />}
      <View style={{ flex: 1 }}>
        <Stack screenOptions={{ headerShown: false, animation: 'none', contentStyle: { backgroundColor: BL.bg } }} />
      </View>
      {onRootTab && (isAdminSpace ? <AdminBottomBarV2 /> : <BottomBarV2 />)}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BL.bg },
});
