import { useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView, Alert } from 'react-native';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../../constants/theme';
import { userStore } from '../../data/store';
import { createNotification } from '../../hooks/useNotifications';
import { useMyCourseDemands } from '../../hooks/useCourseDemands';
import { useMyStageReservations } from '../../hooks/useStages';

export default function CoachDemandesScreen() {
  const { demands: courseDemandes, updateStatus: updateCourseStatus } = useMyCourseDemands();
  const { reservations: stageReservations, updateStatus: updateStageStatus } = useMyStageReservations();

  // Filtrer les demandes EN ATTENTE pour le coach actuel
  const myCourseDemandes = courseDemandes.filter(d => d.coachId === userStore.id && d.statut === 'pending');
  const myStageReservations = stageReservations.filter(r => r.coachId === userStore.id && r.statut === 'pending');

  const handleAcceptCourse = useCallback(async (demandeId: string) => {
    const demande = courseDemandes.find(d => d.id === demandeId);
    if (!demande) return;
    const { error } = await updateCourseStatus(demandeId, 'accepted');
    if (error) { Alert.alert('Erreur', error); return; }

    await createNotification({
      destinataireId: demande.cavalierUserId,
      type: 'course_request',
      titre: '✓ Votre réservation a été acceptée !',
      message: `${userStore.prenom} ${userStore.nom} a accepté votre demande pour "${demande.annonceTitre}"`,
      status: 'accepted',
      actionUrl: '/pending-payments',
      donnees: {
        annonceId: demande.annonceId,
        annonceTitre: demande.annonceTitre,
        prix: demande.prix,
      },
    });
    Alert.alert('✓ Demande acceptée', `Réservation confirmée.`);
  }, [courseDemandes, updateCourseStatus]);

  const handleRejectCourse = useCallback(async (demandeId: string) => {
    const demande = courseDemandes.find(d => d.id === demandeId);
    if (!demande) return;
    const { error } = await updateCourseStatus(demandeId, 'rejected');
    if (error) { Alert.alert('Erreur', error); return; }

    await createNotification({
      destinataireId: demande.cavalierUserId,
      type: 'course_request',
      titre: '✕ Votre réservation a été refusée',
      message: `${userStore.prenom} ${userStore.nom} a refusé votre demande pour "${demande.annonceTitre}"`,
      status: 'rejected',
      donnees: {
        annonceId: demande.annonceId,
        annonceTitre: demande.annonceTitre,
      },
    });
  }, [courseDemandes, updateCourseStatus]);

  const handleAcceptStage = useCallback(async (reservationId: string) => {
    const reservation = stageReservations.find(r => r.id === reservationId);
    if (!reservation) return;
    const { error } = await updateStageStatus(reservationId, 'accepted');
    if (error) { Alert.alert('Erreur', error); return; }

    await createNotification({
      destinataireId: reservation.cavalierUserId,
      type: 'stage_reservation',
      titre: '✓ Votre réservation a été acceptée !',
      message: `${userStore.prenom} ${userStore.nom} a accepté votre réservation pour le stage "${reservation.stageTitre}"`,
      status: 'accepted',
      actionUrl: '/pending-payments',
      donnees: {
        stageId: reservation.stageId,
        stageTitre: reservation.stageTitre,
        nombreParticipants: reservation.nombreParticipants,
        prixTotal: reservation.prixTotal,
      },
    });
    Alert.alert('✓ Demande acceptée', `Réservation confirmée.`);
  }, [stageReservations, updateStageStatus]);

  const handleRejectStage = useCallback(async (reservationId: string) => {
    const reservation = stageReservations.find(r => r.id === reservationId);
    if (!reservation) return;
    const { error } = await updateStageStatus(reservationId, 'rejected');
    if (error) { Alert.alert('Erreur', error); return; }

    await createNotification({
      destinataireId: reservation.cavalierUserId,
      type: 'stage_reservation',
      titre: '✕ Votre réservation a été refusée',
      message: `${userStore.prenom} ${userStore.nom} a refusé votre réservation pour le stage "${reservation.stageTitre}"`,
      status: 'rejected',
      donnees: {
        stageId: reservation.stageId,
        stageTitre: reservation.stageTitre,
      },
    });
  }, [stageReservations, updateStageStatus]);

  const hasAnyDemands = myCourseDemandes.length > 0 || myStageReservations.length > 0;

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Demandes reçues</Text>
      </View>

      <ScrollView contentContainerStyle={s.container} scrollEnabled={true}>
        {!hasAnyDemands ? (
          <View style={s.emptyContainer}>
            <Text style={s.emptyIcon}>📭</Text>
            <Text style={s.emptyText}>Aucune demande de réservation</Text>
          </View>
        ) : null}

        {/* Section: Demandes de cours */}
        {myCourseDemandes.length > 0 && (
          <>
            <Text style={s.sectionTitle}>🎓 Demandes de cours</Text>
            {myCourseDemandes.map((d) => (
              <View key={d.id} style={s.demandeCard}>
                <View style={s.cardHeader}>
                  <View style={[s.avatar, { backgroundColor: d.cavalierCouleur }]}>
                    <Text style={s.avatarText}>{d.cavalierInitiales}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.cardTitle}>🎓 Nouvelle demande de cours</Text>
                    <Text style={s.cardSubtitle}>@{d.cavalierPseudo}</Text>
                  </View>
                </View>

                <Text style={s.cardMessage}>{d.cavalierNom} demande une réservation pour "{d.annonceTitre}"</Text>

                <View style={s.detailsBox}>
                  <View style={s.detailItem}>
                    <Text style={s.detailIcon}>📚</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={s.detailLabel}>ANNONCE</Text>
                      <Text style={s.detailValue}>
                        {d.annonceTitre}
                        {d.concoursNom && ` · ${d.concoursNom}`}
                      </Text>
                    </View>
                  </View>

                  <View style={s.detailItem}>
                    <Text style={s.detailIcon}>📅</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={s.detailLabel}>DATES</Text>
                      <Text style={s.detailValue}>
                        {d.nbJours === 1
                          ? d.dateDebut.toLocaleDateString('fr-FR')
                          : `${d.dateDebut.toLocaleDateString('fr-FR')} → ${d.dateFin.toLocaleDateString('fr-FR')} (${d.nbJours} jours)`
                        }
                      </Text>
                    </View>
                  </View>

                  <View style={s.detailItem}>
                    <Text style={s.detailIcon}>🎯</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={s.detailLabel}>DISCIPLINE · NIVEAU</Text>
                      <Text style={s.detailValue}>{d.discipline} · {d.niveau}</Text>
                    </View>
                  </View>

                  <View style={s.detailItem}>
                    <Text style={s.detailIcon}>🐴</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={s.detailLabel}>CHEVAL</Text>
                      <Text style={s.detailValue}>{d.cheval}</Text>
                    </View>
                  </View>

                  <View style={s.detailItem}>
                    <Text style={s.detailIcon}>💳</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={s.detailLabel}>MONTANT</Text>
                      <Text style={s.detailValue}>{d.prixParJour}€ par jour</Text>
                      {d.nbJours > 1 && (
                        <Text style={s.detailValueSmall}>
                          Total: {d.prixParJour * d.nbJours}€ ({d.nbJours} jours)
                        </Text>
                      )}
                    </View>
                  </View>

                  {d.message && (
                    <View style={s.detailItem}>
                      <Text style={s.detailIcon}>💬</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={s.detailLabel}>MESSAGE</Text>
                        <Text style={s.detailValue}>{d.message}</Text>
                      </View>
                    </View>
                  )}
                </View>

                <Text style={s.dateText}>{d.dateCreation.toLocaleDateString('fr-FR')} {d.dateCreation.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</Text>

                {d.statut === 'pending' ? (
                  <View style={s.actionsContainer}>
                    <TouchableOpacity
                      style={s.acceptBtnLarge}
                      onPress={() => handleAcceptCourse(d.id)}
                      activeOpacity={0.7}
                    >
                      <Text style={s.acceptBtnText}>✓ Accepter</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={s.rejectBtnLarge}
                      onPress={() => handleRejectCourse(d.id)}
                      activeOpacity={0.7}
                    >
                      <Text style={s.rejectBtnText}>✕ Refuser</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={[s.statusBadge, d.statut === 'accepted' ? s.statusAccepted : s.statusRejected]}>
                    <Text style={s.statusBadgeText}>
                      {d.statut === 'accepted' ? '✓ Acceptée' : '✕ Refusée'}
                    </Text>
                  </View>
                )}
              </View>
            ))}
          </>
        )}

        {/* Section: Réservations de stages */}
        {myStageReservations.length > 0 && (
          <>
            <Text style={s.sectionTitle}>📚 Réservations de stages</Text>
            {myStageReservations.map((r) => (
              <View key={r.id} style={s.demandeCard}>
                <View style={s.cardHeader}>
                  <View style={[s.avatar, { backgroundColor: r.cavalierCouleur }]}>
                    <Text style={s.avatarText}>{r.cavalierInitiales}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.cardTitle}>📚 Nouvelle inscription à un stage</Text>
                    <Text style={s.cardSubtitle}>@{r.cavalierPseudo}</Text>
                  </View>
                </View>

                <Text style={s.cardMessage}>{r.cavalierNom} s'est inscrit(e) à votre stage "{r.stageTitre}"</Text>

                <View style={s.detailsBox}>
                  <View style={s.detailItem}>
                    <Text style={s.detailIcon}>📚</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={s.detailLabel}>STAGE</Text>
                      <Text style={s.detailValue}>{r.stageTitre}</Text>
                    </View>
                  </View>

                  <View style={s.detailItem}>
                    <Text style={s.detailIcon}>👥</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={s.detailLabel}>PARTICIPANTS</Text>
                      <Text style={s.detailValue}>{r.nombreParticipants}</Text>
                    </View>
                  </View>

                  <View style={s.detailItem}>
                    <Text style={s.detailIcon}>💳</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={s.detailLabel}>MONTANT</Text>
                      <Text style={s.detailValue}>{r.prixTotal}€ TTC</Text>
                    </View>
                  </View>

                  {r.message && (
                    <View style={s.detailItem}>
                      <Text style={s.detailIcon}>💬</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={s.detailLabel}>MESSAGE</Text>
                        <Text style={s.detailValue}>{r.message}</Text>
                      </View>
                    </View>
                  )}
                </View>

                <Text style={s.dateText}>{r.dateReservation.toLocaleDateString('fr-FR')} {r.dateReservation.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</Text>

                {r.statut === 'pending' ? (
                  <View style={s.actionsContainer}>
                    <TouchableOpacity
                      style={s.acceptBtnLarge}
                      onPress={() => handleAcceptStage(r.id)}
                      activeOpacity={0.7}
                    >
                      <Text style={s.acceptBtnText}>✓ Accepter</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={s.rejectBtnLarge}
                      onPress={() => handleRejectStage(r.id)}
                      activeOpacity={0.7}
                    >
                      <Text style={s.rejectBtnText}>✕ Refuser</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={[s.statusBadge, r.statut === 'accepted' ? s.statusAccepted : s.statusRejected]}>
                    <Text style={s.statusBadgeText}>
                      {r.statut === 'accepted' ? '✓ Acceptée' : '✕ Refusée'}
                    </Text>
                  </View>
                )}
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: { padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  container: { padding: Spacing.lg, gap: Spacing.lg, paddingBottom: Spacing.xl },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.xl },
  emptyIcon: { fontSize: 48, marginBottom: Spacing.md },
  emptyText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  sectionTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.sm },

  // Card styles
  demandeCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.card,
    gap: Spacing.md
  },

  // Header avec avatar
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  avatar: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textInverse },
  cardTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  cardSubtitle: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.semibold, marginTop: Spacing.xs },

  // Message
  cardMessage: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },

  // Details box
  detailsBox: {
    backgroundColor: Colors.background,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.md
  },
  detailItem: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  detailIcon: { fontSize: 20, width: 24 },
  detailLabel: { fontSize: FontSize.xs, color: Colors.textTertiary, fontWeight: FontWeight.bold, textTransform: 'uppercase', letterSpacing: 0.5 },
  detailValue: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginTop: 4 },
  detailValueSmall: { fontSize: FontSize.xs, color: Colors.textTertiary, fontWeight: FontWeight.semibold, marginTop: 2 },

  // Date
  dateText: { fontSize: FontSize.xs, color: Colors.textTertiary, fontStyle: 'italic' },

  // Actions
  actionsContainer: { gap: Spacing.md },
  acceptBtnLarge: {
    backgroundColor: '#D1FAE5',
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md + 2,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#10B981'
  },
  acceptBtnText: { fontWeight: FontWeight.bold, fontSize: FontSize.base, color: '#10B981' },

  rejectBtnLarge: {
    backgroundColor: '#FEE2E2',
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md + 2,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EF4444'
  },
  rejectBtnText: { fontWeight: FontWeight.bold, fontSize: FontSize.base, color: '#EF4444' },

  // Status badge
  statusBadge: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    alignItems: 'center'
  },
  statusAccepted: { backgroundColor: '#D1FAE5', borderWidth: 1, borderColor: '#10B981' },
  statusRejected: { backgroundColor: '#FEE2E2', borderWidth: 1, borderColor: '#EF4444' },
  statusBadgeText: { fontWeight: FontWeight.bold, fontSize: FontSize.base, color: Colors.textPrimary },
});
