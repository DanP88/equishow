// ─────────────────────────────────────────────────────────────────────────────
// /boost-success — Page de retour après paiement Stripe Boost réussi.
//
// On ne refait pas de RPC ici : le webhook-stripe a déjà appliqué le boost.
// On laisse 3-5s au webhook + on relit coach_profiles via useUserBadges (realtime).
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react';
import { View, Text, SafeAreaView, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../constants/colors';
import { Spacing, Radius, FontSize, FontWeight } from '../constants/theme';
import { useAuth } from '../hooks/useAuth';
import { useUserBadges } from '../hooks/useUserBadges';

export default function BoostSuccessScreen() {
  const { profile } = useAuth();
  const { badges, reload } = useUserBadges(profile?.id);
  const [waited, setWaited] = useState(false);

  // Force un reload après 3s pour s'assurer que le webhook a eu le temps
  useEffect(() => {
    const t = setTimeout(() => { reload(); setWaited(true); }, 3000);
    return () => clearTimeout(t);
  }, [reload]);

  const ready = badges?.isBoosted === true;
  const expDate = badges?.boostExpiresAt
    ? new Date(badges.boostExpiresAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  return (
    <SafeAreaView style={s.root}>
      <View style={s.center}>
        {ready ? (
          <>
            <Text style={s.icon}>🚀</Text>
            <Text style={s.title}>Boost activé !</Text>
            {expDate && <Text style={s.subtitle}>Actif jusqu'au {expDate}</Text>}
            <View style={{ height: Spacing.lg }} />
            <TouchableOpacity style={s.btn} onPress={() => router.replace('/(tabs)/profil-coach' as any)}>
              <Text style={s.btnText}>Retour à mon profil</Text>
            </TouchableOpacity>
          </>
        ) : waited ? (
          <>
            <Text style={s.icon}>⏳</Text>
            <Text style={s.title}>Paiement reçu</Text>
            <Text style={s.subtitle}>L'activation peut prendre quelques secondes.</Text>
            <ActivityIndicator color={Colors.primary} style={{ marginTop: Spacing.lg }} />
            <View style={{ height: Spacing.lg }} />
            <TouchableOpacity style={s.btn} onPress={() => router.replace('/(tabs)/profil-coach' as any)}>
              <Text style={s.btnText}>Voir mon profil</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={s.icon}>✓</Text>
            <Text style={s.title}>Paiement confirmé</Text>
            <Text style={s.subtitle}>Activation du Boost en cours…</Text>
            <ActivityIndicator color={Colors.primary} style={{ marginTop: Spacing.lg }} />
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  icon: { fontSize: 64, marginBottom: Spacing.md },
  title: { fontSize: FontSize.xxl, fontWeight: FontWeight.extrabold, color: Colors.textPrimary, marginBottom: Spacing.xs },
  subtitle: { fontSize: FontSize.base, color: Colors.textSecondary, textAlign: 'center' },
  btn: { backgroundColor: Colors.primary, borderRadius: Radius.md, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md },
  btnText: { color: '#fff', fontSize: FontSize.base, fontWeight: FontWeight.bold },
});
