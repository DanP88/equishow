// ─────────────────────────────────────────────────────────────────────────────
// ChevalTag — affichage compact « 🐴 {nom} » du cheval concerné par une résa (078).
// Rendu identique côté cavalier (agenda) et vendeur (demandes). Masqué si aucun
// cheval (chevalId null, ou cheval supprimé → FK SET NULL → nom introuvable).
// ─────────────────────────────────────────────────────────────────────────────

import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../constants/colors';
import { Spacing, Radius, FontSize, FontWeight } from '../constants/theme';

interface Props {
  nom: string | null | undefined;
}

export function ChevalTag({ nom }: Props) {
  if (!nom) return null;
  return (
    <View style={s.tag}>
      <Text style={s.txt} numberOfLines={1}>🐴 {nom}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  tag: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.surfaceVariant,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
  },
  txt: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: Colors.textSecondary,
  },
});
