import { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView,
  Alert, ActivityIndicator, Linking,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Colors } from '../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../constants/theme';
import { transportReservationsStore, userStore, notificationsStore } from '../data/store';
import { Notification } from '../types/notification';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

interface TransportReservation {
  id: string;
  transportId: string;
  sellerId: string;
  buyerId: string;
  titre: string;
  villeDepart: string;
  villeArrivee: string;
  nbPlaces: number;
  message: string;
  prixTotalHT: number;
  commissionPlateform: number;
  prixTotalTTC: number;
  statut: 'pending' | 'accepted' | 'rejected' | 'awaiting_payment' | 'paid';
}

export default function PendingTransportPaymentsScreen() {
  const [validatedReservations, setValidatedReservations] = useState<TransportReservation[]>([]);
  const [loading, setLoading] = useState(false);

  useFocusEffect(useCallback(() => {
    // Récupérer les réservations de transport acceptées du cavalier
    const validated = transportReservationsStore.list.filter(
      (r: TransportReservation) => r.buyerId === userStore.id && r.statut === 'accepted'
    );
    setValidatedReservations(validated);
  }, []));

  const handlePayNow = async (reservation: TransportReservation) => {
    try {
      setLoading(true);

      // Vérifier les variables d'environnement
      if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        Alert.alert('Erreur', 'Configuration Supabase manquante');
        return;
      }

      // Appeler l'Edge Function pour créer une session de paiement Stripe
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/create-checkout-session`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            type: 'transport',
            reservationId: reservation.id,
            amount: reservation.prixTotalTTC,
            description: `Transport ${reservation.villeDepart} → ${reservation.villeArrivee}`,
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

      // Marquer comme en attente de paiement
      reservation.statut = 'awaiting_payment';
      transportReservationsStore.list = [...transportReservationsStore.list];

      // Envoyer notification au propriétaire que le cavalier va payer
      const paymentNotif: Notification = {
        id: `notif_${Date.now()}`,
        destinataireId: reservation.sellerId,
        type: 'reservation_request',
        titre: '💳 Paiement en cours',
        message: `${userStore.nom} procède au paiement pour "${reservation.titre}"`,
        status: 'pending',
        lu: false,
        dateCreation: new Date(),
        auteurId: userStore.id,
        auteurNom: userStore.nom,
        auteurPseudo: userStore.pseudo,
        auteurInitiales: `${userStore.prenom[0]}${userStore.nom[0]}`,
        auteurCouleur: userStore.avatarColor,
        donnees: {
          titre: reservation.titre,
          prix: reservation.prixTotalTTC,
        },
      };
      notificationsStore.list = [paymentNotif, ...notificationsStore.list];

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
        <Text style={s.headerTitle}>Transports à payer</Text>
        {validatedReservations.length > 0 && (
          <View style={s.badge}>
            <Text style={s.badgeText}>{validatedReservations.length}</Text>
          </View>
        )}
      </View>

      {validatedReservations.length === 0 ? (
        <View style={s.emptyState}>
          <Text style={s.emptyIcon}>🚐</Text>
          <Text style={s.emptyTitle}>Pas de paiement en attente</Text>
          <Text style={s.emptyText}>Vos réservations de transport validées apparaîtront ici</Text>
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
                  <Text style={s.trajet}>
                    {reservation.villeDepart} → {reservation.villeArrivee}
                  </Text>
                </View>
                <View style={s.priceBadge}>
                  <Text style={s.priceText}>{reservation.prixTotalTTC}€</Text>
                </View>
              </View>

              <View style={s.detailsRow}>
                <Text style={s.label}>🪑 Places:</Text>
                <Text style={s.value}>{reservation.nbPlaces}</Text>
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
  trajet: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 4 },
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
