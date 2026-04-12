import { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView,
  TextInput, Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors } from '../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../constants/theme';
import { mockCoachs } from '../data/mockServices';
import { prixTTC } from '../types/service';
import { DatePickerModal, DateButton, formatDate } from '../components/DatePickerModal';

const CRENEAUX = ['7h00', '7h30', '8h00', '8h30', '9h00', '9h30', '10h00', '10h30',
  '11h00', '11h30', '14h00', '14h30', '15h00', '15h30', '16h00', '16h30'];

const DUREES = ['30 min', '1h', '1h30', '2h'];

export default function ReserverCoachScreen() {
  const { coachId } = useLocalSearchParams<{ coachId: string }>();
  const coach = mockCoachs.find((c) => c.id === coachId) ?? mockCoachs[0];

  const [date, setDate] = useState<Date | undefined>();
  const [creneau, setCreneau] = useState('');
  const [duree, setDuree] = useState('1h');
  const [cheval, setCheval] = useState('');
  const [discipline, setDiscipline] = useState(coach.disciplines[0] ?? '');
  const [message, setMessage] = useState('');
  const [showDate, setShowDate] = useState(false);

  const nbHeures = duree === '30 min' ? 0.5 : duree === '1h' ? 1 : duree === '1h30' ? 1.5 : 2;
  const prixHT = Math.round(coach.tarifHeure * nbHeures);
  const prixTtc = prixTTC(prixHT);

  function submit() {
    if (!date || !creneau || !cheval) {
      Alert.alert('Champs manquants', 'Veuillez sélectionner une date, un créneau et indiquer le cheval.');
      return;
    }
    Alert.alert(
      'Demande envoyée ! 🎓',
      `Votre demande de coaching a été envoyée à ${coach.prenom} ${coach.nom}.\n\n📅 ${formatDate(date)} à ${creneau}\n⏱ ${duree}\n🐴 ${cheval}\n\n💳 Montant : ${prixTtc}€ TTC\n\nVous serez notifié dès confirmation. Le paiement sera prélevé à la confirmation.`,
      [
        { text: 'Messagerie', onPress: () => { router.back(); router.push('/messagerie'); } },
        { text: 'OK', onPress: () => router.back() },
      ],
    );
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
        {/* Coach card */}
        <View style={s.coachCard}>
          <View style={[s.coachAvatar, { backgroundColor: coach.couleur }]}>
            <Text style={s.coachInitiales}>{coach.initiales}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.coachName}>{coach.prenom} {coach.nom}</Text>
            <Text style={s.coachPseudo}>@{coach.pseudo}</Text>
            <Text style={s.coachDisc}>{coach.disciplines.join(' · ')} · {coach.region}</Text>
          </View>
          <View style={s.tarifBadge}>
            <Text style={s.tarifText}>{coach.tarifHeure}€/h HT</Text>
          </View>
        </View>

        {/* Discipline */}
        <View style={s.field}>
          <Text style={s.fieldLabel}>Discipline</Text>
          <View style={s.row}>
            {coach.disciplines.map((d) => (
              <TouchableOpacity key={d} style={[s.chip, discipline === d && s.chipActive]} onPress={() => setDiscipline(d)}>
                <Text style={[s.chipText, discipline === d && s.chipTextActive]}>{d}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Date */}
        <View style={s.field}>
          <Text style={s.fieldLabel}>Date de la séance *</Text>
          <DateButton label="Sélectionner une date" value={date} onPress={() => setShowDate(true)} />
        </View>

        {/* Créneau */}
        <View style={s.field}>
          <Text style={s.fieldLabel}>Heure de début *</Text>
          <View style={s.creneauGrid}>
            {CRENEAUX.map((c) => (
              <TouchableOpacity key={c} style={[s.creneauBtn, creneau === c && s.creneauBtnActive]} onPress={() => setCreneau(c)}>
                <Text style={[s.creneauText, creneau === c && s.creneauTextActive]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Durée */}
        <View style={s.field}>
          <Text style={s.fieldLabel}>Durée</Text>
          <View style={s.row}>
            {DUREES.map((d) => (
              <TouchableOpacity key={d} style={[s.chip, duree === d && s.chipActive]} onPress={() => setDuree(d)}>
                <Text style={[s.chipText, duree === d && s.chipTextActive]}>{d}</Text>
              </TouchableOpacity>
            ))}
          </View>
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
        <View style={s.prixCard}>
          <View style={s.prixRow}>
            <Text style={s.prixLabel}>Durée sélectionnée</Text>
            <Text style={s.prixVal}>{duree}</Text>
          </View>
          <View style={s.prixRow}>
            <Text style={s.prixLabel}>Tarif coach</Text>
            <Text style={s.prixVal}>{coach.tarifHeure}€/h HT</Text>
          </View>
          <View style={s.prixRow}>
            <Text style={s.prixLabel}>Sous-total HT</Text>
            <Text style={s.prixVal}>{prixHT}€</Text>
          </View>
          <View style={s.prixRow}>
            <Text style={s.prixLabel}>Commission plateforme (9%)</Text>
            <Text style={s.prixVal}>{Math.round(prixHT * 0.09)}€</Text>
          </View>
          <View style={[s.prixRow, s.prixTotal]}>
            <Text style={s.prixTotalLabel}>Total TTC</Text>
            <Text style={s.prixTotalVal}>{prixTtc}€</Text>
          </View>
          <Text style={s.prixNote}>💳 Paiement prélevé via Stripe à la confirmation du coach</Text>
        </View>

        <TouchableOpacity style={s.submitBtn} onPress={submit} activeOpacity={0.85}>
          <Text style={s.submitText}>Envoyer la demande</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      <DatePickerModal visible={showDate} value={date} onConfirm={setDate} onClose={() => setShowDate(false)} title="Date de la séance" />
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
});
