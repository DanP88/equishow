import { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView,
  TextInput, Alert, Modal,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors } from '../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../constants/theme';
import { coachStagesStore, userStore, notificationsStore, stageReservationsStore } from '../data/store';
import { CoachStage, StageReservation } from '../types/service';
import { Notification } from '../types/notification';

export default function ReserverStageScreen() {
  const { stageId } = useLocalSearchParams<{ stageId: string }>();
  const stage = coachStagesStore.list.find((s) => s.id === stageId);

  const [showDetailsModal, setShowDetailsModal] = useState(true);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [nombreParticipants, setNombreParticipants] = useState('1');
  const [message, setMessage] = useState('');

  if (!stage) {
    return (
      <SafeAreaView style={s.root}>
        <View style={s.errorContainer}>
          <Text style={s.errorText}>Stage non trouvé</Text>
          <TouchableOpacity style={s.backBtn2} onPress={() => router.back()}>
            <Text style={s.backText}>Retour</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const nbParticipants = parseInt(nombreParticipants) || 1;
  const prixTotal = stage.prixTTC * nbParticipants;

  function handleInscription() {
    if (nbParticipants > stage.placesDisponibles) {
      Alert.alert('Erreur', `Seulement ${stage.placesDisponibles} place(s) disponible(s)`);
      return;
    }
    if (nbParticipants < 1) {
      Alert.alert('Erreur', 'Veuillez sélectionner au moins 1 participant');
      return;
    }
    setShowDetailsModal(false);
    setShowConfirmation(true);
  }

  function handleConfirmation() {
    // Créer la réservation
    const reservation = {
      id: `res_stage_${Date.now()}`,
      stageId: stage.id,
      cavalierNom: userStore.nom,
      cavalierPseudo: userStore.pseudo,
      nombreParticipants: nbParticipants,
      prixTotal,
      message,
      dateReservation: new Date(),
    };

    // Créer et envoyer la notification au coach
    const notification: Notification = {
      id: `notif_${Date.now()}`,
      type: 'stage_reservation',
      titre: '📚 Nouvelle inscription à un stage',
      message: `${userStore.prenom} ${userStore.nom} s'est inscrit(e) à votre stage "${stage.titre}"`,
      lu: false,
      status: 'pending',
      dateCreation: new Date(),
      destinataireId: stage.auteurId,
      auteurId: userStore.id,
      auteurNom: userStore.nom,
      auteurPseudo: userStore.pseudo,
      auteurInitiales: userStore.prenom.charAt(0) + userStore.nom.charAt(0),
      auteurCouleur: userStore.avatarColor,
      lien: `/(tabs)/coach-stages`,
      donnees: {
        stageId: stage.id,
        stageTitre: stage.titre,
        nombreParticipants: nbParticipants,
        prixTotal,
        message,
      },
    };

    // Créer une réservation de stage
    const stageReservation: StageReservation = {
      id: `res_${Date.now()}`,
      stageId: stage.id,
      stageTitre: stage.titre,
      coachId: stage.auteurId,
      coachNom: stage.auteurNom,
      cavalierNom: userStore.nom,
      cavalierPseudo: userStore.pseudo,
      cavalierInitiales: userStore.prenom.charAt(0) + userStore.nom.charAt(0),
      cavalierCouleur: userStore.avatarColor,
      cavalierUserId: userStore.id,
      nombreParticipants: nbParticipants,
      prixTotal,
      message,
      statut: 'pending',
      dateReservation: new Date(),
    };

    // Ajouter la notification et la réservation au store
    notificationsStore.list.push(notification);
    stageReservationsStore.list.push(stageReservation);

    console.log('📬 Notification envoyée au coach:', stage.auteurNom);
    console.log('Réservation créée:', stageReservation);

    setShowConfirmation(false);
    router.push('/(tabs)/services?tab=coach' as any);
  }

  return (
    <SafeAreaView style={s.root}>
      {/* Modal détails du stage */}
      <Modal visible={showDetailsModal} transparent animationType="slide">
        <View style={s.modalBackdrop}>
          <View style={s.modalContent}>
            {/* Header */}
            <View style={s.modalHeader}>
              <TouchableOpacity onPress={() => router.back()}>
                <Text style={s.modalCloseBtn}>✕</Text>
              </TouchableOpacity>
              <Text style={s.modalTitle}>Détails du stage</Text>
              <View style={{ width: 28 }} />
            </View>

            <ScrollView style={s.modalScroll} showsVerticalScrollIndicator={false}>
              {/* Auteur */}
              <View style={s.authorSection}>
                <View
                  style={[
                    s.authorAvatar,
                    { backgroundColor: stage.auteurCouleur },
                  ]}
                >
                  <Text style={s.authorInitiales}>{stage.auteurInitiales}</Text>
                </View>
                <View>
                  <Text style={s.authorName}>{stage.auteurNom}</Text>
                  <Text style={s.authorPseudo}>@{stage.auteurPseudo}</Text>
                </View>
              </View>

              {/* Titre et description */}
              <Text style={s.stageTitle}>{stage.titre}</Text>
              <Text style={s.stageDescription}>{stage.description}</Text>

              {/* Infos principales */}
              <View style={s.infoGrid}>
                <View style={s.infoCard}>
                  <Text style={s.infoIcon}>📅</Text>
                  <Text style={s.infoLabel}>Dates</Text>
                  <Text style={s.infoValue}>
                    {stage.dateDebut.toLocaleDateString('fr-FR')}
                  </Text>
                  <Text style={s.infoSmall}>
                    au {stage.dateFin.toLocaleDateString('fr-FR')}
                  </Text>
                </View>

                <View style={s.infoCard}>
                  <Text style={s.infoIcon}>📚</Text>
                  <Text style={s.infoLabel}>Durée</Text>
                  <Text style={s.infoValue}>{stage.nbJours}</Text>
                  <Text style={s.infoSmall}>jour{stage.nbJours > 1 ? 's' : ''}</Text>
                </View>

                <View style={s.infoCard}>
                  <Text style={s.infoIcon}>👥</Text>
                  <Text style={s.infoLabel}>Places</Text>
                  <Text style={s.infoValue}>{stage.placesDisponibles}</Text>
                  <Text style={s.infoSmall}>disponibles</Text>
                </View>

                <View style={s.infoCard}>
                  <Text style={s.infoIcon}>💳</Text>
                  <Text style={s.infoLabel}>Prix</Text>
                  <Text style={s.infoValue}>{stage.prixTTC}€</Text>
                  <Text style={s.infoSmall}>par personne</Text>
                </View>
              </View>

              {/* Disciplines et niveaux */}
              <View style={s.tagsSection}>
                <Text style={s.tagsLabel}>Disciplines</Text>
                <View style={s.tagRow}>
                  {stage.disciplines.map((d) => (
                    <View key={d} style={s.tag}>
                      <Text style={s.tagText}>{d}</Text>
                    </View>
                  ))}
                </View>
              </View>

              <View style={s.tagsSection}>
                <Text style={s.tagsLabel}>Niveaux acceptés</Text>
                <View style={s.tagRow}>
                  {stage.niveaux.map((n) => (
                    <View key={n} style={s.tag}>
                      <Text style={s.tagText}>{n}</Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* Sélection participants */}
              <View style={s.participantsSection}>
                <Text style={s.sectionLabel}>Nombre de participants</Text>
                <View style={s.participantsRow}>
                  <TouchableOpacity
                    style={s.minusBtn}
                    onPress={() => {
                      const n = Math.max(1, parseInt(nombreParticipants) - 1);
                      setNombreParticipants(String(n));
                    }}
                  >
                    <Text style={s.minusBtnText}>−</Text>
                  </TouchableOpacity>

                  <TextInput
                    style={s.participantsInput}
                    value={nombreParticipants}
                    onChangeText={setNombreParticipants}
                    keyboardType="number-pad"
                  />

                  <TouchableOpacity
                    style={s.plusBtn}
                    onPress={() => {
                      const n = Math.min(
                        stage.placesDisponibles,
                        parseInt(nombreParticipants) + 1
                      );
                      setNombreParticipants(String(n));
                    }}
                  >
                    <Text style={s.plusBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Message optionnel */}
              <View style={s.messageSection}>
                <Text style={s.sectionLabel}>Message au coach (optionnel)</Text>
                <TextInput
                  style={s.messageInput}
                  value={message}
                  onChangeText={setMessage}
                  placeholder="Questions, demandes spéciales..."
                  placeholderTextColor={Colors.textTertiary}
                  multiline
                  numberOfLines={3}
                />
              </View>

              {/* Prix total */}
              <View style={s.priceSection}>
                <Text style={s.priceLabel}>Prix total</Text>
                <Text style={s.priceValue}>{prixTotal}€ TTC</Text>
              </View>

              <TouchableOpacity style={s.submitBtn} onPress={handleInscription}>
                <Text style={s.submitText}>Procéder au paiement</Text>
              </TouchableOpacity>

              <View style={{ height: 20 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal confirmation */}
      <Modal visible={showConfirmation} transparent animationType="fade">
        <View style={s.confirmBackdrop}>
          <View style={s.confirmCard}>
            <Text style={s.confirmIcon}>✅</Text>

            <Text style={s.confirmTitle}>Inscription confirmée !</Text>

            <Text style={s.confirmMessage}>
              Le coach a reçu votre demande d'inscription
            </Text>

            <View style={s.confirmDetails}>
              <View style={s.detailRow}>
                <Text style={s.detailIcon}>📚</Text>
                <Text style={s.detailText}>{stage.titre}</Text>
              </View>
              <View style={s.detailRow}>
                <Text style={s.detailIcon}>👤</Text>
                <Text style={s.detailText}>
                  {nbParticipants} participant{nbParticipants > 1 ? 's' : ''}
                </Text>
              </View>
              <View style={s.detailRow}>
                <Text style={s.detailIcon}>💳</Text>
                <Text style={s.detailText}>{prixTotal}€ TTC</Text>
              </View>
              <View style={s.detailRow}>
                <Text style={s.detailIcon}>📍</Text>
                <Text style={s.detailText}>
                  {stage.dateDebut.toLocaleDateString('fr-FR')} - {stage.nbJours}j
                </Text>
              </View>
            </View>

            <View style={s.confirmButtons}>
              <TouchableOpacity
                style={s.confirmBtn}
                onPress={handleConfirmation}
              >
                <Text style={s.confirmBtnText}>Retour aux services</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  errorText: { fontSize: FontSize.lg, color: Colors.textSecondary },
  backBtn2: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md + 4,
    alignItems: 'center',
    minWidth: 120,
  },
  backText: {
    color: Colors.textInverse,
    fontWeight: FontWeight.extrabold,
    fontSize: FontSize.base,
  },

  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xxl,
    borderTopRightRadius: Radius.xxl,
    maxHeight: '90%',
    paddingBottom: Spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalCloseBtn: {
    fontSize: FontSize.xl,
    color: Colors.textSecondary,
    fontWeight: FontWeight.bold,
  },
  modalTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  modalScroll: { flex: 1, padding: Spacing.lg },

  authorSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  authorAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  authorInitiales: {
    color: Colors.textInverse,
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
  },
  authorName: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  authorPseudo: {
    fontSize: FontSize.xs,
    color: Colors.primary,
    fontWeight: FontWeight.semibold,
  },

  stageTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  stageDescription: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: Spacing.lg,
  },

  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  infoCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
    alignItems: 'center',
  },
  infoIcon: { fontSize: 20, marginBottom: Spacing.xs },
  infoLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
    marginTop: Spacing.xs,
  },
  infoSmall: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    marginTop: Spacing.xs,
  },

  tagsSection: { marginBottom: Spacing.lg },
  tagsLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  tag: {
    backgroundColor: Colors.surfaceVariant,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tagText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: FontWeight.semibold,
  },

  participantsSection: { marginBottom: Spacing.lg },
  sectionLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  participantsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  minusBtn: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  minusBtnText: {
    fontSize: 24,
    color: Colors.textPrimary,
    fontWeight: FontWeight.bold,
  },
  participantsInput: {
    flex: 1,
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
  },
  plusBtn: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusBtnText: {
    fontSize: 24,
    color: Colors.textInverse,
    fontWeight: FontWeight.bold,
  },

  messageSection: { marginBottom: Spacing.lg },
  messageInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 4,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
    backgroundColor: Colors.surface,
    minHeight: 80,
    textAlignVertical: 'top',
  },

  priceSection: {
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
    alignItems: 'center',
  },
  priceLabel: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    fontWeight: FontWeight.bold,
  },
  priceValue: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.extrabold,
    color: Colors.primary,
    marginTop: Spacing.sm,
  },

  submitBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md + 4,
    alignItems: 'center',
    ...Shadow.fab,
  },
  submitText: {
    color: Colors.textInverse,
    fontWeight: FontWeight.extrabold,
    fontSize: FontSize.base,
  },

  // Confirmation modal
  confirmBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    marginHorizontal: Spacing.lg,
    ...Shadow.card,
  },
  confirmIcon: { fontSize: 64, marginBottom: Spacing.lg },
  confirmTitle: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.extrabold,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  confirmMessage: {
    fontSize: FontSize.base,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  confirmDetails: {
    width: '100%',
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  detailIcon: { fontSize: 18, width: 28 },
  detailText: { fontSize: FontSize.sm, color: Colors.textPrimary, flex: 1 },
  confirmButtons: { width: '100%', gap: Spacing.md },
  confirmBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md + 4,
    alignItems: 'center',
  },
  confirmBtnText: {
    color: Colors.textInverse,
    fontWeight: FontWeight.extrabold,
    fontSize: FontSize.base,
  },
});
