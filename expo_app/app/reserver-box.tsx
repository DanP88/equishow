import { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView,
  TextInput, Alert, Modal, Linking,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors } from '../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../constants/theme';
import { DatePickerModal, DateButton, formatDate } from '../components/DatePickerModal';
import { boxesStore, userStore, boxReservationsStore, notificationsStore } from '../data/store';
import { prixTTC, BoxReservation } from '../types/service';
import { Notification } from '../types/notification';

export default function ReserverBoxScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const box = boxesStore.list.find((b) => b.id === id);

  if (!box) {
    return (
      <SafeAreaView style={s.root}>
        <View style={s.errorContainer}>
          <Text style={s.errorText}>Box non trouvé</Text>
          <TouchableOpacity style={s.backBtn2} onPress={() => router.back()}>
            <Text style={s.backText}>Retour</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const ttc = prixTTC(box.prixNuitHT, 'box');
  const joursDisponibles = Math.max(1, Math.round((box.dateFin.getTime() - box.dateDebut.getTime()) / (1000 * 60 * 60 * 24)));

  // Réservation: le locataire choisit les dates
  const [dateReservationDebut, setDateReservationDebut] = useState<Date | undefined>(box.dateDebut);
  const [dateReservationFin, setDateReservationFin] = useState<Date | undefined>(new Date(box.dateDebut.getTime() + 24 * 60 * 60 * 1000)); // Par défaut 1 nuit
  const [message, setMessage] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showDateDebut, setShowDateDebut] = useState(false);
  const [showDateFin, setShowDateFin] = useState(false);
  const [loading, setLoading] = useState(false);

  // Calculer le nombre de nuits réservées
  const nuitesReservees = dateReservationDebut && dateReservationFin
    ? Math.max(1, Math.round((dateReservationFin.getTime() - dateReservationDebut.getTime()) / (1000 * 60 * 60 * 24)))
    : 1;

  const prixTotal = box.prixNuitHT * nuitesReservees;
  const prixTotalTTC = prixTTC(prixTotal, 'box');

  function showErr(msg: string) {
    if (typeof window !== 'undefined') window.alert(msg);
    else Alert.alert('Erreur', msg);
  }

  function submit() {
    if (!dateReservationDebut || !dateReservationFin) {
      showErr('Sélectionnez les dates de votre réservation.');
      return;
    }
    if (dateReservationFin.getTime() <= dateReservationDebut.getTime()) {
      showErr('La date de fin doit être après la date de début.');
      return;
    }

    const nuits = nuitesReservees;
    const pt = box.prixNuitHT * nuits;
    const ptTTC = prixTTC(pt, 'box');
    const sellerId = (box as any).proprietaireId || box.auteurId;

    const nouvelleReservation: BoxReservation = {
      id: `br_${Date.now()}`,
      boxId: box.id,
      sellerId,
      buyerId: userStore.id,
      titre: `Box ${box.lieu}`,
      lieu: box.lieu,
      nbNuits: nuits,
      dateDebut: dateReservationDebut,
      dateFin: dateReservationFin,
      message: message.trim(),
      prixTotalHT: pt,
      commissionPlateform: pt * 0.05,
      prixTotalTTC: ptTTC,
      statut: 'pending' as const,
      dateCreation: new Date(),
    };

    boxReservationsStore.list = [nouvelleReservation, ...boxReservationsStore.list];

    const notificationBox: Notification = {
      id: `notif_${Date.now()}`,
      destinataireId: sellerId,
      type: 'reservation_request',
      titre: `🏠 Nouvelle réservation de box`,
      message: `${userStore.prenom} ${userStore.nom} demande une réservation pour ${box.lieu}`,
      status: 'pending',
      lu: false,
      dateCreation: new Date(),
      actionUrl: '/box-pending-demands',
      auteurId: userStore.id,
      auteurNom: userStore.nom,
      auteurPseudo: userStore.pseudo,
      auteurInitiales: `${userStore.prenom[0]}${userStore.nom[0]}`,
      auteurCouleur: userStore.avatarColor,
      donnees: {
        boxId: box.id,
        titre: `Box ${box.lieu}`,
        prix: ptTTC,
        message: message.trim(),
      },
    };

    notificationsStore.list = [notificationBox, ...notificationsStore.list];
    console.log('✅ Réservation box créée, redirection paiement');

    router.push({
      pathname: '/paiement-box',
      params: {
        reservationId: nouvelleReservation.id,
        titre: `Box ${box.lieu}`,
        montant: ptTTC.toFixed(2),
        nbNuits: String(nuits),
        lieu: box.lieu,
        dateDebut: dateReservationDebut.toLocaleDateString('fr-FR'),
        dateFin: dateReservationFin.toLocaleDateString('fr-FR'),
      },
    } as any);
  }

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Text style={s.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Réserver des boxes</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
        {/* Box card */}
        <View style={s.boxCard}>
          <View style={s.locationSection}>
            <Text style={s.locationText}>{box.lieu}</Text>
            <View style={s.priceBadge}>
              <Text style={s.priceHT}>{box.prixNuitHT}€/nuit HT</Text>
              <Text style={s.priceTTC}>{ttc}€ TTC</Text>
            </View>
          </View>

          <View style={s.infoRow}>
            <Text style={s.infoLabel}>📅 Période</Text>
            <Text style={s.infoValue}>
              {box.dateDebut.toLocaleDateString('fr-FR')} → {box.dateFin.toLocaleDateString('fr-FR')}
            </Text>
          </View>
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>🌙 Jours disponibles</Text>
            <Text style={s.infoValue}>{joursDisponibles} jour{joursDisponibles > 1 ? 's' : ''}</Text>
          </View>
          {box.concours && (
            <View style={s.infoRow}>
              <Text style={s.infoLabel}>🏆 Concours</Text>
              <Text style={s.infoValue}>{box.concours}</Text>
            </View>
          )}
        </View>

        {/* Dates de réservation */}
        <View style={s.field}>
          <Text style={s.fieldLabel}>Votre réservation *</Text>
          <View style={s.datesRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.dateSubLabel}>Arrivée</Text>
              <DateButton label="Date de début" value={dateReservationDebut} onPress={() => setShowDateDebut(true)} />
            </View>
            <Text style={s.dateSep}>→</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.dateSubLabel}>Départ</Text>
              <DateButton label="Date de fin" value={dateReservationFin} onPress={() => setShowDateFin(true)} />
            </View>
          </View>
        </View>

        {/* Message */}
        <View style={s.field}>
          <Text style={s.fieldLabel}>Message au gestionnaire</Text>
          <TextInput
            style={[s.input, s.inputMultiline, !!message && s.inputFilled]}
            value={message}
            onChangeText={setMessage}
            placeholder="Informations sur vos chevaux, besoins spéciaux..."
            placeholderTextColor={Colors.textTertiary}
            multiline
            numberOfLines={3}
          />
        </View>

        {/* Prix récap */}
        <View style={s.prixCard}>
          <View style={s.prixRow}>
            <Text style={s.prixLabel}>Prix / nuit</Text>
            <Text style={s.prixVal}>{box.prixNuitHT}€ HT</Text>
          </View>
          <View style={s.prixRow}>
            <Text style={s.prixLabel}>Nuits réservées</Text>
            <Text style={s.prixVal}>{nuitesReservees}</Text>
          </View>
          <View style={[s.prixRow, s.prixTotal]}>
            <Text style={s.prixTotalLabel}>Total TTC</Text>
            <Text style={s.prixTotalVal}>{prixTotalTTC}€</Text>
          </View>
        </View>

        <TouchableOpacity style={s.submitBtn} onPress={submit} activeOpacity={0.85}>
          <Text style={s.submitText}>Valider la demande et payer...</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Modal de confirmation */}
      <Modal visible={showConfirmation} transparent animationType="fade">
        <View style={s.confirmationBackdrop}>
          <View style={s.confirmationCard}>
            <Text style={s.confirmationIcon}>✅</Text>

            <Text style={s.confirmationTitle}>Demande envoyée !</Text>

            <Text style={s.confirmationMessage}>
              Le gestionnaire prendra connaissance de votre demande rapidement
            </Text>

            <View style={s.confirmationDetails}>
              <View style={s.detailRow}>
                <Text style={s.detailIcon}>🏠</Text>
                <Text style={s.detailText}>{box.lieu}</Text>
              </View>
              <View style={s.detailRow}>
                <Text style={s.detailIcon}>📅</Text>
                <Text style={s.detailText}>
                  {dateReservationDebut?.toLocaleDateString('fr-FR')} → {dateReservationFin?.toLocaleDateString('fr-FR')}
                </Text>
              </View>
              <View style={s.detailRow}>
                <Text style={s.detailIcon}>🌙</Text>
                <Text style={s.detailText}>{nuitesReservees} nuit{nuitesReservees > 1 ? 's' : ''}</Text>
              </View>
              <View style={s.detailRow}>
                <Text style={s.detailIcon}>💳</Text>
                <Text style={s.detailText}>{prixTotalTTC}€ TTC (à confirmer)</Text>
              </View>
            </View>

            <View style={s.confirmationButtons}>
              <TouchableOpacity
                style={s.confirmationBtn}
                onPress={() => {
                  setShowConfirmation(false);
                  router.push('/(tabs)/services?tab=box' as any);
                }}
              >
                <Text style={s.confirmationBtnText}>Retour aux boxes</Text>
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.surface },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surfaceVariant, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 24, color: Colors.textPrimary, lineHeight: 28 },
  backBtn2: { backgroundColor: Colors.primary, borderRadius: Radius.lg, paddingVertical: Spacing.md + 4, alignItems: 'center', minWidth: 120 },
  backText: { color: Colors.textInverse, fontWeight: FontWeight.extrabold, fontSize: FontSize.base },
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.lg },
  errorText: { fontSize: FontSize.lg, color: Colors.textSecondary },
  container: { padding: Spacing.lg, gap: Spacing.lg },
  boxCard: { backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, ...Shadow.card },
  locationSection: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  locationText: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary, flex: 1 },
  priceBadge: { backgroundColor: Colors.primaryLight, borderRadius: Radius.md, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderWidth: 1, borderColor: Colors.primaryBorder, marginLeft: Spacing.md },
  priceHT: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.bold },
  priceTTC: { fontSize: FontSize.xs, color: Colors.primary },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border },
  infoLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  infoValue: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  field: { gap: Spacing.sm },
  fieldLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5 },
  datesRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.md },
  dateSubLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.textSecondary, marginBottom: Spacing.xs },
  dateSep: { marginBottom: Spacing.sm, fontSize: FontSize.lg, color: Colors.textTertiary },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  minusBtn: { width: 44, height: 44, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  minusBtnText: { fontSize: 24, color: Colors.textPrimary, fontWeight: FontWeight.bold },
  nbBoxesInput: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.primary, minWidth: 60, textAlign: 'center' },
  plusBtn: { width: 44, height: 44, borderRadius: Radius.md, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  plusBtnText: { fontSize: 24, color: Colors.textInverse, fontWeight: FontWeight.bold },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 4, fontSize: FontSize.base, color: Colors.textPrimary, backgroundColor: Colors.surface },
  inputFilled: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  inputMultiline: { minHeight: 80, textAlignVertical: 'top' },
  prixCard: { backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, gap: Spacing.sm },
  prixRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  prixLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  prixVal: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  prixTotal: { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.sm, marginTop: Spacing.xs },
  prixTotalLabel: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  prixTotalVal: { fontSize: FontSize.xl, fontWeight: FontWeight.extrabold, color: Colors.primary },
  submitBtn: { backgroundColor: Colors.primary, borderRadius: Radius.lg, paddingVertical: Spacing.md + 4, alignItems: 'center', ...Shadow.fab },
  submitText: { color: Colors.textInverse, fontWeight: FontWeight.extrabold, fontSize: FontSize.base },
  confirmationBackdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'center', alignItems: 'center' },
  confirmationCard: { backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.xl, alignItems: 'center', marginHorizontal: Spacing.lg, ...Shadow.card },
  confirmationIcon: { fontSize: 64, marginBottom: Spacing.lg },
  confirmationTitle: { fontSize: FontSize.xxl, fontWeight: FontWeight.extrabold, color: Colors.textPrimary, marginBottom: Spacing.sm, textAlign: 'center' },
  confirmationMessage: { fontSize: FontSize.base, color: Colors.textSecondary, textAlign: 'center', marginBottom: Spacing.lg },
  confirmationDetails: { width: '100%', backgroundColor: Colors.background, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.lg, gap: Spacing.sm },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  detailIcon: { fontSize: 18, width: 28 },
  detailText: { fontSize: FontSize.sm, color: Colors.textPrimary, flex: 1 },
  confirmationButtons: { width: '100%', gap: Spacing.md },
  confirmationBtn: { backgroundColor: Colors.primary, borderRadius: Radius.lg, paddingVertical: Spacing.md + 4, alignItems: 'center' },
  confirmationBtnText: { color: Colors.textInverse, fontWeight: FontWeight.extrabold, fontSize: FontSize.base },
});
