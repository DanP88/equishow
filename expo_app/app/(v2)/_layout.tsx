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
import { Stack, usePathname } from 'expo-router';
import { Colors } from '../../constants/colors';
import { TopBarV2 } from '../../v2/nav/TopBarV2';
import { BottomBarV2 } from '../../v2/nav/BottomBarV2';
import { V2_TABS } from '../../v2/nav/navConfig';

export default function V2Layout() {
  const pathname = usePathname();
  const onRootTab = V2_TABS.some((t) => t.match.some((m) => pathname === m || pathname === m.replace('/(v2)', '')));

  return (
    <View style={s.root}>
      <TopBarV2 />
      <View style={{ flex: 1 }}>
        <Stack screenOptions={{ headerShown: false, animation: 'none', contentStyle: { backgroundColor: Colors.background } }} />
      </View>
      {onRootTab && <BottomBarV2 />}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
});
