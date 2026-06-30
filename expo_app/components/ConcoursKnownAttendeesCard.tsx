// ─────────────────────────────────────────────────────────────────────────────
// ConcoursKnownAttendeesCard — hero « X personnes que vous connaissez seront
// présentes » sur la fiche concours (PR2a, mig 089).
//
// Lit fn_concours_known_attendees (intersection présence × fn_people_i_know).
// Masqué proprement si 0 résultat (anti cold-start). Aperçu de 3, « Voir tout »
// déplie le reste in-place. Tap sur une personne → son profil (réutilise option C).
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../constants/theme';
import { useConcoursKnownAttendees, KnownAttendee } from '../hooks/useConcoursPresence';
import { trackCta } from '../lib/analytics';

const PREVIEW = 3;

function relationLabel(a: KnownAttendee): string {
  if (a.role === 'coach') return '🎓 Coach';
  if (a.role === 'organisateur') return '🏟️ Organisateur';
  if (a.relation === 'club') return '🏟️ Club';
  if (a.relation === 'booked') return '🤝 Déjà réservé';
  if (a.relation === 'messaged') return '💬 Déjà échangé';
  return '⭐ Suivi';
}

function displayName(a: KnownAttendee): string {
  return a.pseudo?.trim() || a.prenom?.trim() || 'Cavalier';
}

export function ConcoursKnownAttendeesCard({ concoursId }: { concoursId: string }) {
  const { attendees, count, isReady, available } = useConcoursKnownAttendees(concoursId);
  const [showAll, setShowAll] = useState(false);
  const tracked = useRef(false);

  // presence_hero_view : une fois, quand le hero s'affiche avec ≥1 personne.
  useEffect(() => {
    if (isReady && available && count > 0 && !tracked.current) {
      tracked.current = true;
      trackCta('concours-fiche', 'presence_hero_view', { concours_id: concoursId, count });
    }
  }, [isReady, available, count, concoursId]);

  // Masqué proprement : pas prêt, indispo, ou 0 relation présente.
  if (!isReady || !available || count === 0) return null;

  const shown = showAll ? attendees : attendees.slice(0, PREVIEW);

  const openProfile = (a: KnownAttendee) => {
    trackCta('concours-fiche', 'presence_avatar_tap', { concours_id: concoursId, target: a.user_id });
    router.push(`/user-profile/${a.user_id}` as any);
  };

  return (
    <View style={s.card}>
      <Text style={s.title}>
        👥 {count} personne{count > 1 ? 's' : ''} que vous connaissez
        {count > 1 ? ' seront présentes' : ' sera présente'}
      </Text>

      {/* Pile d'avatars (aperçu visuel) */}
      <View style={s.avatarStack}>
        {attendees.slice(0, 5).map((a, i) => (
          <View
            key={a.user_id}
            style={[s.stackAvatar, { backgroundColor: a.avatar_color || '#7C3AED', marginLeft: i === 0 ? 0 : -10 }]}
          >
            <Text style={s.stackAvatarTxt}>{a.initiales || displayName(a).slice(0, 2).toUpperCase()}</Text>
          </View>
        ))}
        {count > 5 && <Text style={s.more}>+{count - 5}</Text>}
      </View>

      {/* Lignes détaillées */}
      <View style={s.list}>
        {shown.map((a) => (
          <TouchableOpacity key={a.user_id} style={s.row} activeOpacity={0.7} onPress={() => openProfile(a)}>
            <View style={[s.rowAvatar, { backgroundColor: a.avatar_color || '#7C3AED' }]}>
              <Text style={s.rowAvatarTxt}>{a.initiales || displayName(a).slice(0, 2).toUpperCase()}</Text>
            </View>
            <View style={s.rowMeta}>
              <Text style={s.rowName}>
                {displayName(a)}
                {a.cheval_nom ? <Text style={s.cheval}>  🐴 {a.cheval_nom}</Text> : null}
              </Text>
              <Text style={s.rowRel}>{relationLabel(a)}</Text>
            </View>
            <Text style={s.chev}>›</Text>
          </TouchableOpacity>
        ))}
      </View>

      {count > PREVIEW && (
        <TouchableOpacity onPress={() => setShowAll((v) => !v)} activeOpacity={0.7}>
          <Text style={s.seeAll}>{showAll ? 'Réduire' : `Voir tout (${count})`}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    marginTop: Spacing.md,
    ...Shadow.card,
  },
  title: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.md },
  avatarStack: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md },
  stackAvatar: {
    width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.surface,
  },
  stackAvatarTxt: { color: '#fff', fontWeight: FontWeight.bold, fontSize: FontSize.xs },
  more: { marginLeft: Spacing.sm, color: Colors.textSecondary, fontWeight: FontWeight.semibold, fontSize: FontSize.sm },
  list: { gap: Spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm, gap: Spacing.md },
  rowAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  rowAvatarTxt: { color: '#fff', fontWeight: FontWeight.bold, fontSize: FontSize.sm },
  rowMeta: { flex: 1 },
  rowName: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  cheval: { fontWeight: FontWeight.regular, color: Colors.textSecondary, fontSize: FontSize.xs },
  rowRel: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 1 },
  chev: { fontSize: FontSize.lg, color: Colors.textTertiary },
  seeAll: { marginTop: Spacing.sm, color: Colors.primary, fontWeight: FontWeight.semibold, fontSize: FontSize.sm, textAlign: 'center' },
});
