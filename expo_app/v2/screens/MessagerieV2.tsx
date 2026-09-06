// ─────────────────────────────────────────────────────────────────────────────
// MessagerieV2 — panneau top bar 💬. UNE SEULE messagerie 1:1, par user id.
// F3 : liste RÉELLE via v2/adapters/messaging (useConversations, V1 — déjà
// unique + realtime). LECTURE SEULE (pas d'envoi ici). Le contexte
// (Transport / Box / Coaching / Concours) est une étiquette, jamais un
// changement d'identité. Repli démo si aucune conversation.
// ─────────────────────────────────────────────────────────────────────────────
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, FontWeight } from '../../constants/theme';
import { Screen, Placeholder } from '../ui/kit';
import { useV2Conversations } from '../adapters/messaging';

export function MessagerieV2() {
  const { conversations, demo } = useV2Conversations();

  return (
    <Screen>
      <TouchableOpacity onPress={() => router.back()} hitSlop={6}><Text style={s.back}>← Retour</Text></TouchableOpacity>
      <Text style={s.h1}>Messages</Text>

      {conversations.length === 0 && <Text style={s.empty}>Aucune conversation.</Text>}

      <View style={{ gap: 8, marginTop: Spacing.sm }}>
        {conversations.map((c) => (
          <TouchableOpacity key={c.id} style={s.conv} activeOpacity={0.7}>
            <View style={[s.avatar, { backgroundColor: c.color }]}><Text style={s.avatarTxt}>{c.initials.slice(0, 2).toUpperCase()}</Text></View>
            <View style={{ flex: 1 }}>
              <View style={s.row1}>
                <Text style={s.name} numberOfLines={1}>{c.name}</Text>
                <Text style={s.when}>{c.when}</Text>
              </View>
              <Text style={s.ctx} numberOfLines={1}>{c.context}</Text>
              <Text style={s.last} numberOfLines={1}>{c.last}</Text>
            </View>
            {c.unread && <View style={s.dot} />}
          </TouchableOpacity>
        ))}
      </View>

      {demo
        ? <Placeholder note="conversations de démonstration — connecte-toi pour voir les tiennes" v1Path="/messagerie" v1Label="messagerie actuelle" />
        : <Placeholder note="une seule messagerie par personne · contexte = étiquette de la conversation" />}
    </Screen>
  );
}

const s = StyleSheet.create({
  back: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.bold },
  h1: { fontSize: 22, fontWeight: FontWeight.extrabold, color: Colors.textPrimary, marginTop: 4 },
  empty: { fontSize: FontSize.sm, color: Colors.textSecondary, fontStyle: 'italic', marginTop: Spacing.md },
  conv: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center', backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: '#ECEBE7', padding: Spacing.md },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { color: '#fff', fontWeight: FontWeight.bold, fontSize: FontSize.sm },
  row1: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: Spacing.sm },
  name: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary, flex: 1 },
  when: { fontSize: FontSize.xs, color: Colors.textTertiary },
  ctx: { fontSize: FontSize.xs, color: Colors.primaryDark, fontWeight: FontWeight.semibold, marginTop: 1 },
  last: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 1 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: Colors.primary },
});
