// ─────────────────────────────────────────────────────────────────────────────
// MessagerieV2 — panneau top bar 💬. UNE SEULE messagerie 1:1, par user id.
// Le contexte (Transport / Box / Coaching / Concours) est une ÉTIQUETTE de
// conversation, jamais un changement d'identité. F2 = liste structurée (mock) ;
// moteur réel (useMessaging V1, déjà unifié) rebranché en F3.
// ─────────────────────────────────────────────────────────────────────────────
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, FontWeight } from '../../constants/theme';
import { Screen, Placeholder } from '../ui/kit';
import { MOCK_CONVERSATIONS } from '../mocks/f2';

export function MessagerieV2() {
  return (
    <Screen>
      <TouchableOpacity onPress={() => router.back()}><Text style={s.back}>← Retour</Text></TouchableOpacity>
      <Text style={s.h1}>Messages</Text>

      {MOCK_CONVERSATIONS.map((c) => (
        <TouchableOpacity key={c.id} style={s.conv} activeOpacity={0.7}>
          <View style={s.row1}>
            <Text style={s.name}>{c.name}</Text>
            <Text style={s.ctx}>{c.context}</Text>
            {c.unread > 0 && <View style={s.badge}><Text style={s.badgeTxt}>{c.unread}</Text></View>}
          </View>
          <View style={s.row2}>
            <Text style={s.last} numberOfLines={1}>{c.last}</Text>
            <Text style={s.when}>{c.when}</Text>
          </View>
        </TouchableOpacity>
      ))}

      <Placeholder note="Messagerie réelle = useMessaging (V1), déjà une seule messagerie par user id, realtime. Ici : liste simulée pour montrer la contextualisation (Transport / Coaching / …). Rebranchée en F3." v1Path="/messagerie" v1Label="Messagerie V1" />
    </Screen>
  );
}

const s = StyleSheet.create({
  back: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.bold },
  h1: { fontSize: FontSize.xxl, fontWeight: FontWeight.extrabold, color: Colors.textPrimary },
  conv: { backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, gap: 4 },
  row1: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  name: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  ctx: { fontSize: FontSize.xs, color: Colors.textSecondary, flex: 1 },
  badge: { backgroundColor: Colors.primary, borderRadius: 9, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeTxt: { color: '#fff', fontSize: 10, fontWeight: '700' },
  row2: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.sm },
  last: { fontSize: FontSize.sm, color: Colors.textSecondary, flex: 1 },
  when: { fontSize: FontSize.xs, color: Colors.textTertiary },
});
