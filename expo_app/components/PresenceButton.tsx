// ─────────────────────────────────────────────────────────────────────────────
// PresenceButton — « 🟢 J'y serai » sur la fiche concours (PR2a, mig 089).
//
// Toggle 1-tap : déclare / retire ma présence. Quand je suis présent, un
// ChevalPicker (réutilisé) apparaît pour attacher un cheval (facultatif).
// Masqué si la table 089 n'est pas dispo ou si l'utilisateur ne peut pas déclarer.
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Colors } from '../constants/colors';
import { Spacing, Radius, FontSize, FontWeight } from '../constants/theme';
import { useConcoursPresence } from '../hooks/useConcoursPresence';
import { ChevalPicker } from './ChevalPicker';
import { trackCta } from '../lib/analytics';

export function PresenceButton({ concoursId }: { concoursId: string }) {
  const { present, chevalId, isReady, available, busy, canDeclare, declare, remove } =
    useConcoursPresence(concoursId);

  // Rien à afficher tant que pas prêt, ou si la feature n'est pas dispo, ou si on
  // ne peut pas déclarer (déconnecté).
  if (!isReady || !available || !canDeclare) return null;

  const onToggle = async () => {
    if (present) {
      await remove();
    } else {
      await declare(null);
      trackCta('concours-fiche', 'presence_declared', { concours_id: concoursId });
    }
  };

  return (
    <View style={s.wrap}>
      <TouchableOpacity
        style={[s.btn, present && s.btnOn]}
        activeOpacity={0.85}
        disabled={busy}
        onPress={() => void onToggle()}
      >
        {busy ? (
          <ActivityIndicator size="small" color={present ? Colors.primary : '#fff'} />
        ) : (
          <Text style={[s.txt, present && s.txtOn]}>
            {present ? '✓ J\'y serai' : '🟢 J\'y serai'}
          </Text>
        )}
      </TouchableOpacity>

      {present && (
        <View style={s.cheval}>
          <ChevalPicker
            value={chevalId}
            onChange={(id) => void declare(id)}
            label="Mon cheval pour ce concours"
          />
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { marginTop: Spacing.md, gap: Spacing.sm },
  btn: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: Radius.lg,
    borderWidth: 2,
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
  btnOn: { backgroundColor: 'transparent' },
  txt: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: '#fff' },
  txtOn: { color: Colors.primary },
  cheval: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
});
