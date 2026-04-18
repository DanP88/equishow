import { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView,
  TextInput, Alert, Modal, Linking,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors } from '../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../constants/theme';
import { coachAnnoncesStore, userStore, courseDemandesStore, notificationsStore } from '../data/store';
import { CoachAnnonce, CourseDemande } from '../types/service';
import { useCommission } from '../hooks/useCommissions';
import { Notification } from '../types/notification';
import { getAuthToken } from '../utils/supabaseAuth';
import { createClient } from '@supabase/supabase-js';

const NIVEAUX = ['Poney', 'Club', 'Amateur', 'Pro'];

// Générer les dates disponibles entre dateDebut et dateFin
function generateDatesInRange(startDate: Date, endDate: Date): Date[] {
  const dates: Date[] = [];
  const current = new Date(startDate);
  while (current <= endDate) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

export default function ReserverCoachScreen() {
  const { annonceId } = useLocalSearchParams<{ annonceId: string }>();
  const annonce = coachAnnoncesStore.list.find((a) => a.id === annonceId);
  const commissionCours = useCommission('cours');

  if (!annonce) {
    return (
      <SafeAreaView style={s.root}>
        <View style={s.errorContainer}>
          <Text style={s.errorText}>Annonce non trouvée</Text>
          <TouchableOpacity style={s.backBtn2} onPress={() => router.back()}>
            <Text style={s.backText}>Retour</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Disciplines disponibles: celles de l'annonce
  const disciplinesDisponibles = [annonce.discipline];

  // Dates disponibles du concours
  const datesDisponibles = generateDatesInRange(annonce.dateDebut, annonce.dateFin);

  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [discipline, setDiscipline] = useState(annonce.discipline);
  const [niveau, setNiveau] = useState(annonce.niveau);
  const [cheval, setCheval] = useState('');
  const [message, setMessage] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [loading, setLoading] = useState(false);

  // Nombre de jours sélectionnés
  const nbJours = selectedDates.length;

  // Calcul du prix: prix par jour TTC × nombre de jours + commission plateforme
  const prixParJourTTC = Math.round(annonce.prixHeure * 100) / 100;
  const prixTotalHT = prixParJourTTC * nbJours;
  const commissionPlateforme = Math.round(prixTotalHT * commissionCours * 100) / 100;
  const prixTTCTotal = Math.round((prixTotalHT + commissionPlateforme) * 100) / 100;

  // Toggle date selection
  const toggleDateSelection = (d: Date) => {
    const dateStr = d.toDateString();
    const isSelected = selectedDates.some(sd => sd.toDateString() === dateStr);
    if (isSelected) {
      setSelectedDates(selectedDates.filter(sd => sd.toDateString() !== dateStr));
    } else {
      setSelectedDates([...selectedDates, d]);
    }
  };

  async function submit() {
    try {
      console.log('🟢 Submit called');

      // Validation des champs obligatoires
      console.log('📋 Validating fields:', { discipline, niveau, selectedDates: selectedDates.length, cheval });
      const champsManquants = [];
      if (!discipline) champsManquants.push('• Discipline');
      if (!niveau) champsManquants.push('• Votre niveau');
      if (selectedDates.length === 0) champsManquants.push('• Au moins une date');
      if (!cheval.trim()) champsManquants.push('• Cheval / Poney');

      if (champsManquants.length > 0) {
        console.log('❌ Missing fields:', champsManquants);
        Alert.alert(
          'Champs manquants',
          'Veuillez remplir les champs obligatoires:\n\n' + champsManquants.join('\n')
        );
        return;
      }

      console.log('✅ All fields validated');
      setLoading(true);

      const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

      console.log('🔑 Environment:', { SUPABASE_URL: !!SUPABASE_URL, SUPABASE_ANON_KEY: !!SUPABASE_ANON_KEY });

      if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        console.log('❌ Supabase config missing');
        Alert.alert('Erreur', 'Variables Supabase non configurées');
        setLoading(false);
        return;
      }

      const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      const authToken = await getAuthToken();
      if (!authToken) {
        Alert.alert('Erreur', 'Non authentifié');
        return;
      }

      // Trier les dates sélectionnées
      const sortedDates = [...selectedDates].sort((a, b) => a.getTime() - b.getTime());
      const dateDebut = sortedDates[0];
      const dateFin = sortedDates[sortedDates.length - 1];

      // 1. Créer la demande de cours en BD
      const { data: demand, error: demandError } = await supabase
        .from('course_demands')
        .insert({
          annonce_id: annonce.id,
          coach_id: annonce.auteurId,
          cavalier_id: userStore.id,
          title: annonce.titre,
          discipline,
          level: niveau,
          horse_name: cheval.trim(),
          message: message.trim(),
          date_debut: dateDebut.toISOString().split('T')[0],
          date_fin: dateFin.toISOString().split('T')[0],
          nb_jours: nbJours,
          price_per_day_ttc: Math.round(prixParJourTTC * 100),
          total_amount_ht: Math.round(prixTotalHT * 100),
          platform_commission: Math.round(commissionPlateforme * 100),
          total_amount_ttc: Math.round(prixTTCTotal * 100),
          status: 'pending',
        })
        .select('id')
        .single();

      if (demandError || !demand) {
        Alert.alert('Erreur', 'Impossible de créer la demande');
        return;
      }

      // 2. La demande est créée, en attente de validation du coach
      console.log('✅ Demande créée, en attente de validation du coach');

      // 4. Ajouter aussi au store local pour compatibilité
      const nouvelleDemande: CourseDemande = {
        id: demand.id,
        annonceId: annonce.id,
        annonceTitre: annonce.titre,
        concoursNom: annonce.concours,
        coachId: annonce.auteurId,
        coachNom: annonce.auteurNom,
        cavalierNom: userStore.nom,
        cavalierPseudo: userStore.pseudo,
        cavalierInitiales: `${userStore.prenom[0]}${userStore.nom[0]}`,
        cavalierCouleur: userStore.avatarColor,
        cavalierUserId: userStore.id,
        discipline,
        niveau,
        dateDebut,
        dateFin,
        nbJours,
        cheval: cheval.trim(),
        message: message.trim(),
        prixParJour: prixParJourTTC,
        prix: prixTTCTotal,
        statut: 'pending' as const,
        dateCreation: new Date(),
      };

      courseDemandesStore.list = [nouvelleDemande, ...courseDemandesStore.list];

      // 5. Créer notification
      const notification: Notification = {
        id: `notif_${Date.now()}`,
        destinataireId: annonce.auteurId,
        type: 'course_request',
        titre: `🎓 Nouvelle demande de cours`,
        message: `${userStore.prenom} ${userStore.nom} demande une séance pour "${annonce.titre}"`,
        status: 'pending',
        lu: false,
        dateCreation: new Date(),
        actionUrl: '/(tabs)/coach-pending-demands',
        auteurId: userStore.id,
        auteurNom: userStore.nom,
        auteurPseudo: userStore.pseudo,
        auteurInitiales: `${userStore.prenom[0]}${userStore.nom[0]}`,
        auteurCouleur: userStore.avatarColor,
        donnees: {
          annonceId: annonce.id,
          annonceTitre: annonce.titre,
          concoursNom: annonce.concours,
          prix: prixTTCTotal,
          message: message.trim(),
        },
      };

      notificationsStore.list = [notification, ...notificationsStore.list];

      setShowConfirmation(true);
    } catch (error) {
      console.error('❌ Error in submit:', error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.log('Error details:', errorMsg);
      Alert.alert('Erreur', `Une erreur est survenue: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Text style={s.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Réserver une séance</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
        {/* Annonce card */}
        <View style={s.coachCard}>
          <View style={[s.coachAvatar, { backgroundColor: annonce.auteurCouleur }]}>
            <Text style={s.coachInitiales}>{annonce.auteurInitiales}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.coachName}>{annonce.titre}</Text>
            <Text style={s.coachPseudo}>par @{annonce.auteurPseudo}</Text>
            {annonce.concours && (
              <Text style={s.coachDisc}>🏆 {annonce.concours}</Text>
            )}
          </View>
          <View style={s.tarifBadge}>
            <Text style={s.tarifText}>{annonce.prixHeure}€/h HT</Text>
          </View>
        </View>

        {/* Discipline */}
        <View style={s.field}>
          <Text style={s.fieldLabel}>Discipline</Text>
          <View style={s.row}>
            {disciplinesDisponibles.map((d) => (
              <TouchableOpacity key={d} style={[s.chip, discipline === d && s.chipActive]} onPress={() => setDiscipline(d)}>
                <Text style={[s.chipText, discipline === d && s.chipTextActive]}>{d}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Niveau */}
        <View style={s.field}>
          <Text style={s.fieldLabel}>Votre niveau *</Text>
          <View style={s.row}>
            {NIVEAUX.map((n) => (
              <TouchableOpacity key={n} style={[s.chip, niveau === n && s.chipActive]} onPress={() => setNiveau(n)}>
                <Text style={[s.chipText, niveau === n && s.chipTextActive]}>{n}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Dates */}
        <View style={s.field}>
          <Text style={s.fieldLabel}>Dates de la séance * ({nbJours} jour{nbJours > 1 ? 's' : ''})</Text>
          <View style={s.datesGrid}>
            {datesDisponibles.map((d) => {
              const isSelected = selectedDates.some(sd => sd.toDateString() === d.toDateString());
              return (
                <TouchableOpacity
                  key={d.toISOString()}
                  style={[s.dateChip, isSelected && s.dateChipActive]}
                  onPress={() => toggleDateSelection(d)}
                >
                  <Text style={[s.dateChipText, isSelected && s.dateChipTextActive]}>
                    {d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {nbJours > 0 && (
            <Text style={s.selectedDatesInfo}>
              {nbJours} jour{nbJours > 1 ? 's' : ''} sélectionné{nbJours > 1 ? 's' : ''}
            </Text>
          )}
        </View>

        {/* Cheval */}
        <View style={s.field}>
          <Text style={s.fieldLabel}>Cheval / Poney *</Text>
          <TextInput
            style={[s.input, !!cheval && s.inputFilled]}
            value={cheval}
            onChangeText={setCheval}
            placeholder="Nom de votre cheval"
            placeholderTextColor={Colors.textTertiary}
          />
        </View>

        {/* Message */}
        <View style={s.field}>
          <Text style={s.fieldLabel}>Message au coach</Text>
          <TextInput
            style={[s.input, s.inputMultiline, !!message && s.inputFilled]}
            value={message}
            onChangeText={setMessage}
            placeholder="Niveau, objectifs, points à travailler..."
            placeholderTextColor={Colors.textTertiary}
            multiline
            numberOfLines={3}
          />
        </View>

        {/* Prix récap */}
        {nbJours > 0 && (
          <View style={s.prixCard}>
            <View style={s.prixRow}>
              <Text style={s.prixLabel}>{prixParJourTTC}€ × {nbJours} jour{nbJours > 1 ? 's' : ''}</Text>
              <Text style={s.prixVal}>{prixTotalHT}€</Text>
            </View>
            <View style={s.prixRow}>
              <Text style={s.prixLabel}>Commission plateforme ({Math.round(commissionCours * 100)}%)</Text>
              <Text style={s.prixVal}>{commissionPlateforme}€</Text>
            </View>
            <View style={[s.prixRow, s.prixTotal]}>
              <Text style={s.prixTotalLabel}>Total TTC</Text>
              <Text style={s.prixTotalVal}>{prixTTCTotal}€</Text>
            </View>
            <Text style={s.prixNote}>💳 Paiement prélevé à la confirmation du coach</Text>
          </View>
        )}

        <TouchableOpacity style={s.submitBtn} onPress={submit} activeOpacity={0.85} disabled={loading}>
          <Text style={s.submitText}>{loading ? '⏳ Paiement...' : '✓ Réserver & Payer'}</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>


      {/* Modal de confirmation */}
      <Modal visible={showConfirmation} transparent animationType="fade">
        <View style={s.confirmationBackdrop}>
          <View style={s.confirmationCard}>
            {/* Icône de succès */}
            <Text style={s.confirmationIcon}>✅</Text>

            {/* Titre */}
            <Text style={s.confirmationTitle}>Demande créée! 🎉</Text>

            {/* Message */}
            <Text style={s.confirmationMessage}>
              En attente de validation du coach. Vous recevrez une notification une fois validée.
            </Text>

            {/* Détails */}
            <View style={s.confirmationDetails}>
              <View style={s.detailRow}>
                <Text style={s.detailIcon}>🎓</Text>
                <Text style={s.detailText}>{annonce.titre}</Text>
              </View>
              {selectedDates.length > 0 && (() => {
                const sorted = [...selectedDates].sort((a, b) => a.getTime() - b.getTime());
                const firstDate = sorted[0].toLocaleDateString('fr-FR');
                const lastDate = sorted[sorted.length - 1].toLocaleDateString('fr-FR');
                return (
                  <View style={s.detailRow}>
                    <Text style={s.detailIcon}>📅</Text>
                    <Text style={s.detailText}>
                      {selectedDates.length === 1
                        ? firstDate
                        : `${firstDate} → ${lastDate} (${nbJours} jours)`
                      }
                    </Text>
                  </View>
                );
              })()}
              <View style={s.detailRow}>
                <Text style={s.detailIcon}>🎯</Text>
                <Text style={s.detailText}>{discipline} · {niveau}</Text>
              </View>
              <View style={s.detailRow}>
                <Text style={s.detailIcon}>🐴</Text>
                <Text style={s.detailText}>{cheval}</Text>
              </View>
              <View style={s.detailRow}>
                <Text style={s.detailIcon}>💳</Text>
                <Text style={s.detailText}>{prixTTCTotal}€ TTC</Text>
              </View>
            </View>

            {/* Boutons */}
            <View style={s.confirmationButtons}>
              <TouchableOpacity
                style={s.confirmationBtn}
                onPress={() => {
                  setShowConfirmation(false);
                  router.push('/(tabs)/services?tab=coach' as any);
                }}
              >
                <Text style={s.confirmationBtnText}>Retour aux annonces</Text>
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
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.lg },
  errorText: { fontSize: FontSize.lg, color: Colors.textSecondary },
  backBtn2: { backgroundColor: Colors.primary, borderRadius: Radius.lg, paddingVertical: Spacing.md + 4, alignItems: 'center', minWidth: 120 },
  backText: { color: Colors.textInverse, fontWeight: FontWeight.extrabold, fontSize: FontSize.base },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.surface },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surfaceVariant, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 24, color: Colors.textPrimary, lineHeight: 28 },
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  container: { padding: Spacing.lg, gap: Spacing.lg },
  coachCard: { backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.lg, flexDirection: 'row', alignItems: 'center', gap: Spacing.md, borderWidth: 1, borderColor: Colors.border, ...Shadow.card },
  coachAvatar: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  coachInitiales: { color: Colors.textInverse, fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  coachName: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  coachPseudo: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: FontWeight.semibold },
  coachDisc: { fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: 2 },
  tarifBadge: { backgroundColor: Colors.primaryLight, borderRadius: Radius.md, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderWidth: 1, borderColor: Colors.primaryBorder },
  tarifText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.bold },
  field: { gap: Spacing.sm },
  fieldLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.semibold },
  chipTextActive: { color: Colors.textInverse },
  datesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  dateChip: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  dateChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  dateChipText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.semibold },
  dateChipTextActive: { color: Colors.textInverse },
  selectedDatesInfo: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: FontWeight.semibold, marginTop: Spacing.xs },
  creneauGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  creneauBtn: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface, minWidth: 64, alignItems: 'center' },
  creneauBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  creneauText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.semibold },
  creneauTextActive: { color: Colors.textInverse },
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
  prixNote: { fontSize: FontSize.xs, color: Colors.textTertiary, textAlign: 'center' },
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
