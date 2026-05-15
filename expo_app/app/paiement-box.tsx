import { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  SafeAreaView, ActivityIndicator, Platform, Linking,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../constants/theme';
import { getAuthToken } from '../utils/supabaseAuth';

export default function PaiementBoxScreen() {
  const { reservationId, titre, montant, nbNuits, lieu, dateDebut, dateFin, reference } =
    useLocalSearchParams<{
      reservationId: string; titre: string; montant: string;
      nbNuits: string; lieu: string; dateDebut: string; dateFin: string; reference?: string;
    }>();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePay() {
    setLoading(true);
    setError(null);
    try {
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      if (!supabaseUrl) throw new Error('Configuration manquante.');

      const token = await getAuthToken();
      const resp = await fetch(`${supabaseUrl}/functions/v1/create-checkout-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          type: 'box',
          reservationId,
          amount: parseFloat(montant ?? '0'),
          description: `Box ${lieu} · ${nbNuits} nuit${Number(nbNuits) > 1 ? 's' : ''} (${dateDebut} → ${dateFin})`,
        }),
      });

      const data = await resp.json();
      if (!resp.ok || !data.checkoutUrl) throw new Error(data.error || 'Erreur lors de la création du paiement.');

      if (Platform.OS === 'web') {
        window.location.href = data.checkoutUrl;
      } else {
        await Linking.openURL(data.checkoutUrl);
      }
    } catch (err: any) {
      setError(err.message || 'Impossible de démarrer le paiement.');
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={s.root}>
      <View style={s.stripeHeader}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.canGoBack() ? router.back() : router.replace('/')}>
          <Text style={s.backIcon}>‹</Text>
        </TouchableOpacity>
        <View style={s.stripeBadge}>
          <Text style={s.stripeLock}>🔒</Text>
          <Text style={s.stripeText}>Paiement sécurisé</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
        {/* Récap commande */}
        <View style={s.orderCard}>
          <Text style={s.orderLabel}>Récapitulatif</Text>
          <View style={s.orderRow}>
            <Text style={s.orderDesc}>🏠 {lieu}</Text>
          </View>
          <View style={s.orderRow}>
            <Text style={s.orderMeta}>{nbNuits} nuit(s) · {dateDebut} → {dateFin}</Text>
            <Text style={s.orderAmount}>{montant}€</Text>
          </View>
          {reference ? (
            <View style={s.refRow}>
              <Text style={s.refLabel}>Référence</Text>
              <Text style={s.refValue}>{reference}</Text>
            </View>
          ) : null}
        </View>

        {/* Info Stripe */}
        <View style={s.stripeInfo}>
          <Text style={s.stripeInfoTitle}>Paiement via Stripe</Text>
          <Text style={s.stripeInfoText}>
            Vous allez être redirigé vers la page de paiement sécurisée Stripe.
            Vos données bancaires ne transitent jamais par nos serveurs.
          </Text>
        </View>

        {error ? (
          <View style={s.errorBox}>
            <Text style={s.errorText}>{error}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={[s.payBtn, loading && s.payBtnLoading]}
          onPress={handlePay}
          activeOpacity={0.85}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.payBtnText}>Payer {montant}€ avec Stripe</Text>
          }
        </TouchableOpacity>

        <View style={s.stripeMentions}>
          <Text style={s.stripeMentionsText}>
            Paiement sécurisé par Stripe · Vos données ne sont jamais stockées sur nos serveurs.
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F6F9FC' },
  stripeHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E3E8EF',
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F0F2F5', alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 24, color: '#1A1A2E', lineHeight: 28 },
  stripeBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stripeLock: { fontSize: 14 },
  stripeText: { fontSize: FontSize.sm, color: '#3C4257', fontWeight: FontWeight.semibold },
  container: { padding: Spacing.lg, gap: Spacing.lg },
  orderCard: { backgroundColor: '#fff', borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: '#E3E8EF', ...Shadow.card },
  orderLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: Spacing.sm },
  orderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  orderDesc: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: '#1A1A2E', flex: 1 },
  orderMeta: { fontSize: FontSize.sm, color: '#6B7280', flex: 1 },
  orderAmount: { fontSize: FontSize.xl, fontWeight: FontWeight.extrabold, color: '#1A1A2E' },
  refRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.sm, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: '#E3E8EF' },
  refLabel: { fontSize: FontSize.xs, color: '#6B7280', fontWeight: FontWeight.semibold },
  refValue: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: '#1A1A2E', letterSpacing: 0.5 },
  stripeInfo: { backgroundColor: '#fff', borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: '#E3E8EF', gap: Spacing.sm, ...Shadow.card },
  stripeInfoTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: '#1A1A2E' },
  stripeInfoText: { fontSize: FontSize.sm, color: '#6B7280', lineHeight: 20 },
  errorBox: { backgroundColor: '#FEF2F2', borderRadius: Radius.md, padding: Spacing.md, borderWidth: 1, borderColor: '#FECACA' },
  errorText: { fontSize: FontSize.sm, color: '#DC2626' },
  payBtn: { backgroundColor: '#635BFF', borderRadius: Radius.lg, paddingVertical: Spacing.md + 4, alignItems: 'center', ...Shadow.fab },
  payBtnLoading: { backgroundColor: '#9C97FF' },
  payBtnText: { color: '#fff', fontWeight: FontWeight.extrabold, fontSize: FontSize.base },
  stripeMentions: { alignItems: 'center', paddingHorizontal: Spacing.xl },
  stripeMentionsText: { fontSize: FontSize.xs, color: '#9CA3AF', textAlign: 'center', lineHeight: 18 },
});
