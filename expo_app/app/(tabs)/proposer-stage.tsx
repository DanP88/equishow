import { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView,
  TextInput, Alert, Modal,
} from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../../constants/theme';
import { DatePickerModal, DateButton, formatDate } from '../../components/DatePickerModal';
import { coachStagesStore, userStore } from '../../data/store';
import { CoachStage } from '../../types/service';

const DISCIPLINES = ['Dressage', 'Saut d\'obstacles', 'Cross', 'Western', 'Attelage', 'Équitation de travail', 'Voltige'];
const NIVEAUX = ['Débutant', 'Intermédiaire', 'Avancé', 'Expert'];

export default function ProposerStageScreen() {
  const [titre, setTitre] = useState('');
  const [description, setDescription] = useState('');
  const [dateDebut, setDateDebut] = useState<Date | undefined>(new Date());
  const [dateFin, setDateFin] = useState<Date | undefined>(new Date(new Date().getTime() + 24 * 60 * 60 * 1000));
  const [selectedDisciplines, setSelectedDisciplines] = useState<string[]>([]);
  const [selectedNiveaux, setSelectedNiveaux] = useState<string[]>([]);
  const [tarif, setTarif] = useState('');
  const [places, setPlaces] = useState('10');
  const [showDateDebut, setShowDateDebut] = useState(false);
  const [showDateFin, setShowDateFin] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Calculer le nombre de jours
  const nbJours = dateDebut && dateFin
    ? Math.max(1, Math.round((dateFin.getTime() - dateDebut.getTime()) / (1000 * 60 * 60 * 24)))
    : 1;

  function toggleDiscipline(discipline: string) {
    if (selectedDisciplines.includes(discipline)) {
      setSelectedDisciplines(selectedDisciplines.filter((d) => d !== discipline));
    } else {
      setSelectedDisciplines([...selectedDisciplines, discipline]);
    }
  }

  function toggleNiveau(niveau: string) {
    if (selectedNiveaux.includes(niveau)) {
      setSelectedNiveaux(selectedNiveaux.filter((n) => n !== niveau));
    } else {
      setSelectedNiveaux([...selectedNiveaux, niveau]);
    }
  }

  function submit() {
    if (!titre.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer un titre');
      return;
    }
    if (!dateDebut || !dateFin) {
      Alert.alert('Erreur', 'Sélectionnez les dates du stage');
      return;
    }
    if (dateFin.getTime() <= dateDebut.getTime()) {
      Alert.alert('Erreur', 'La date de fin doit être après la date de début');
      return;
    }
    if (selectedDisciplines.length === 0) {
      Alert.alert('Erreur', 'Sélectionnez au moins une discipline');
      return;
    }
    if (selectedNiveaux.length === 0) {
      Alert.alert('Erreur', 'Sélectionnez au moins un niveau');
      return;
    }
    if (!tarif.trim() || isNaN(parseFloat(tarif))) {
      Alert.alert('Erreur', 'Entrez un tarif valide');
      return;
    }
    if (!places.trim() || isNaN(parseInt(places))) {
      Alert.alert('Erreur', 'Entrez un nombre de places valide');
      return;
    }

    setShowConfirmation(true);
  }

  function handleConfirmation() {
    const newStage: CoachStage = {
      id: `stage_${Date.now()}`,
      auteurId: userStore.id,
      auteurNom: userStore.nom,
      auteurPseudo: userStore.pseudo,
      auteurInitiales: userStore.prenom.charAt(0) + userStore.nom.charAt(0),
      auteurCouleur: userStore.avatarColor,
      titre,
      description,
      disciplines: selectedDisciplines,
      niveaux: selectedNiveaux,
      dateDebut: dateDebut!,
      dateFin: dateFin!,
      nbJours,
      prixTTC: parseFloat(tarif),
      places: parseInt(places),
      placesDisponibles: parseInt(places),
    };

    coachStagesStore.list.push(newStage);
    setShowConfirmation(false);
    router.back();
  }

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Text style={s.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Proposer un stage</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
        {/* Titre */}
        <View style={s.field}>
          <Text style={s.fieldLabel}>Titre du stage *</Text>
          <TextInput
            style={[s.input, !!titre && s.inputFilled]}
            value={titre}
            onChangeText={setTitre}
            placeholder="Ex: Stage d'été dressage"
            placeholderTextColor={Colors.textTertiary}
          />
        </View>

        {/* Dates */}
        <View style={s.field}>
          <Text style={s.fieldLabel}>Dates du stage *</Text>
          <View style={s.datesRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.dateSubLabel}>Début</Text>
              <DateButton label="Date de début" value={dateDebut} onPress={() => setShowDateDebut(true)} />
            </View>
            <Text style={s.dateSep}>→</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.dateSubLabel}>Fin</Text>
              <DateButton label="Date de fin" value={dateFin} onPress={() => setShowDateFin(true)} />
            </View>
          </View>
          <View style={s.nbJoursCard}>
            <Text style={s.nbJoursLabel}>Durée</Text>
            <Text style={s.nbJoursValue}>{nbJours} jour{nbJours > 1 ? 's' : ''}</Text>
          </View>
        </View>

        {/* Disciplines */}
        <View style={s.field}>
          <Text style={s.fieldLabel}>Disciplines *</Text>
          <View style={s.tagsContainer}>
            {DISCIPLINES.map((disc) => (
              <TouchableOpacity
                key={disc}
                style={[s.tag, selectedDisciplines.includes(disc) && s.tagActive]}
                onPress={() => toggleDiscipline(disc)}
              >
                <Text style={[s.tagText, selectedDisciplines.includes(disc) && s.tagTextActive]}>
                  {disc}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Niveaux */}
        <View style={s.field}>
          <Text style={s.fieldLabel}>Niveaux *</Text>
          <View style={s.tagsContainer}>
            {NIVEAUX.map((niv) => (
              <TouchableOpacity
                key={niv}
                style={[s.tag, selectedNiveaux.includes(niv) && s.tagActive]}
                onPress={() => toggleNiveau(niv)}
              >
                <Text style={[s.tagText, selectedNiveaux.includes(niv) && s.tagTextActive]}>
                  {niv}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Tarif */}
        <View style={s.field}>
          <Text style={s.fieldLabel}>Tarif (€ TTC) *</Text>
          <TextInput
            style={[s.input, !!tarif && s.inputFilled]}
            value={tarif}
            onChangeText={setTarif}
            placeholder="Ex: 500"
            placeholderTextColor={Colors.textTertiary}
            keyboardType="decimal-pad"
          />
        </View>

        {/* Places */}
        <View style={s.field}>
          <Text style={s.fieldLabel}>Nombre de places *</Text>
          <TextInput
            style={[s.input, !!places && s.inputFilled]}
            value={places}
            onChangeText={setPlaces}
            placeholder="Ex: 10"
            placeholderTextColor={Colors.textTertiary}
            keyboardType="decimal-pad"
          />
        </View>

        {/* Description */}
        <View style={s.field}>
          <Text style={s.fieldLabel}>Description</Text>
          <TextInput
            style={[s.input, s.inputMultiline, !!description && s.inputFilled]}
            value={description}
            onChangeText={setDescription}
            placeholder="Détails du stage, programme, équipements nécessaires..."
            placeholderTextColor={Colors.textTertiary}
            multiline
            numberOfLines={3}
          />
        </View>

        <TouchableOpacity style={s.submitBtn} onPress={submit} activeOpacity={0.85}>
          <Text style={s.submitText}>Proposer le stage</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Modal de confirmation */}
      <Modal visible={showConfirmation} transparent animationType="fade">
        <View style={s.confirmationBackdrop}>
          <View style={s.confirmationCard}>
            <Text style={s.confirmationIcon}>✅</Text>

            <Text style={s.confirmationTitle}>Stage créé !</Text>

            <Text style={s.confirmationMessage}>
              Votre stage est maintenant visible par les cavaliers
            </Text>

            <View style={s.confirmationDetails}>
              <View style={s.detailRow}>
                <Text style={s.detailIcon}>📚</Text>
                <Text style={s.detailText}>{titre}</Text>
              </View>
              <View style={s.detailRow}>
                <Text style={s.detailIcon}>📅</Text>
                <Text style={s.detailText}>
                  {dateDebut?.toLocaleDateString('fr-FR')} ({nbJours}j)
                </Text>
              </View>
              <View style={s.detailRow}>
                <Text style={s.detailIcon}>🎯</Text>
                <Text style={s.detailText}>{selectedDisciplines.join(', ')}</Text>
              </View>
              <View style={s.detailRow}>
                <Text style={s.detailIcon}>💳</Text>
                <Text style={s.detailText}>{tarif}€ TTC</Text>
              </View>
            </View>

            <View style={s.confirmationButtons}>
              <TouchableOpacity
                style={s.confirmationBtn}
                onPress={handleConfirmation}
              >
                <Text style={s.confirmationBtnText}>Voir les stages</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Date Pickers */}
      {showDateDebut && (
        <DatePickerModal
          visible={showDateDebut}
          value={dateDebut}
          onConfirm={setDateDebut}
          onClose={() => setShowDateDebut(false)}
        />
      )}
      {showDateFin && (
        <DatePickerModal
          visible={showDateFin}
          value={dateFin}
          onConfirm={setDateFin}
          onClose={() => setShowDateFin(false)}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.surface },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surfaceVariant, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 24, color: Colors.textPrimary, lineHeight: 28 },
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  container: { padding: Spacing.lg, gap: Spacing.lg },
  field: { gap: Spacing.sm },
  fieldLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 4, fontSize: FontSize.base, color: Colors.textPrimary, backgroundColor: Colors.surface },
  inputFilled: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  inputMultiline: { minHeight: 80, textAlignVertical: 'top' },
  datesRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.md },
  dateSubLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.textSecondary, marginBottom: Spacing.xs },
  dateSep: { marginBottom: Spacing.sm, fontSize: FontSize.lg, color: Colors.textTertiary },
  nbJoursCard: { backgroundColor: Colors.primaryLight, borderRadius: Radius.md, padding: Spacing.md, marginTop: Spacing.sm, borderWidth: 1, borderColor: Colors.primaryBorder },
  nbJoursLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.primary },
  nbJoursValue: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.primary },
  tagsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  tag: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.lg, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, backgroundColor: Colors.surface },
  tagActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tagText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.semibold },
  tagTextActive: { color: Colors.textInverse, fontWeight: FontWeight.bold },
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
