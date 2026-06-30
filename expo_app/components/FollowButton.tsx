// ─────────────────────────────────────────────────────────────────────────────
// FollowButton — bouton "Suivre / Suivi" réutilisable (PR1, mig 088).
//
// S'appuie sur useFollow(userId) (persistance Supabase user_follows).
// - masqué si c'est mon propre profil (isSelf) ou si je ne peux pas suivre
//   (non connecté / cible non valide), sauf si hideWhenUnavailable=false.
// - optimistic via le hook. Désactivé pendant la requête.
//
// Modification minimale : composant autonome, utilisable sur n'importe quel
// écran profil (cavalier / coach / org) sans toucher leur UX existante.
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { Pressable, Text, StyleSheet, ActivityIndicator, View } from 'react-native';
import { useFollow } from '../hooks/useFollow';

type Props = {
  userId: string;
  /** Si true (défaut), le bouton disparaît quand on ne peut pas suivre (moi / déconnecté). */
  hideWhenUnavailable?: boolean;
};

export default function FollowButton({ userId, hideWhenUnavailable = true }: Props) {
  const { following, toggleFollow, loading, canFollow, isSelf } = useFollow(userId);

  if (hideWhenUnavailable && (isSelf || !canFollow)) return null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={following ? 'Ne plus suivre' : 'Suivre'}
      disabled={loading || !canFollow}
      onPress={() => void toggleFollow()}
      style={[styles.btn, following && styles.btnActive, (loading || !canFollow) && styles.btnDisabled]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={following ? '#1d4ed8' : '#fff'} />
      ) : (
        <View style={styles.row}>
          <Text style={[styles.txt, following && styles.txtActive]}>
            {following ? '✓ Suivi' : '+ Suivre'}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#1d4ed8',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 96,
    minHeight: 36,
  },
  btnActive: {
    backgroundColor: '#eef2ff',
    borderWidth: 1,
    borderColor: '#1d4ed8',
  },
  btnDisabled: { opacity: 0.6 },
  row: { flexDirection: 'row', alignItems: 'center' },
  txt: { color: '#fff', fontWeight: '700', fontSize: 14 },
  txtActive: { color: '#1d4ed8' },
});
