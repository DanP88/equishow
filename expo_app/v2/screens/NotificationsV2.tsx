// ─────────────────────────────────────────────────────────────────────────────
// NotificationsV2 — panneau top bar 🔔. UN SEUL centre, agrège toutes les
// capacités. F3 : flux RÉEL via v2/adapters/notifications (useActiveNotifications
// = useNotifications + selectActiveNotifications, déjà agnostique du rôle).
// LECTURE SEULE — pas de « marquer lu » en Phase 1. Repli démo si vide.
// ─────────────────────────────────────────────────────────────────────────────
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Spacing, FontSize, FontWeight } from '../../constants/theme';
import { Screen, Placeholder, Row, RowGroup } from '../ui/kit';
import { useV2Notifications } from '../adapters/notifications';

export function NotificationsV2() {
  const { groups, demo } = useV2Notifications();

  return (
    <Screen>
      <TouchableOpacity onPress={() => router.back()} hitSlop={6}><Text style={s.back}>← Retour</Text></TouchableOpacity>
      <Text style={s.h1}>Notifications</Text>

      {groups.length === 0 && <Text style={s.empty}>Aucune notification.</Text>}

      {groups.map((g) => (
        <View key={g.label} style={s.group}>
          <Text style={s.groupTitle}>{g.label.toUpperCase()}</Text>
          <RowGroup>
            {g.items.map((n) => (
              <Row key={n.id} icon={n.icon} label={n.label} onPress={() => {}} />
            ))}
          </RowGroup>
        </View>
      ))}

      {demo
        ? <Placeholder note="notifications de démonstration — connecte-toi pour voir les tiennes" v1Path="/(tabs)/notifications" v1Label="notifications actuelles" />
        : <Placeholder note="liste unique agrégée par personne · « marquer lu » rebranché plus tard" />}
    </Screen>
  );
}

const s = StyleSheet.create({
  back: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.bold },
  h1: { fontSize: 22, fontWeight: FontWeight.extrabold, color: Colors.textPrimary, marginTop: 4 },
  empty: { fontSize: FontSize.sm, color: Colors.textSecondary, fontStyle: 'italic', marginTop: Spacing.md },
  group: { gap: Spacing.xs, marginTop: Spacing.lg },
  groupTitle: { fontSize: 11, fontWeight: FontWeight.extrabold, color: Colors.textTertiary, letterSpacing: 0.8 },
});
