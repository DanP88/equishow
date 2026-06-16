import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView,
  TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors } from '../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../constants/theme';
import { DatePickerModal, DateButton, formatDate } from '../components/DatePickerModal';
import { useBoxAnnonces, useMyBoxReservations } from '../hooks/useBoxes';
import { createNotification } from '../hooks/useNotifications';
import { useAuth } from '../hooks/useAuth';
import { getCommission } from '../types/service';
import { useScreenTracking } from '../hooks/useScreenTracking';
import { trackFunnel } from '../lib/analytics';
import { ConfirmModal } from '../components/ConfirmModal';
import { AlertModal } from '../components/AlertModal';
import { ChevalPicker } from '../components/ChevalPicker';

export default function ReserverBoxScreen() {
  useScreenTracking('reserver-box');
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const { boxes } = useBoxAnnonces();
  const { createReservation } = useMyBoxReservations();
  const box = boxes.find((b) => b.id === id);

  // ⚠️ React #310 : tous les hooks doivent être appelés AVANT tout return conditionnel,
  // sinon le re-render quand `box` passe de undefined → object déclenche un mismatch
  // du nombre de hooks. Init des dates via useEffect dès que box est disponible.
  const [dateReservationDebut, setDateReservationDebut] = useState<Date | undefined>(undefined);
  const [dateReservationFin, setDateReservationFin] = useState<Date | undefined>(undefined);
  const [message, setMessage] = useState('');
  const [chevalId, setChevalId] = useState<string | null>(null);
  const [showDateDebut, setShowDateDebut] = useState(false);
  const [showDateFin, setShowDateFin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errorAlert, setErrorAlert] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (box && !dateReservationDebut) {
      setDateReservationDebut(box.dateDebut);
      setDateReservationFin(new Date(box.dateDebut.getTime() + 24 * 60 * 60 * 1000));
    }
  }, [box, dateReservationDebut]);

  // Funnel Lot 3 : ouverture de l'écran de réservation (étape open_reserve).
  useEffect(() => {
    if (id) trackFunnel('payment', 'open_reserve', { module: 'box', listing_id: id });
  }, [id]);

  if (!box) {
    return (
      <SafeAreaView style={s.root}>
        <View style={s.errorContainer}>
          <Text style={s.errorText}>Box non trouvé</Text>
          <TouchableOpacity style={s.backBtn2} onPress={() => router.canGoBack() ? router.back() : router.replace('/')}>
            <Text style={s.backText}>Retour</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const joursDisponibles = Math.max(1, Math.round((box.dateFin.getTime() - box.dateDebut.getTime()) / (1000 * 60 * 60 * 24)));

  // Calculer le nombre de nuits réservées
  const nuitesReservees = dateReservationDebut && dateReservationFin
    ? Math.max(1, Math.round((dateReservationFin.getTime() - dateReservationDebut.getTime()) / (1000 * 60 * 60 * 24)))
    : 1;

  // App ET Stripe facturent le même montant : sous-total + commission Equishow.
  const sousTotal = box.prixNuitHT * nuitesReservees;
  const commissionRate = getCommission('box');
  const commissionMontant = Math.round(sousTotal * commissionRate * 100) / 100;
  const totalAPayer = Math.round((sousTotal + commissionMontant) * 100) / 100;
  const commissionPct = Math.round(commissionRate * 100);

  const validate = (): string | null => {
    if (!dateReservationDebut || !dateReservationFin) return 'Sélectionnez les dates de votre réservation.';
    if (dateReservationFin.getTime() <= dateReservationDebut.getTime()) return 'La date de fin doit être après la date de début.';
    if (dateReservationDebut < box.dateDebut || dateReservationFin > box.dateFin) {
      return `Le box n'est disponible que du ${box.dateDebut.toLocaleDateString('fr-FR')} au ${box.dateFin.toLocaleDateString('fr-FR')}.`;
    }
    return null;
  };

  const onSubmitPress = () => {
    const err = validate();
    if (err) { setErrorAlert(err); return; }
    setShowConfirm(true);
  };

  const doSubmit = async () => {
    setShowConfirm(false);
    if (!dateReservationDebut || !dateReservationFin) return;
    const sellerId = box.auteurId;
    setLoading(true);
    try {
      const titre = `Box ${box.lieu}`;
      const { data: created, error: createErr } = await createReservation({
        boxId: box.id,
        sellerId,
        titre,
        lieu: box.lieu,
        nbNuits: nuitesReservees,
        dateDebut: dateReservationDebut,
        dateFin: dateReservationFin,
        message: message.trim(),
        prixTotalHT: sousTotal,
        commissionPlateform: commissionMontant,
        prixTotalTTC: totalAPayer,
        chevalId,
      });

      if (createErr || !created) {
        setErrorAlert(createErr ?? 'Impossible de créer la réservation.');
        return;
      }

      // Funnel Lot 3 : demande créée (étape submit_reserve, pivot reservation_id).
      trackFunnel('payment', 'submit_reserve', {
        module: 'box', listing_id: box.id, reservation_id: created.id,
        seller_id: sellerId, amount: Math.round(totalAPayer * 100),
      });

      await createNotification({
        destinataireId: sellerId,
        type: 'reservation_request',
        titre: '🏠 Nouvelle demande de box',
        message: `${profile?.prenom ?? ''} ${profile?.nom ?? ''} demande à réserver "${box.lieu}" du ${dateReservationDebut.toLocaleDateString('fr-FR')} au ${dateReservationFin.toLocaleDateString('fr-FR')}.`,
        status: 'pending',
        actionUrl: '/box-pending-demands',
        donnees: { boxId: box.id, titre, prix: totalAPayer, message: message.trim() },
      });

      const ownerLabel = box.auteurNom?.trim() || box.auteurPseudo?.trim() || 'le propriétaire du box';
      setSuccessMessage(
        `Demande envoyée à ${ownerLabel}. Vous serez notifié(e) dès la validation, puis vous pourrez procéder au paiement de ${totalAPayer.toFixed(2)}€.`,
      );
    } catch {
      setErrorAlert('Erreur lors de la création de la réservation.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.canGoBack() ? router.back() : router.replace('/')}>
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
              <Text style={s.priceHT}>{box.prixNuitHT}€/nuit</Text>
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
          <Text style={s.fieldHelp}>
            Disponible du {box.dateDebut.toLocaleDateString('fr-FR')} au {box.dateFin.toLocaleDateString('fr-FR')} · touchez les dates pour modifier
          </Text>
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

        {/* Cheval concerné (optionnel) */}
        <View style={s.field}>
          <ChevalPicker value={chevalId} onChange={(id) => setChevalId(id)} />
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

        {/* Prix récap — sans TVA (location P2P entre particuliers) */}
        <View style={s.prixCard}>
          <View style={s.prixRow}>
            <Text style={s.prixLabel}>Prix / nuit</Text>
            <Text style={s.prixVal}>{box.prixNuitHT}€</Text>
          </View>
          <View style={s.prixRow}>
            <Text style={s.prixLabel}>Nuits réservées</Text>
            <Text style={s.prixVal}>{nuitesReservees}</Text>
          </View>
          <View style={s.prixRow}>
            <Text style={s.prixLabel}>Sous-total</Text>
            <Text style={s.prixVal}>{sousTotal.toFixed(2)}€</Text>
          </View>
          <View style={s.prixRow}>
            <Text style={s.prixLabel}>Commission Equishow ({commissionPct}%)</Text>
            <Text style={s.prixVal}>+ {commissionMontant.toFixed(2)}€</Text>
          </View>
          <View style={[s.prixRow, s.prixTotal]}>
            <Text style={s.prixTotalLabel}>Total à payer</Text>
            <Text style={s.prixTotalVal}>{totalAPayer.toFixed(2)}€</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[s.submitBtn, loading && { opacity: 0.6 }]}
          onPress={onSubmitPress}
          activeOpacity={0.85}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color={Colors.textInverse} />
            : <Text style={s.submitText}>Envoyer la demande</Text>
          }
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      <ConfirmModal
        visible={showConfirm}
        title="Confirmer la réservation"
        body={
          <View style={cs.body}>
            <View style={cs.row}>
              <Text style={cs.label}>{box.prixNuitHT}€ × {nuitesReservees} nuit{nuitesReservees > 1 ? 's' : ''}</Text>
              <Text style={cs.value}>{sousTotal.toFixed(2)}€</Text>
            </View>
            <View style={cs.row}>
              <Text style={cs.label}>Commission Equishow ({commissionPct}%)</Text>
              <Text style={cs.value}>+ {commissionMontant.toFixed(2)}€</Text>
            </View>
            <View style={cs.divider} />
            <View style={cs.row}>
              <Text style={cs.totalLabel}>Total à payer</Text>
              <Text style={cs.totalValue}>{totalAPayer.toFixed(2)}€</Text>
            </View>
          </View>
        }
        cancelLabel="Annuler"
        confirmLabel="Envoyer la demande"
        onCancel={() => setShowConfirm(false)}
        onConfirm={doSubmit}
      />

      <AlertModal
        visible={!!errorAlert}
        title="Erreur"
        message={errorAlert ?? ''}
        variant="error"
        onClose={() => setErrorAlert(null)}
      />

      <AlertModal
        visible={!!successMessage}
        title="✅ Demande envoyée"
        message={successMessage ?? ''}
        variant="success"
        onClose={() => {
          setSuccessMessage(null);
          router.replace('/cavalier-agenda');
        }}
      />

      <DatePickerModal
        visible={showDateDebut}
        value={dateReservationDebut}
        title="Date d'arrivée"
        minDate={box.dateDebut}
        // L'arrivée doit laisser au moins 1 nuit (max = veille de la fin de plage)
        maxDate={new Date(box.dateFin.getTime() - 24 * 60 * 60 * 1000)}
        onConfirm={(d) => {
          setDateReservationDebut(d);
          // Cohérence : si le départ est antérieur ou égal à l'arrivée, le repousser à arrivée+1
          if (dateReservationFin && dateReservationFin.getTime() <= d.getTime()) {
            const nextDay = new Date(d.getTime() + 24 * 60 * 60 * 1000);
            setDateReservationFin(nextDay <= box.dateFin ? nextDay : box.dateFin);
          }
        }}
        onClose={() => setShowDateDebut(false)}
      />

      <DatePickerModal
        visible={showDateFin}
        value={dateReservationFin}
        title="Date de départ"
        // Le départ doit être strictement après l'arrivée (min = arrivée + 1 jour)
        minDate={dateReservationDebut
          ? new Date(dateReservationDebut.getTime() + 24 * 60 * 60 * 1000)
          : box.dateDebut}
        maxDate={box.dateFin}
        onConfirm={(d) => setDateReservationFin(d)}
        onClose={() => setShowDateFin(false)}
      />

    </SafeAreaView>
  );
}

const cs = StyleSheet.create({
  body: { gap: Spacing.sm, marginTop: Spacing.xs },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: FontSize.sm, color: Colors.textSecondary },
  value: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.xs },
  totalLabel: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  totalValue: { fontSize: FontSize.xl, fontWeight: FontWeight.extrabold, color: Colors.primary },
});

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
  fieldHelp: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: -Spacing.xs },
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
});
