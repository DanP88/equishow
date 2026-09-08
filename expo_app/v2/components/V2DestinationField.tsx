// ─────────────────────────────────────────────────────────────────────────────
// V2DestinationField — champ « destination / zone » d'un besoin.
//
// Quand le besoin est lié à un concours, la valeur est pré-remplie avec le LIEU
// RÉEL du concours (via useAutoDestination) et l'utilisateur voit clairement
// d'où elle vient. Il peut la modifier (précision) : un lien permet de revenir
// au lieu du concours. « Autre concours » / aucun concours → champ 100 % manuel.
//
// Saisie assistée : suggestions de villes / adresses (Nominatim, sans clé).
// ─────────────────────────────────────────────────────────────────────────────
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '../../constants/colors';
import { BL } from '../ui/blush';
import { FontSize, FontWeight, Spacing } from '../../constants/theme';
import type { AutoDestination } from '../state/autoDestination';
import { V2AddressAutocomplete } from './V2AddressAutocomplete';

export function V2DestinationField({
  label,
  auto,
  placeholder = 'Ville / commune',
  concoursNom,
  kind = 'city',
}: {
  label: string;
  auto: AutoDestination;
  placeholder?: string;
  /** Nom du concours saisi librement (« Autre concours »), sans lieu connu. */
  concoursNom?: string;
  /** 'city' (suggestions de communes) ou 'address' (adresses complètes). */
  kind?: 'city' | 'address';
}) {
  return (
    <View style={s.wrap}>
      <Text style={s.label}>{label}</Text>
      <V2AddressAutocomplete
        value={auto.value}
        onChangeText={auto.onChange}
        placeholder={placeholder}
        kind={kind}
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
  fromConcours: { fontSize: FontSize.xs, color: BL.accent, fontWeight: FontWeight.semibold },
  reset: { fontSize: FontSize.xs, color: BL.accent, fontWeight: FontWeight.bold },
  manual: { fontSize: FontSize.xs, color: Colors.textTertiary, fontStyle: 'italic' },
});
