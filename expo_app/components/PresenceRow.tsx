// ─────────────────────────────────────────────────────────────────────────────
// PresenceRow — ligne « qui vient avec quel cheval » (module Présence concours).
// Hiérarchie : le CHEVAL prime (nom gras, plus grand) ; le cavalier est en appui
// (plus petit, gris) — l'avatar cavalier reste l'ancre sociale à gauche.
// Cas sans cheval : le nom du cavalier passe en ligne 1, « cheval non précisé »
// en ligne 2. Partagée entre le module (fiche) et l'écran « Tous les participants ».
// ─────────────────────────────────────────────────────────────────────────────
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '../constants/colors';
import { Spacing, Radius, FontSize, FontWeight } from '../constants/theme';

interface Props {
  initiales: string;
  avatarColor: string;
  riderName: string;
  chevalNom?: string | null;
  relationLabel?: string | null; // ex. « ⭐ Suivi » ; null = inconnu
  onPress?: () => void;
}

export function PresenceRow({ initiales, avatarColor, riderName, chevalNom, relationLabel, onPress }: Props) {
  const hasCheval = !!chevalNom && chevalNom.trim().length > 0;

  return (
    <TouchableOpacity style={s.row} activeOpacity={onPress ? 0.7 : 1} onPress={onPress} disabled={!onPress}>
      <View style={[s.avatar, { backgroundColor: avatarColor || '#7C3AED' }]}>
        <Text style={s.avatarTxt}>{(initiales || riderName.slice(0, 2)).toUpperCase()}</Text>
      </View>

      <View style={s.meta}>
        {hasCheval ? (
          <>
            <Text style={s.primary} numberOfLines={1}>🐴 {chevalNom}</Text>
            <Text style={s.secondary} numberOfLines={1}>{riderName}</Text>
          </>
        ) : (
          <>
            <Text style={s.primary} numberOfLines={1}>{riderName}</Text>
            <Text style={s.secondaryDim} numberOfLines={1}>cheval non précisé</Text>
          </>
        )}
      </View>

      {relationLabel ? <Text style={s.badge}>{relationLabel}</Text> : null}
      {onPress ? <Text style={s.chev}>›</Text> : null}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.sm },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { color: '#fff', fontWeight: FontWeight.bold, fontSize: FontSize.sm },
  meta: { flex: 1 },
  // CHEVAL = information la plus visible (gras, taille base).
  primary: { fontSize: FontSize.base, fontWeight: FontWeight.extrabold, color: Colors.textPrimary },
  // Cavalier = appui (plus petit, secondaire).
  secondary: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 1 },
  secondaryDim: { fontSize: FontSize.xs, color: Colors.textTertiary, fontStyle: 'italic', marginTop: 1 },
  badge: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.semibold },
  chev: { fontSize: FontSize.lg, color: Colors.textTertiary, marginLeft: Spacing.xs },
});
