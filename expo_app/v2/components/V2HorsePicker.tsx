// ─────────────────────────────────────────────────────────────────────────────
// V2HorsePicker — sélection MULTIPLE des chevaux du cavalier connecté.
//
// Affiche uniquement les chevaux du compte (réels `useMyChevaux` LECTURE SEULE
// + locaux V2). Aucune sélection artificielle par défaut : c'est l'appelant
// (useSearchHorses / Préparer) qui décide du seed.
//
// CAS SANS CHEVAL : état explicatif + lien vers l'onglet Chevaux. JAMAIS de
// bouton « Ajouter un cheval » ici — la création reste dans l'espace Chevaux.
// ─────────────────────────────────────────────────────────────────────────────
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { BL } from '../ui/blush';
import { Spacing, Radius, FontSize, FontWeight } from '../../constants/theme';
import { GhostButton } from '../ui/kit';
import { useV2AllHorses, horseSubtitle } from '../state/contestHorses';

export function V2HorsePicker({
  value,
  onChange,
  title = 'Pour quel(s) cheval(aux) ?',
  hint,
  compact,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  /** Titre de section ; `null` / '' → aucun titre rendu (l'appelant le gère). */
  title?: string | null;
  hint?: string;
  /** true = masque les sous-titres (année · race · discipline). */
  compact?: boolean;
}) {
  const pool = useV2AllHorses();
  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);

  return (
    <View style={s.wrap}>
      {title ? <Text style={s.title}>{title}</Text> : null}
      {hint ? <Text style={s.hint}>{hint}</Text> : null}

      {pool.ready && pool.isEmpty ? (
        <View style={s.empty}>
          <Text style={s.emptyTxt}>
            Aucun cheval enregistré. Ajoute-en un depuis l'onglet Chevaux, puis
            reviens ici pour le sélectionner.
          </Text>
          <GhostButton label="Ouvrir l'onglet Chevaux" onPress={() => router.push('/(v2)/chevaux' as any)} />
        </View>
      ) : (
        <View style={{ gap: Spacing.sm }}>
          {pool.all.map((h) => {
            const on = value.includes(h.id);
            const sub = horseSubtitle(h);
            return (
              <TouchableOpacity
                key={h.id}
                style={[s.row, on && s.rowOn]}
                activeOpacity={0.85}
                onPress={() => toggle(h.id)}
              >
                <Text style={s.check}>{on ? '☑' : '☐'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.name}>{h.nom}{h.src === 'local' ? '  · local' : ''}</Text>
                  {!compact && !!sub && <Text style={s.subTxt}>{sub}</Text>}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: 6, marginTop: Spacing.sm },
  title: {
    fontSize: 11,
    fontWeight: FontWeight.bold,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  hint: { fontSize: FontSize.xs, color: Colors.textSecondary },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
  },
  rowOn: { borderColor: BL.accent, backgroundColor: BL.accentSoft },
  check: { fontSize: 18, color: BL.accent },
  name: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  subTxt: { fontSize: FontSize.xs, color: Colors.textTertiary },
  empty: {
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
    backgroundColor: Colors.surfaceVariant,
  },
  emptyTxt: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 19 },
});
