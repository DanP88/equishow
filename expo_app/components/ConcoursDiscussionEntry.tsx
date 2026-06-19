// ─────────────────────────────────────────────────────────────────────────────
// ConcoursDiscussionEntry — entrée unique « 💬 Discussion (N) » sur la fiche
// concours (LOT 1). Affiche le total de messages + une pastille de non-lus.
// Tap → écran dédié /concours/[id]/discussion.
// Toujours visible (même à 0 message) pour amorcer l'usage (anti cold-start).
// ─────────────────────────────────────────────────────────────────────────────

import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../constants/theme';
import { useConcoursThread } from '../hooks/useConcoursDiscussion';

interface Props {
  concoursId: string;
}

export function ConcoursDiscussionEntry({ concoursId }: Props) {
  const { total, unread } = useConcoursThread(concoursId);

  return (
    <TouchableOpacity
      style={s.row}
      activeOpacity={0.85}
      onPress={() => router.push(`/concours/${concoursId}/discussion` as any)}
    >
      <Text style={s.icon}>💬</Text>
      <View style={{ flex: 1 }}>
        <Text style={s.label}>Discussion{total > 0 ? ` (${total})` : ''}</Text>
        <Text style={s.sub}>
          {total > 0 ? 'Cavaliers présents, transport, coach…' : 'Lance la discussion de ce concours'}
        </Text>
      </View>
      {unread > 0 && (
        <View style={s.badge}><Text style={s.badgeTxt}>{unread > 99 ? '99+' : unread}</Text></View>
      )}
      <Text style={s.chev}>›</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, marginTop: Spacing.md, ...Shadow.card },
  icon: { fontSize: 20 },
  label: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  sub: { fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: 2 },
  badge: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  badgeTxt: { color: Colors.textInverse, fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  chev: { fontSize: 22, color: Colors.textTertiary },
});
