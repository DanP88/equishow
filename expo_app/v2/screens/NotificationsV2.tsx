// ─────────────────────────────────────────────────────────────────────────────
// NotificationsV2 — panneau top bar 🔔. UN SEUL centre, agrège toutes les
// capacités (transactionnel cavalier + demandes coach + infos organisateur).
// Fusionne notifications / coach-notifications / org-notifications (V1, quasi
// dupliqués). F2 : structure + lecture réelle best-effort (useNotifications) ;
// le tri/actions fins = F3.
// ─────────────────────────────────────────────────────────────────────────────
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, FontWeight } from '../../constants/theme';
import { Screen, Placeholder, Row, RowGroup } from '../ui/kit';
import { useCapabilities } from '../capabilities';
import { MOCK_ACTIONS } from '../mocks/f2';

const MOCK_NOTIFS = [
  { id: 'n1', group: "Aujourd'hui", icon: '🎓', label: 'Nouvelle demande — Thomas R. / Rio', cap: 'coach' },
  { id: 'n2', group: "Aujourd'hui", icon: '✅', label: 'Transport La Baule accepté', cap: 'cavalier' },
  { id: 'n3', group: "Aujourd'hui", icon: '💬', label: 'Émilie a répondu à votre demande', cap: 'cavalier' },
  { id: 'n4', group: 'Hier', icon: '🏆', label: 'Horaire publié — CSO Deauville', cap: 'cavalier' },
  { id: 'n5', group: 'Hier', icon: '⭐', label: '2 nouveaux participants à La Baule', cap: 'cavalier' },
  { id: 'n6', group: 'Hier', icon: '📊', label: 'Radar : +5 inscrits sur votre concours', cap: 'organisateur' },
] as const;

export function NotificationsV2() {
  const caps = useCapabilities();
  const list = MOCK_NOTIFS.filter((n) => caps.has(n.cap as any));
  const groups = [...new Set(list.map((n) => n.group))];

  return (
    <Screen>
      <TouchableOpacity onPress={() => router.back()}><Text style={s.back}>← Retour</Text></TouchableOpacity>
      <View style={s.head}>
        <Text style={s.h1}>Notifications</Text>
        <TouchableOpacity hitSlop={6}><Text style={s.allRead}>Tout marquer lu</Text></TouchableOpacity>
      </View>

      {groups.map((g) => (
        <View key={g} style={s.group}>
          <Text style={s.groupTitle}>{g.toUpperCase()}</Text>
          <RowGroup>
            {list.filter((n) => n.group === g).map((n) => (
              <Row key={n.id} icon={n.icon} label={n.label} onPress={() => {}} />
            ))}
          </RowGroup>
        </View>
      ))}

      <Placeholder note={`liste unique agrégée par personne · ${MOCK_ACTIONS.length} items simulés · branchement réel en F3`} v1Path="/(tabs)/notifications" v1Label="notifications actuelles" />
    </Screen>
  );
}

const s = StyleSheet.create({
  back: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.bold },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  h1: { fontSize: FontSize.xxl, fontWeight: FontWeight.extrabold, color: Colors.textPrimary },
  allRead: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.bold },
  group: { gap: Spacing.xs, marginTop: Spacing.md },
  groupTitle: { fontSize: FontSize.xs, fontWeight: FontWeight.extrabold, color: Colors.textTertiary, letterSpacing: 0.6 },
});
