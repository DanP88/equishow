// ─────────────────────────────────────────────────────────────────────────────
// Écran « Tous les participants » d'un concours (module Présence).
// Liste virtualisée (FlatList) — supporte les gros concours (100+).
// Ordre : Vous → Que vous connaissez → Autres participants. Cheval-forward via
// PresenceRow. Tous les présents sont affichés (présence = visibilité assumée).
// 0 payments/escrow/Stripe.
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors } from '../../../constants/colors';
import { Spacing, FontSize, FontWeight } from '../../../constants/theme';
import { useAuth } from '../../../hooks/useAuth';
import { useConcoursAttendees, useConcoursKnownAttendees, KnownAttendee } from '../../../hooks/useConcoursPresence';
import { useUsersByIds } from '../../../hooks/useUsersByIds';
import { useChevauxByIds } from '../../../hooks/useChevauxByIds';
import { PresenceRow } from '../../../components/PresenceRow';

function relationLabel(a: KnownAttendee): string {
  if (a.role === 'coach') return '🎓 Coach';
  if (a.role === 'organisateur') return '🏟️ Organisateur';
  if (a.relation === 'club') return '🏟️ Club';
  if (a.relation === 'booked') return '🤝 Réservé';
  if (a.relation === 'messaged') return '💬 Échangé';
  return '⭐ Suivi';
}

type ListItem =
  | { type: 'header'; key: string; label: string }
  | { type: 'row'; key: string; userId: string; riderName: string; initiales: string; avatarColor: string; chevalNom: string | null; relation: string | null; me: boolean };

export default function ConcoursParticipantsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const selfId = profile?.id;

  const { rows, isReady } = useConcoursAttendees(id);
  const { attendees: known } = useConcoursKnownAttendees(id);

  const usersById = useUsersByIds(rows.map((r) => r.user_id));
  const chevauxById = useChevauxByIds(rows.map((r) => r.cheval_id));

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace(`/concours/${id}` as any);
  };

  const data = useMemo<ListItem[]>(() => {
    const knownMap = new Map<string, KnownAttendee>();
    known.forEach((k) => knownMap.set(k.user_id, k));

    const riderName = (userId: string, me: boolean): string => {
      if (me) return 'Vous';
      const u = usersById.get(userId);
      const full = `${u?.prenom ?? ''} ${u?.nom ?? ''}`.trim();
      return full || u?.pseudo || 'Cavalier';
    };
    const toRow = (userId: string, chevalId: string | null): Extract<ListItem, { type: 'row' }> => {
      const me = !!selfId && userId === selfId;
      const u = usersById.get(userId);
      const k = knownMap.get(userId);
      return {
        type: 'row', key: userId, userId, me,
        riderName: riderName(userId, me),
        initiales: u?.initiales || riderName(userId, me).slice(0, 2),
        avatarColor: u?.avatar_color || '#7C3AED',
        chevalNom: chevalId ? (chevauxById.get(chevalId) ?? null) : null,
        relation: me ? null : (k ? relationLabel(k) : null),
      };
    };

    const meRows = rows.filter((r) => selfId && r.user_id === selfId);
    const knownRows = rows.filter((r) => r.user_id !== selfId && knownMap.has(r.user_id));
    const otherRows = rows.filter((r) => r.user_id !== selfId && !knownMap.has(r.user_id));

    const out: ListItem[] = [];
    if (meRows.length) {
      out.push({ type: 'header', key: 'h-vous', label: 'Vous' });
      meRows.forEach((r) => out.push(toRow(r.user_id, r.cheval_id)));
    }
    if (knownRows.length) {
      out.push({ type: 'header', key: 'h-known', label: `Que vous connaissez · ${knownRows.length}` });
      knownRows.forEach((r) => out.push(toRow(r.user_id, r.cheval_id)));
    }
    if (otherRows.length) {
      out.push({ type: 'header', key: 'h-other', label: `Autres participants · ${otherRows.length}` });
      otherRows.forEach((r) => out.push(toRow(r.user_id, r.cheval_id)));
    }
    return out;
  }, [rows, known, usersById, chevauxById, selfId]);

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <TouchableOpacity onPress={goBack} style={s.back}><Text style={s.backTxt}>←</Text></TouchableOpacity>
        <Text style={s.title} numberOfLines={1}>Tous les participants{rows.length ? ` (${rows.length})` : ''}</Text>
      </View>

      {!isReady ? (
        <View style={s.loader}><ActivityIndicator size="large" color={Colors.primary} /></View>
      ) : rows.length === 0 ? (
        <View style={s.loader}><Text style={s.empty}>Aucun participant déclaré pour l'instant.</Text></View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(it) => it.key}
          contentContainerStyle={s.list}
          initialNumToRender={20}
          windowSize={10}
          renderItem={({ item }) =>
            item.type === 'header' ? (
              <Text style={s.groupLabel}>{item.label}</Text>
            ) : (
              <PresenceRow
                initiales={item.initiales}
                avatarColor={item.avatarColor}
                riderName={item.riderName}
                chevalNom={item.chevalNom}
                relationLabel={item.me ? 'Vous' : item.relation}
                onPress={item.me ? undefined : () => router.push(`/user-profile/${item.userId}` as any)}
              />
            )
          }
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  back: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surfaceVariant },
  backTxt: { fontSize: 20, color: Colors.textPrimary },
  title: { flex: 1, fontSize: FontSize.lg, fontWeight: FontWeight.extrabold, color: Colors.textPrimary },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { fontSize: FontSize.sm, color: Colors.textTertiary, fontStyle: 'italic' },
  list: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, paddingBottom: 60 },
  groupLabel: { fontSize: FontSize.xs, letterSpacing: 0.5, textTransform: 'uppercase', color: Colors.textTertiary, fontWeight: FontWeight.bold, marginTop: Spacing.lg, marginBottom: Spacing.xs },
});
