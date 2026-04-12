import { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView,
  TextInput, Alert, Modal,
} from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../constants/theme';
import { DatePickerModal, DateButton, formatDate } from '../components/DatePickerModal';
import { coachAnnoncesStore, userStore, concoursStore } from '../data/store';
import { CoachAnnonce, Disponibilite } from '../types/service';

const DISCIPLINES = ['CSO', 'Dressage', 'CCE', 'Raid', 'Voltige', 'Hunter', 'Saut d\'obstacles'];
const NIVEAUX = ['Poney', 'Club', 'Amateur', 'Pro'];

function getConcoursList() {
  return concoursStore.list
    .filter(c => c.statut !== 'brouillon')
    .map((c) => ({
      id: c.id,
      label: `${c.nom} — ${c.dateDebut.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })} · ${c.lieu}`,
      value: c.nom,
    }));
}

function getNext7Days() {
  const days = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date();
    date.setDate(date.getDate() + i);
    days.push(date);
  }
  return days;
}

function generateHours() {
  const hours = [];
  for (let i = 0; i < 24; i++) {
    const hour = String(i).padStart(2, '0');
    hours.push(`${hour}:00`);
  }
  return hours;
}

function Dropdown({ placeholder, value, options, onChange }: {
  placeholder: string; value: string; options: string[]; onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <TouchableOpacity style={[f.input, !!value && f.inputFilled]} onPress={() => setOpen(true)} activeOpacity={0.8}>
        <Text style={[f.inputText, !value && f.placeholder]}>{value || placeholder}</Text>
        <Text style={f.arrow}>▼</Text>
      </TouchableOpacity>
      {open && (
        <View style={f.dropList}>
          {options.map((o) => (
            <TouchableOpacity key={o} style={[f.dropItem, value === o && f.dropItemActive]} onPress={() => { onChange(o); setOpen(false); }}>
              <Text style={[f.dropItemText, value === o && f.dropItemTextActive]}>{o}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </>
  );
}

export default function ProposerCoachAnnonceScreen() {
  const [type, setType] = useState<'concours' | 'regulier' | ''>('');
  const [titre, setTitre] = useState('');
  const [description, setDescription] = useState('');
  const [discipline, setDiscipline] = useState('');
  const [niveau, setNiveau] = useState('');
  const [concours, setConcours] = useState('');
  const [dateDebut, setDateDebut] = useState<Date | undefined>();
  const [dateFin, setDateFin] = useState<Date | undefined>();
  const [prixHeure, setPrixHeure] = useState('');
  const [places, setPlaces] = useState('');
  const [showDateDebut, setShowDateDebut] = useState(false);
  const [showDateFin, setShowDateFin] = useState(false);
  const [openConcours, setOpenConcours] = useState(false);
  const [disponibilites, setDisponibilites] = useState<Disponibilite[]>([]);

  const prixNum = parseFloat(prixHeure);
  const prixTTC = prixNum ? Math.round(prixNum * 1.09 * 100) / 100 : null;

  function submit() {
    if (!type || !titre.trim() || !description.trim() || !discipline || !niveau || !dateDebut || !dateFin || !prixHeure || !places) {
      Alert.alert('Champs manquants', 'Veuillez remplir tous les champs requis.');
      return;
    }

    if (dateFin.getTime() < dateDebut.getTime()) {
      Alert.alert('Date invalide', 'La date de fin doit être égale ou après la date de début.');
      return;
    }

    const nbPlaces = parseInt(places, 10);
    const nouvelleAnnonce: CoachAnnonce = {
      id: `ca_${Date.now()}`,
      auteurId: userStore.id,
      auteurNom: `${userStore.prenom} ${userStore.nom}`,
      auteurPseudo: userStore.pseudo,
      auteurInitiales: `${userStore.prenom[0]}${userStore.nom[0]}`,
      auteurCouleur: userStore.avatarColor,
      titre: titre.trim(),
      description: description.trim(),
      type,
      discipline,
      niveau,
      dateDebut,
      dateFin,
      prixHeure: parseFloat(prixHeure),
      places: nbPlaces,
      placesDisponibles: nbPlaces,
      concours: concours || undefined,
      region: type === 'regulier' ? userStore.region : undefined,
      disponibilites: type === 'regulier' ? disponibilites : undefined,
    };

    coachAnnoncesStore.list = [nouvelleAnnonce, ...coachAnnoncesStore.list];
    Alert.alert(
      'Annonce publiée ! 🎓',
      `"${titre}" est maintenant visible dans la liste des coachs.`,
      [{ text: 'OK', onPress: () => router.replace('/(tabs)/coach-services' as any) }],
    );
  }

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Text style={s.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Ajouter une annonce</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
        <View style={s.infoCard}>
          <Text style={s.infoIcon}>💡</Text>
          <Text style={s.infoText}>Publiez une annonce pour proposer une séance, un stage ou un service spécifique à vos cavaliers.</Text>
        </View>

        <View style={s.field}>
          <Text style={s.fieldLabel}>Type d'annonce *</Text>
          <View style={s.typeButtonsRow}>
            <TouchableOpacity
              style={[s.typeBtn, type === 'concours' && s.typeBtnActive]}
              onPress={() => setType('concours')}
              activeOpacity={0.8}
            >
              <Text style={[s.typeBtnText, type === 'concours' && s.typeBtnTextActive]}>🏆 Concours</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.typeBtn, type === 'regulier' && s.typeBtnActive]}
              onPress={() => setType('regulier')}
              activeOpacity={0.8}
            >
              <Text style={[s.typeBtnText, type === 'regulier' && s.typeBtnTextActive]}>📅 Régulier</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={s.field}>
          <Text style={s.fieldLabel}>Concours associé</Text>
          <TouchableOpacity
            style={[f.input, !!concours && f.inputFilled]}
            onPress={() => setOpenConcours(true)}
            activeOpacity={0.8}
          >
            <Text style={[f.inputText, !concours && f.placeholder]} numberOfLines={1}>
              {concours || 'Sélectionner un concours (optionnel)'}
            </Text>
            <Text style={f.arrow}>▼</Text>
          </TouchableOpacity>

          <Modal visible={openConcours} transparent animationType="fade">
            <TouchableOpacity style={c.backdrop} activeOpacity={1} onPress={() => setOpenConcours(false)}>
              <TouchableOpacity activeOpacity={1} style={c.sheet}>
                <Text style={c.title}>Concours associé</Text>
                <ScrollView style={c.list} showsVerticalScrollIndicator={false}>
                  <TouchableOpacity style={c.item} onPress={() => { setConcours(''); setOpenConcours(false); }}>
                    <Text style={[c.itemText, { color: Colors.textTertiary, fontStyle: 'italic' }]}>— Aucun concours</Text>
                  </TouchableOpacity>
                  {getConcoursList().map((opt) => (
                    <TouchableOpacity
                      key={opt.id}
                      style={[c.item, concours === opt.value && c.itemActive]}
                      onPress={() => { setConcours(opt.value); setOpenConcours(false); }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[c.itemText, concours === opt.value && c.itemTextActive]}>{opt.value}</Text>
                        <Text style={c.itemSub}>{opt.label.split(' — ')[1]}</Text>
                      </View>
                      {concours === opt.value && <Text style={c.check}>✓</Text>}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </TouchableOpacity>
            </TouchableOpacity>
          </Modal>
        </View>

        <View style={s.field}>
          <Text style={s.fieldLabel}>Titre de l'annonce *</Text>
          <TextInput
            style={[f.input, !!titre && f.inputFilled]}
            value={titre}
            onChangeText={setTitre}
            placeholder="ex: Cours CSO Niveau Club"
            placeholderTextColor={Colors.textTertiary}
          />
        </View>

        <View style={s.field}>
          <Text style={s.fieldLabel}>Description *</Text>
          <TextInput
            style={[f.input, f.inputMultiline, !!description && f.inputFilled]}
            value={description}
            onChangeText={setDescription}
            placeholder="Détails de la séance, du stage ou du service..."
            placeholderTextColor={Colors.textTertiary}
            multiline
            numberOfLines={4}
          />
        </View>

        {type === 'regulier' && (
          <View style={s.field}>
            <Text style={s.fieldLabel}>Région</Text>
            <View style={[f.input, { justifyContent: 'center' }]}>
              <Text style={f.inputText}>{userStore.region || 'Non défini'}</Text>
            </View>
          </View>
        )}

        <View style={s.disciplinesRow}>
          <View style={{ flex: 1 }}>
            <View style={s.field}>
              <Text style={s.fieldLabel}>Discipline *</Text>
              <Dropdown placeholder="Sélectionner" value={discipline} options={DISCIPLINES} onChange={setDiscipline} />
            </View>
          </View>
          <View style={s.spacer} />
          <View style={{ flex: 1 }}>
            <View style={s.field}>
              <Text style={s.fieldLabel}>Niveau *</Text>
              <Dropdown placeholder="Sélectionner" value={niveau} options={NIVEAUX} onChange={setNiveau} />
            </View>
          </View>
        </View>

        {type === 'regulier' && (
          <View style={s.field}>
            <Text style={s.fieldLabel}>Disponibilités (7 prochains jours)</Text>
            {getNext7Days().map((day, idx) => {
              const existing = disponibilites.find(d => d.jour.toDateString() === day.toDateString());
              return (
                <View key={idx}>
                  <TouchableOpacity
                    style={[s.disponibiliteRow, existing && s.disponibiliteRowActive]}
                    onPress={() => {
                      if (existing) {
                        setDisponibilites(disponibilites.filter(d => d.jour.toDateString() !== day.toDateString()));
                      } else {
                        setDisponibilites([...disponibilites, { jour: day, debut: '09:00', fin: '17:00' }]);
                      }
                    }}
                  >
                    <Text style={s.disponibiliteCheckbox}>
                      {existing ? '☑️' : '☐'}
                    </Text>
                    <Text style={s.disponibiliteDay}>{day.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}</Text>
                  </TouchableOpacity>
                  {existing && (
                    <View style={s.horaireRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.horaireLabel}>De</Text>
                        <Dropdown
                          placeholder="09:00"
                          value={existing.debut}
                          options={generateHours()}
                          onChange={(h) => {
                            const updated = disponibilites.map(d =>
                              d.jour.toDateString() === day.toDateString() ? { ...d, debut: h } : d
                            );
                            setDisponibilites(updated);
                          }}
                        />
                      </View>
                      <View style={{ width: Spacing.md }} />
                      <View style={{ flex: 1 }}>
                        <Text style={s.horaireLabel}>À</Text>
                        <Dropdown
                          placeholder="17:00"
                          value={existing.fin}
                          options={generateHours()}
                          onChange={(h) => {
                            const updated = disponibilites.map(d =>
                              d.jour.toDateString() === day.toDateString() ? { ...d, fin: h } : d
                            );
                            setDisponibilites(updated);
                          }}
                        />
                      </View>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}


        <View style={s.datesRow}>
          <View style={{ flex: 1 }}>
            <View style={s.field}>
              <Text style={s.fieldLabel}>Début *</Text>
              <DateButton label="Date début" value={dateDebut} onPress={() => setShowDateDebut(true)} />
            </View>
          </View>
          <Text style={s.dateSep}>→</Text>
          <View style={{ flex: 1 }}>
            <View style={s.field}>
              <Text style={s.fieldLabel}>Fin *</Text>
              <DateButton label="Date fin" value={dateFin} onPress={() => setShowDateFin(true)} />
            </View>
          </View>
        </View>

        <View style={s.priceRow}>
          <View style={{ flex: 1 }}>
            <View style={s.field}>
              <Text style={s.fieldLabel}>Tarif horaire (€ HT) *</Text>
              <View style={f.priceRowInput}>
                <TextInput
                  style={[f.input, { flex: 1 }, !!prixHeure && f.inputFilled]}
                  value={prixHeure}
                  onChangeText={setPrixHeure}
                  placeholder="65"
                  placeholderTextColor={Colors.textTertiary}
                  keyboardType="numeric"
                />
                <View style={f.priceUnit}><Text style={f.priceUnitText}>€ HT</Text></View>
              </View>
              {prixTTC && <Text style={s.fieldHint}>→ {prixTTC}€ TTC avec commission 9%</Text>}
            </View>
          </View>
          <View style={s.spacer} />
          <View style={{ flex: 1 }}>
            <View style={s.field}>
              <Text style={s.fieldLabel}>Nombre de places *</Text>
              <TextInput
                style={[f.input, !!places && f.inputFilled]}
                value={places}
                onChangeText={setPlaces}
                placeholder="3"
                placeholderTextColor={Colors.textTertiary}
                keyboardType="number-pad"
              />
            </View>
          </View>
        </View>

        <View style={s.stripeNote}>
          <Text style={s.stripeIcon}>🔒</Text>
          <Text style={s.stripeText}>Les paiements sont gérés par Stripe. Vous recevrez le montant HT après déduction de la commission de 9%.</Text>
        </View>

        <TouchableOpacity style={s.submitBtn} onPress={submit} activeOpacity={0.85}>
          <Text style={s.submitText}>Publier l'annonce</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      <DatePickerModal visible={showDateDebut} value={dateDebut} onConfirm={setDateDebut} onClose={() => setShowDateDebut(false)} title="Date de début" />
      <DatePickerModal visible={showDateFin} value={dateFin} onConfirm={setDateFin} onClose={() => setShowDateFin(false)} title="Date de fin" />
    </SafeAreaView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.surface },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surfaceVariant, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 24, color: Colors.textPrimary, lineHeight: 28 },
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  container: { padding: Spacing.lg, gap: Spacing.lg },
  infoCard: { flexDirection: 'row', gap: Spacing.sm, backgroundColor: Colors.primaryLight, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.primaryBorder, alignItems: 'flex-start' },
  infoIcon: { fontSize: 16 },
  infoText: { flex: 1, fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  field: { gap: Spacing.xs },
  fieldLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldHint: { fontSize: FontSize.xs, color: Colors.primary, fontStyle: 'italic' },
  typeButtonsRow: { flexDirection: 'row', gap: Spacing.sm },
  typeBtn: { flex: 1, paddingVertical: Spacing.md, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface, alignItems: 'center' },
  typeBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  typeBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textSecondary },
  typeBtnTextActive: { color: Colors.textInverse },
  disponibiliteRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm + 2, paddingHorizontal: Spacing.md, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface, marginBottom: Spacing.xs },
  disponibiliteRowActive: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  disponibiliteCheckbox: { fontSize: 18 },
  disponibiliteDay: { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: FontWeight.semibold },
  horaireRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, backgroundColor: Colors.primaryLight, borderRadius: Radius.md, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.primaryBorder },
  horaireLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  disciplinesRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start' },
  spacer: { width: Spacing.sm },
  datesRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-end' },
  dateSep: { color: Colors.primary, fontSize: FontSize.sm, marginBottom: Spacing.xs + 8 },
  priceRow: { flexDirection: 'row', gap: Spacing.sm },
  stripeNote: { flexDirection: 'row', gap: Spacing.sm, backgroundColor: Colors.surfaceVariant, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'flex-start' },
  stripeIcon: { fontSize: 14 },
  stripeText: { flex: 1, fontSize: FontSize.xs, color: Colors.textTertiary, lineHeight: 18 },
  submitBtn: { backgroundColor: Colors.primary, borderRadius: Radius.lg, paddingVertical: Spacing.md + 4, alignItems: 'center', ...Shadow.fab },
  submitText: { color: Colors.textInverse, fontWeight: FontWeight.extrabold, fontSize: FontSize.base },
});

const f = StyleSheet.create({
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 4, fontSize: FontSize.base, color: Colors.textPrimary, backgroundColor: Colors.surface },
  inputFilled: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  inputMultiline: { minHeight: 80, textAlignVertical: 'top' },
  inputText: { flex: 1, fontSize: FontSize.base, color: Colors.textPrimary },
  placeholder: { color: Colors.textTertiary },
  arrow: { fontSize: 11, color: Colors.textTertiary },
  priceRowInput: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
  priceUnit: { backgroundColor: Colors.surfaceVariant, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 4, borderWidth: 1, borderColor: Colors.border },
  priceUnitText: { fontSize: FontSize.base, color: Colors.textSecondary, fontWeight: FontWeight.semibold },
  dropList: { backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, maxHeight: 200, overflow: 'hidden' },
  dropItem: { paddingVertical: Spacing.sm + 2, paddingHorizontal: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  dropItemActive: { backgroundColor: Colors.primaryLight },
  dropItemText: { fontSize: FontSize.base, color: Colors.textPrimary },
  dropItemTextActive: { color: Colors.primary, fontWeight: FontWeight.bold },
});

const c = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: Spacing.lg },
  sheet: { backgroundColor: Colors.surface, borderRadius: Radius.xxl, width: '100%', maxWidth: 400, maxHeight: '80%', padding: Spacing.xl, ...Shadow.card },
  title: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.md, textAlign: 'center' },
  list: { maxHeight: 380 },
  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.md, paddingHorizontal: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  itemActive: { backgroundColor: Colors.primaryLight },
  itemText: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary, flex: 1 },
  itemTextActive: { color: Colors.primary },
  itemSub: { fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: 2 },
  check: { fontSize: FontSize.base, color: Colors.primary, fontWeight: FontWeight.bold },
});
