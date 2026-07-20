import { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView,
  Alert, Modal,
} from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../../constants/theme';
import { userStore } from '../../data/store';
import { createNotification } from '../../hooks/useNotifications';
import { sendReservationEmail } from '../../utils/sendReservationEmail';
import { CourseDemande } from '../../types/service';
import { useMyCourseDemands } from '../../hooks/useCourseDemands';
import { useCoachAccess } from '../../hooks/useCoachAccess';

export default function CoachPendingDemandsScreen() {
  const { demands: allDemands, updateStatus } = useMyCourseDemands();
  const demands = allDemands.filter(d => d.coachId === userStore.id && d.statut === 'pending');
  const [selectedDemand, setSelectedDemand] = useState<CourseDemande | null>(null);
  const [showModal, setShowModal] = useState(false);

  // Essai gratuit Coach : après 3 séances payées sans offre Pro → blocage DOUX.
  const coachAccess = useCoachAccess();
  const [showUpgrade, setShowUpgrade] = useState(false);

  const handleAccept = async (demand: CourseDemande) => {
    // Blocage doux : essai terminé (3 séances payées) sans abonnement Pro actif.
    // Fail-open : si le statut n'est pas encore chargé ou en erreur, on laisse passer.
    if (!coachAccess.loading && !coachAccess.error && !coachAccess.canAcceptNew) {
      setShowModal(false);
      setShowUpgrade(true);
      return;
    }
    const { error } = await updateStatus(demand.id, 'accepted');
    if (error) {
      if (error.includes('COACH_TRIAL_LIMIT_REACHED')) {
        setShowModal(false);
        setShowUpgrade(true);
      } else {
        Alert.alert('Erreur', error);
      }
      return;
    }

    await createNotification({
      destinataireId: demand.cavalierUserId,
      type: 'course_request',
      titre: '✅ Votre demande a été acceptée!',
      message: `${demand.coachNom} a accepté votre demande pour "${demand.annonceTitre}"`,
      status: 'accepted',
      actionUrl: '/pending-payments',
      donnees: {
        demandId: demand.id,
        annonceId: demand.annonceId,
        annonceTitre: demand.annonceTitre,
        prix: demand.prix,
      },
    });

    // Email « réservation confirmée » aux 2 parties (best-effort, non bloquant).
    await sendReservationEmail('course', demand.id);

    setShowModal(false);
    Alert.alert('✅ Demande acceptée', 'Le cavalier a été notifié et peut maintenant payer.');
  };

  const handleReject = async (demand: CourseDemande) => {
    const { error } = await updateStatus(demand.id, 'rejected');
    if (error) { Alert.alert('Erreur', error); return; }

    await createNotification({
      destinataireId: demand.cavalierUserId,
      type: 'course_request',
      titre: '❌ Votre demande a été refusée',
      message: `${demand.coachNom} a refusé votre demande pour "${demand.annonceTitre}"`,
      status: 'rejected',
    });

    setShowModal(false);
    Alert.alert('Demande refusée', 'Le cavalier a été notifié du refus.');
  };

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <TouchableOpacity
          style={s.backBtn}
          onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/coach-agenda')}
        >
          <Text style={s.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Demandes en attente</Text>
        {demands.length > 0 ? (
          <View style={s.badge}>
            <Text style={s.badgeText}>{demands.length}</Text>
          </View>
        ) : <View style={{ width: 28 }} />}
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
                  <Text style={s.priceText}>{demand.prixSeller}€</Text>
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

      {/* Blocage doux — message positif après les 3 séances payées (essai terminé) */}
      <Modal visible={showUpgrade} transparent animationType="fade" onRequestClose={() => setShowUpgrade(false)}>
        <View style={s.upgradeOverlay}>
          <View style={s.upgradeCard}>
            <Text style={s.upgradeEmoji}>{coachAccess.trialBlockedDuplicate ? '👋' : '🎉'}</Text>
            <Text style={s.upgradeTitle}>
              {coachAccess.trialBlockedDuplicate ? 'Compte professionnel déjà connu' : 'Félicitations !'}
            </Text>
            <Text style={s.upgradeText}>
              {coachAccess.trialBlockedDuplicate
                ? "Un compte professionnel semble déjà exister pour cette activité. Contactez le support si vous pensez qu'il s'agit d'une erreur, ou choisissez une offre Pro pour accepter de nouvelles réservations."
                : 'Vous avez réalisé vos 3 premières séances payées. Choisissez une offre Pro pour continuer à recevoir de nouvelles réservations.'}
            </Text>
            <TouchableOpacity
              style={s.upgradePrimary}
              activeOpacity={0.85}
              onPress={() => { setShowUpgrade(false); router.push('/tarification?role=coach' as any); }}
            >
              <Text style={s.upgradePrimaryText}>Voir les offres Pro →</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.upgradeSecondary} onPress={() => setShowUpgrade(false)}>
              <Text style={s.upgradeSecondaryText}>Plus tard</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  upgradeOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  upgradeCard: { width: '100%', maxWidth: 380, backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.xl, alignItems: 'center', ...Shadow.card },
  upgradeEmoji: { fontSize: 40 },
  upgradeTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.extrabold, color: Colors.textPrimary, marginTop: Spacing.sm },
  upgradeText: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 21, marginTop: Spacing.sm },
  upgradePrimary: { alignSelf: 'stretch', backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center', marginTop: Spacing.lg },
  upgradePrimaryText: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: '#fff' },
  upgradeSecondary: { paddingVertical: Spacing.md, alignItems: 'center' },
  upgradeSecondaryText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textSecondary },

  root: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
    gap: Spacing.md,
  },
  backBtn: {
    width: 32, height: 32,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: 16,
  },
  backIcon: { fontSize: 22, color: Colors.textPrimary, fontWeight: FontWeight.bold },
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
