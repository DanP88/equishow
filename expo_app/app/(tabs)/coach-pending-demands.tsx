import { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView,
  Alert, Modal,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../../constants/theme';
import { courseDemandesStore, userStore, notificationsStore } from '../../data/store';
import { CourseDemande } from '../../types/service';

export default function CoachPendingDemandsScreen() {
  const [demands, setDemands] = useState<CourseDemande[]>([]);
  const [selectedDemand, setSelectedDemand] = useState<CourseDemande | null>(null);
  const [showModal, setShowModal] = useState(false);

  useFocusEffect(useCallback(() => {
    // Récupérer les demandes en attente du coach
    const pending = courseDemandesStore.list.filter(
      d => d.coachId === userStore.id && d.statut === 'pending'
    );
    setDemands(pending);
  }, []));

  const handleAccept = (demand: CourseDemande) => {
    // Marquer comme acceptée
    demand.statut = 'accepted';
    courseDemandesStore.list = [...courseDemandesStore.list];
    setDemands(demands.filter(d => d.id !== demand.id));

    // Envoyer notification au cavalier
    notificationsStore.list = [{
      id: `notif_${Date.now()}`,
      destinataireId: demand.cavalierUserId,
      type: 'course_request',
      titre: '✅ Votre demande a été acceptée!',
      message: `${demand.coachNom} a accepté votre demande pour "${demand.annonceTitre}"`,
      status: 'accepted',
      lu: false,
      dateCreation: new Date(),
      actionUrl: '/(tabs)/pending-payments',
      auteurId: userStore.id,
      auteurNom: userStore.nom,
      auteurPseudo: userStore.pseudo,
      auteurInitiales: `${userStore.prenom[0]}${userStore.nom[0]}`,
      auteurCouleur: userStore.avatarColor,
      donnees: {
        annonceId: demand.annonceId,
        annonceTitre: demand.annonceTitre,
        prix: demand.prix,
      },
    }, ...notificationsStore.list];

    setShowModal(false);
    Alert.alert('✅ Demande acceptée', 'Le cavalier a été notifié et peut maintenant payer.');
  };

  const handleReject = (demand: CourseDemande) => {
    // Marquer comme rejetée
    demand.statut = 'rejected';
    courseDemandesStore.list = [...courseDemandesStore.list];
    setDemands(demands.filter(d => d.id !== demand.id));

    // Envoyer notification au cavalier
    notificationsStore.list = [{
      id: `notif_${Date.now()}`,
      destinataireId: demand.cavalierUserId,
      type: 'course_request',
      titre: '❌ Votre demande a été refusée',
      message: `${demand.coachNom} a refusé votre demande pour "${demand.annonceTitre}"`,
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
    Alert.alert('Demande refusée', 'Le cavalier a été notifié du refus.');
  };

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Demandes en attente</Text>
        {demands.length > 0 && (
          <View style={s.badge}>
            <Text style={s.badgeText}>{demands.length}</Text>
          </View>
        )}
      </View>

      {demands.length === 0 ? (
        <View style={s.emptyState}>
          <Text style={s.emptyIcon}>📋</Text>
          <Text style={s.emptyTitle}>Pas de demandes</Text>
          <Text style={s.emptyText}>Aucune demande en attente de validation</Text>
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
                  <Text style={s.cavalierName}>{demand.cavalierNom}</Text>
                  <Text style={s.annonceTitle}>{demand.annonceTitre}</Text>
                </View>
                <View style={s.priceBadge}>
                  <Text style={s.priceText}>{demand.prix}€</Text>
                </View>
              </View>

              <View style={s.detailsRow}>
                <Text style={s.label}>📅 Dates:</Text>
                <Text style={s.value}>
                  {demand.dateDebut.toLocaleDateString('fr-FR')} → {demand.dateFin.toLocaleDateString('fr-FR')}
                </Text>
              </View>

              <View style={s.detailsRow}>
                <Text style={s.label}>🐴 Cheval:</Text>
                <Text style={s.value}>{demand.cheval}</Text>
              </View>

              <View style={s.detailsRow}>
                <Text style={s.label}>💬 Message:</Text>
                <Text style={s.value} numberOfLines={2}>{demand.message}</Text>
              </View>

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
  cavalierName: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  annonceTitle: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 4 },
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
