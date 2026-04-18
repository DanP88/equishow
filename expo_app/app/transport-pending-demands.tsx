import { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView,
  Alert, Modal,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Colors } from '../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../constants/theme';
import { transportReservationsStore, userStore, notificationsStore } from '../data/store';
import { TransportReservation } from '../types/service';

export default function TransportPendingDemandsScreen() {
  const [demands, setDemands] = useState<TransportReservation[]>([]);
  const [selectedDemand, setSelectedDemand] = useState<TransportReservation | null>(null);
  const [showModal, setShowModal] = useState(false);

  useFocusEffect(useCallback(() => {
    // Récupérer les réservations en attente du propriétaire
    const pending = transportReservationsStore.list.filter(
      d => d.sellerId === userStore.id && d.statut === 'pending'
    );
    setDemands(pending);
  }, []));

  const handleAccept = (demand: TransportReservation) => {
    // Marquer comme acceptée
    demand.statut = 'accepted';
    transportReservationsStore.list = [...transportReservationsStore.list];
    setDemands(demands.filter(d => d.id !== demand.id));

    // Envoyer notification au cavalier
    notificationsStore.list = [{
      id: `notif_${Date.now()}`,
      destinataireId: demand.buyerId,
      type: 'reservation_request',
      titre: '✅ Votre réservation de transport a été acceptée!',
      message: `Votre réservation pour "${demand.titre}" a été acceptée. Vous pouvez maintenant procéder au paiement.`,
      status: 'accepted',
      lu: false,
      dateCreation: new Date(),
      actionUrl: '/pending-transport-payments',
      auteurId: userStore.id,
      auteurNom: userStore.nom,
      auteurPseudo: userStore.pseudo,
      auteurInitiales: `${userStore.prenom[0]}${userStore.nom[0]}`,
      auteurCouleur: userStore.avatarColor,
      donnees: {
        transportId: demand.transportId,
        titre: demand.titre,
        prix: demand.prixTotalTTC,
      },
    }, ...notificationsStore.list];

    setShowModal(false);
    Alert.alert('✅ Réservation acceptée', 'Le cavalier a été notifié et peut maintenant payer.');
  };

  const handleReject = (demand: TransportReservation) => {
    // Marquer comme rejetée
    demand.statut = 'rejected';
    transportReservationsStore.list = [...transportReservationsStore.list];
    setDemands(demands.filter(d => d.id !== demand.id));

    // Envoyer notification au cavalier
    notificationsStore.list = [{
      id: `notif_${Date.now()}`,
      destinataireId: demand.buyerId,
      type: 'reservation_request',
      titre: '❌ Votre réservation de transport a été refusée',
      message: `Votre réservation pour "${demand.titre}" a été refusée.`,
      status: 'rejected',
      lu: false,
      dateCreation: new Date(),
      auteurId: userStore.id,
      auteurNom: userStore.nom,
      auteurPseudo: userStore.pseudo,
      auteurInitiales: `${userStore.prenom[0]}${userStore.nom[0]}`,
      auteurCouleur: userStore.avatarColor,
    }, ...notificationsStore.list];

    setShowModal(false);
    Alert.alert('Réservation refusée', 'Le cavalier a été notifié du refus.');
  };

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Réservations de transport</Text>
        {demands.length > 0 && (
          <View style={s.badge}>
            <Text style={s.badgeText}>{demands.length}</Text>
          </View>
        )}
      </View>

      {demands.length === 0 ? (
        <View style={s.emptyState}>
          <Text style={s.emptyIcon}>🚐</Text>
          <Text style={s.emptyTitle}>Pas de réservations</Text>
          <Text style={s.emptyText}>Aucune réservation en attente de validation</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.container}>
          {demands.map(demand => (
            <TouchableOpacity
              key={demand.id}
              style={s.card}
              onPress={() => {
                setSelectedDemand(demand);
                setShowModal(true);
              }}
            >
              <View style={s.cardHeader}>
                <View>
                  <Text style={s.title}>{demand.titre}</Text>
                  <Text style={s.trajet}>
                    {demand.villeDepart} → {demand.villeArrivee}
                  </Text>
                </View>
                <View style={s.priceBadge}>
                  <Text style={s.priceText}>{demand.prixTotalTTC}€</Text>
                </View>
              </View>

              <View style={s.detailsRow}>
                <Text style={s.label}>👤 Cavalier:</Text>
                <Text style={s.value}>{demand.buyerId}</Text>
              </View>

              <View style={s.detailsRow}>
                <Text style={s.label}>🪑 Places:</Text>
                <Text style={s.value}>{demand.nbPlaces}</Text>
              </View>

              {demand.message && (
                <View style={s.detailsRow}>
                  <Text style={s.label}>💬 Message:</Text>
                  <Text style={s.value} numberOfLines={2}>{demand.message}</Text>
                </View>
              )}

              <View style={s.buttonRow}>
                <TouchableOpacity style={[s.btn, s.rejectBtn]} onPress={() => handleReject(demand)}>
                  <Text style={s.rejectBtnText}>❌ Refuser</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.btn, s.acceptBtn]} onPress={() => handleAccept(demand)}>
                  <Text style={s.acceptBtnText}>✅ Accepter</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
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
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  title: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
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
  buttonRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  btn: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    alignItems: 'center',
  },
  rejectBtn: { backgroundColor: Colors.background, borderWidth: 1, borderColor: '#EF4444' },
  rejectBtnText: { color: '#EF4444', fontWeight: FontWeight.bold, fontSize: FontSize.sm },
  acceptBtn: { backgroundColor: Colors.primary },
  acceptBtnText: { color: Colors.textInverse, fontWeight: FontWeight.bold, fontSize: FontSize.sm },
});
