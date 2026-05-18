// ─────────────────────────────────────────────────────────────────────────────
// /boost-cancelled — Page de retour si l'utilisateur annule le checkout Boost.
// ─────────────────────────────────────────────────────────────────────────────

import { View, Text, SafeAreaView, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../constants/colors';
import { Spacing, Radius, FontSize, FontWeight } from '../constants/theme';

export default function BoostCancelledScreen() {
  return (
    <SafeAreaView style={s.root}>
      <View style={s.center}>
        <Text style={s.icon}>↩️</Text>
        <Text style={s.title}>Paiement annulé</Text>
        <Text style={s.subtitle}>Aucun montant n'a été débité.</Text>
        <View style={{ height: Spacing.lg }} />
        <TouchableOpacity style={s.btnPrimary} onPress={() => router.replace('/boost-coach' as any)}>
          <Text style={s.btnPrimaryText}>Réessayer</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.btnGhost} onPress={() => router.replace('/(tabs)/profil-coach' as any)}>
          <Text style={s.btnGhostText}>Retour au profil</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  icon: { fontSize: 64, marginBottom: Spacing.md },
  title: { fontSize: FontSize.xxl, fontWeight: FontWeight.extrabold, color: Colors.textPrimary, marginBottom: Spacing.xs },
  subtitle: { fontSize: FontSize.base, color: Colors.textSecondary, textAlign: 'center', marginBottom: Spacing.lg },
  btnPrimary: { backgroundColor: '#92400E', borderRadius: Radius.md, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, marginBottom: Spacing.sm },
  btnPrimaryText: { color: '#fff', fontSize: FontSize.base, fontWeight: FontWeight.bold },
  btnGhost: { paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md },
  btnGhostText: { color: Colors.textSecondary, fontSize: FontSize.base, fontWeight: FontWeight.semibold },
});
