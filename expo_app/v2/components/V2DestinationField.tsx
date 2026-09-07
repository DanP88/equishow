// ─────────────────────────────────────────────────────────────────────────────
// V2DestinationField — champ « destination / zone » d'un besoin.
//
// Quand le besoin est lié à un concours, la valeur est pré-remplie avec le LIEU
// RÉEL du concours (via useAutoDestination) et l'utilisateur voit clairement
// d'où elle vient. Il peut la modifier (précision) : un lien permet de revenir
// au lieu du concours. « Autre concours » / aucun concours → champ 100 % manuel.
// ─────────────────────────────────────────────────────────────────────────────
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '../../constants/colors';
import { Radius, FontSize, FontWeight, Spacing } from '../../constants/theme';
import type { AutoDestination } from '../state/autoDestination';

export function V2DestinationField({
  label,
  auto,
  placeholder = 'Ville / commune',
  concoursNom,
}: {
  label: string;
  auto: AutoDestination;
  placeholder?: string;
  /** Nom du concours saisi librement (« Autre concours »), sans lieu connu. */
  concoursNom?: string;
}) {
  return (
    <View style={s.wrap}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        style={s.input}
        value={auto.value}
        onChangeText={auto.onChange}
        placeholder={placeholder}
        placeholderTextColor={Colors.textTertiary}
      />
      {auto.fromConcours ? (
        <Text style={s.fromConcours}>
          📍 Renseigné depuis le concours — {auto.dest.label.toLowerCase()}
        </Text>
      ) : auto.dest.text ? (
        <TouchableOpacity onPress={auto.reset} hitSlop={6}>
          <Text style={s.reset}>↺ Remettre le lieu du concours ({auto.dest.text})</Text>
        </TouchableOpacity>
      ) : concoursNom ? (
        <Text style={s.manual}>
          Concours « {concoursNom} » saisi librement — destination à préciser.
        </Text>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: 4, marginTop: Spacing.sm },
  label: {
    fontSize: 11,
    fontWeight: FontWeight.bold,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 3,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
    backgroundColor: Colors.surface,
  },
  fromConcours: { fontSize: FontSize.xs, color: Colors.primaryDark, fontWeight: FontWeight.semibold },
  reset: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: FontWeight.bold },
  manual: { fontSize: FontSize.xs, color: Colors.textTertiary, fontStyle: 'italic' },
});
