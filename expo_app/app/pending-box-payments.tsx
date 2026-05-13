import { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView,
  Alert, ActivityIndicator, Linking,
} from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../constants/theme';
import { userStore } from '../data/store';
import { useAuth } from '../hooks/useAuth';
import { useMyBoxReservations } from '../hooks/useBoxes';
import { createNotification } from '../hooks/useNotifications';
import { BoxReservation } from '../types/service';
import { getAuthToken } from '../utils/supabaseAuth';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export default function PendingBoxPaymentsScreen() {
  const { profile } = useAuth();
  const { reservations, updateStatut } = useMyBoxReservations();
  const [loading, setLoading] = useState(false);

  const validatedReservations = reservations.filter(
    (r) => r.buyerId === profile?.id && r.statut === 'accepted',
  );

  const handlePayNow = async (reservation: BoxReservation) => {
    try {
      setLoading(true);

      // Vérifier les variables d'environnement
      if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        Alert.alert('Erreur', 'Configuration Supabase manquante');
        return;
      }

      const userToken = await getAuthToken();
      if (!userToken) {
        Alert.alert('Erreur', 'Session expirée, veuillez vous reconnecter');
        return;
      }

      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/create-checkout-session`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${userToken}`,
            'apikey': SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            type: 'box',
            reservationId: reservation.id,
            description: `Box à ${reservation.lieu} du ${reservation.dateDebut.toLocaleDateString('fr-FR')} au ${reservation.dateFin.toLocaleDateString('fr-FR')}`,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.text();
        console.error('Edge Function error:', errorData);
        Alert.alert('Erreur', 'Impossible de créer la session de paiement');
        return;
      }

      const data = await response.json();

      if (!data.checkoutUrl) {
        Alert.alert('Erreur', 'URL de paiement non disponible: ' + (data.error || 'Unknown error'));
        return;
      }

      await updateStatut(reservation.id, 'awaiting_payment');

      await createNotification({
        destinataireId: reservation.sellerId,
        type: 'reservation_request',
        titre: '💳 Paiement en cours',
        message: `${userStore.nom} procède au paiement pour "${reservation.titre}"`,
        status: 'pending',
        donnees: {
          titre: reservation.titre,
          prix: reservation.prixTotalTTC,
        },
      });

      // Rediriger vers Stripe
      await Linking.openURL(data.checkoutUrl);
    } catch (error) {
      console.error('Payment error:', error);
      Alert.alert('Erreur', 'Une erreur est survenue lors de l\'initiation du paiement');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Boxes à payer</Text>
        {validatedReservations.length > 0 && (
          <View style={s.badge}>
            <Text style={s.badgeText}>{validatedReservations.length}</Text>
          </View>
        )}
      </View>

      {validatedReservations.length === 0 ? (
        <View style={s.emptyState}>
          <Text style={s.emptyIcon}>🏠</Text>
          <Text style={s.emptyTitle}>Pas de paiement en attente</Text>
          <Text style={s.emptyText}>Vos réservations de box validées apparaîtront ici</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.container}>
          {validatedReservations.map(reservation => (
            <View
              key={reservation.id}
              style={s.card}
            >
              <View style={s.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={s.titre}>{reservation.titre}</Text>
                  <Text style={s.lieu}>📍 {reservation.lieu}</Text>
                </View>
                <View style={s.priceBadge}>
                  <Text style={s.priceText}>{reservation.prixTotalTTC}€</Text>
                </View>
              </View>

              <View style={s.detailsRow}>
                <Text style={s.label}>📅 Dates:</Text>
                <Text style={s.value}>
                  {reservation.dateDebut.toLocaleDateString('fr-FR')} → {reservation.dateFin.toLocaleDateString('fr-FR')}
                </Text>
              </View>

              <View style={s.detailsRow}>
                <Text style={s.label}>🌙 Nuits:</Text>
                <Text style={s.value}>{reservation.nbNuits}</Text>
              </View>

              {reservation.message && (
                <View style={s.detailsRow}>
                  <Text style={s.label}>💬 Message:</Text>
                  <Text style={s.value} numberOfLines={2}>{reservation.message}</Text>
                </View>
              )}

              <View style={s.statusBadge}>
                <Text style={s.statusText}>✅ Validée par le propriétaire</Text>
              </View>

              <TouchableOpacity
                style={[s.btn, s.payBtn]}
                onPress={() => handlePayNow(reservation)}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={Colors.textInverse} />
                ) : (
                  <Text style={s.payBtnText}>💳 Payer maintenant</Text>
                )}
              </TouchableOpacity>
            </View>
          ))}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  headerTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  badge: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  badgeText: {
    color: Colors.textInverse,
    fontWeight: FontWeight.bold,
    fontSize: FontSize.xs,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
  },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  emptyText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  container: { padding: Spacing.lg, gap: Spacing.md },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.card,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
    gap: Spacing.md,
  },
  titre: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  lieu: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 4 },
  priceBadge: {
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  priceText: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.primary },
  detailsRow: {
    flexDirection: 'row',
    marginBottom: Spacing.sm,
  },
  label: { fontSize: FontSize.sm, color: Colors.textSecondary, minWidth: 80 },
  value: { fontSize: FontSize.sm, color: Colors.textPrimary, flex: 1 },
  statusBadge: {
    backgroundColor: '#ECFDF5',
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginVertical: Spacing.md,
  },
  statusText: { fontSize: FontSize.sm, color: '#10B981', fontWeight: FontWeight.bold },
  btn: {
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    alignItems: 'center',
  },
  payBtn: { backgroundColor: Colors.primary },
  payBtnText: { color: Colors.textInverse, fontWeight: FontWeight.bold, fontSize: FontSize.sm },
});
