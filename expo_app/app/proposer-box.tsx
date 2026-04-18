import { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView,
  TextInput, Alert, Modal,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ADRESSES_POPULAIRES } from '../data/mockAdresses';
import { Colors } from '../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../constants/theme';
import { DatePickerModal, DateButton, formatDate } from '../components/DatePickerModal';
import { mockConcours } from '../data/mockConcours';
import { boxesStore, userStore } from '../data/store';
import { prixTTC as calculatePrixTTC } from '../types/service';

const CONCOURS_OPTIONS = mockConcours
  .filter(c => c.statut !== 'brouillon')
  .map((c) => ({
    label: `${c.nom} — ${c.dateDebut.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })} · ${c.lieu}`,
    value: c.nom,
  }));

const EQUIPEMENTS = [
  'Eau courante', 'Électricité', 'Litière incluse', 'Paddock disponible',
  'Parking sécurisé', 'Douche chevaux', 'Manège accès', 'Surveillance 24h',
  'Wi-Fi', 'Toilettes', 'Vétérinaire sur place',
];

function ConcoursPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [autreMode, setAutreMode] = useState(false);
  const [autreText, setAutreText] = useState('');

  function selectOption(val: string) {
    if (val === '__autre__') { setAutreMode(true); setOpen(false); }
    else { onChange(val); setAutreMode(false); setOpen(false); }
  }

  function confirmAutre() {
    if (autreText.trim()) { onChange(autreText.trim()); setAutreMode(false); }
  }

  return (
    <>
      <TouchableOpacity
        style={[f.input, !!value && f.inputFilled]}
        onPress={() => { setAutreMode(false); setOpen(true); }}
        activeOpacity={0.8}
      >
        <Text style={[f.inputText, !value && f.placeholder]} numberOfLines={1}>
          {value || 'Sélectionner un concours'}
        </Text>
        <Text style={f.arrow}>▼</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade">
        <TouchableOpacity style={cp.backdrop} activeOpacity={1} onPress={() => setOpen(false)}>
          <TouchableOpacity activeOpacity={1} style={cp.sheet}>
            <Text style={cp.title}>Concours associé</Text>
            <ScrollView style={cp.list} showsVerticalScrollIndicator={false}>
              <TouchableOpacity style={cp.item} onPress={() => { onChange(''); setOpen(false); }}>
                <Text style={[cp.itemText, { color: Colors.textTertiary, fontStyle: 'italic' }]}>— Aucun concours</Text>
              </TouchableOpacity>
              {CONCOURS_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[cp.item, value === opt.value && cp.itemActive]}
                  onPress={() => selectOption(opt.value)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[cp.itemText, value === opt.value && cp.itemTextActive]}>{opt.value}</Text>
                    <Text style={cp.itemSub}>{opt.label.split(' — ')[1]}</Text>
                  </View>
                  {value === opt.value && <Text style={cp.check}>✓</Text>}
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={[cp.item, cp.itemAutre]} onPress={() => selectOption('__autre__')}>
                <Text style={cp.itemAutreText}>✏️ Autre concours (saisie libre)</Text>
              </TouchableOpacity>
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {autreMode && (
        <View style={cp.autreRow}>
          <TextInput
            style={cp.autreInput}
            value={autreText}
            onChangeText={setAutreText}
            placeholder="Nom du concours..."
            placeholderTextColor={Colors.textTertiary}
            autoFocus
          />
          <TouchableOpacity style={cp.autreConfirm} onPress={confirmAutre}>
            <Text style={cp.autreConfirmText}>OK</Text>
          </TouchableOpacity>
        </View>
      )}
    </>
  );
}

export default function ProposerBoxScreen() {
  const { editId } = useLocalSearchParams<{ editId?: string }>();
  const existing = editId ? boxesStore.list.find((b) => b.id === editId) : undefined;

  const [lieu, setLieu] = useState(existing?.lieu ?? '');
  const [showLieuSuggestions, setShowLieuSuggestions] = useState(false);
  const [dateDebut, setDateDebut] = useState<Date | undefined>(existing?.dateDebut);
  const [dateFin, setDateFin] = useState<Date | undefined>(existing?.dateFin);
  const [nbBoxes, setNbBoxes] = useState(existing ? String(existing.nbBoxes) : '');
  const [prix, setPrix] = useState(existing ? String(existing.prixNuitHT) : '');
  const [concours, setConcours] = useState(existing?.concours ?? '');
  const [equipements, setEquipements] = useState<string[]>([]);
  const [description, setDescription] = useState(existing?.description ?? '');
  const [litiere, setLitiere] = useState('');
  const [showDateDebut, setShowDateDebut] = useState(false);
  const [showDateFin, setShowDateFin] = useState(false);

  const lieuSuggestions = lieu
    ? ADRESSES_POPULAIRES.filter((v) => v.toLowerCase().includes(lieu.toLowerCase())).slice(0, 5)
    : [];

  function selectLieu(v: string) {
    setLieu(v);
    setShowLieuSuggestions(false);
  }

  function toggleEquipement(e: string) {
    setEquipements((prev) => prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e]);
  }

  const prixNum = parseFloat(prix);
  const prixTTC = prixNum ? calculatePrixTTC(prixNum, 'box') : null;

  // Calculer les jours disponibles automatiquement
  const joursDisponibles = dateDebut && dateFin
    ? Math.max(1, Math.round((dateFin.getTime() - dateDebut.getTime()) / (1000 * 60 * 60 * 24)))
    : 0;

  function submit() {
    if (!lieu || !dateDebut || !dateFin || !prix) {
      Alert.alert('Champs manquants', 'Veuillez remplir : lieu, dates et prix.');
      return;
    }
    const nb = joursDisponibles;
    const descFull = [
      equipements.length > 0 ? `Équipements : ${equipements.join(', ')}` : '',
      description,
    ].filter(Boolean).join('\n');

    if (editId && existing) {
      const idx = boxesStore.list.findIndex((b) => b.id === editId);
      if (idx !== -1) {
        boxesStore.list[idx] = {
          ...boxesStore.list[idx],
          lieu: lieu.trim(),
          dateDebut,
          dateFin,
          nbBoxes: nb,
          nbBoxesDisponibles: nb,
          prixNuitHT: parseFloat(prix),
          concours: concours || undefined,
          description: descFull || undefined,
        };
      }
      Alert.alert(
        'Annonce modifiée ! ✅',
        `Votre annonce de boxes à "${lieu}" a été mise à jour.`,
        [{ text: 'OK', onPress: () => router.replace('/(tabs)/services?tab=box' as any) }],
      );
    } else {
      const nouvelleAnnonce = {
        id: `b${Date.now()}`,
        auteurId: userStore.id,
        auteurNom: `${userStore.prenom} ${userStore.nom}`,
        auteurPseudo: userStore.pseudo,
        auteurInitiales: `${userStore.prenom[0]}${userStore.nom[0]}`,
        auteurCouleur: userStore.avatarColor,
        lieu: lieu.trim(),
        dateDebut,
        dateFin,
        nbBoxes: nb,
        nbBoxesDisponibles: nb,
        prixNuitHT: parseFloat(prix),
        concours: concours || undefined,
        description: descFull || undefined,
      };
      boxesStore.list = [nouvelleAnnonce, ...boxesStore.list];
      Alert.alert(
        'Annonce publiée ! 🏠',
        `Votre annonce de boxes à "${lieu}" (${joursDisponibles} jour${joursDisponibles > 1 ? 's' : ''}) est maintenant visible dans la liste.`,
        [{ text: 'OK', onPress: () => router.replace('/(tabs)/services?tab=box' as any) }],
      );
    }
  }

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Text style={s.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>{editId ? 'Modifier l\'annonce' : 'Proposer des boxes'}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
        <View style={s.infoCard}>
          <Text style={s.infoIcon}>💡</Text>
          <Text style={s.infoText}>
            Prix recommandé : <Text style={s.infoHighlight}>45 à 80€ / nuit HT</Text>. Réservation possible à la journée ou sur plusieurs jours. Commission plateforme : 9%.
          </Text>
        </View>

        <Field label="Lieu / Adresse *">
          <View>
            <TextInput
              style={[f.input, !!lieu && f.inputFilled]}
              value={lieu}
              onChangeText={(t) => {
                setLieu(t);
                setShowLieuSuggestions(t.length > 0);
              }}
              placeholder="ex: Haras de Lyon — 69"
              placeholderTextColor={Colors.textTertiary}
            />
            {showLieuSuggestions && lieuSuggestions.length > 0 && (
              <View style={s.suggestionsBox}>
                {lieuSuggestions.map((sug) => (
                  <TouchableOpacity
                    key={sug}
                    style={s.suggestionItem}
                    onPress={() => selectLieu(sug)}
                  >
                    <Text style={s.suggestionText}>{sug}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </Field>

        <Field label="Période de disponibilité *">
          <View style={s.datesRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.dateSubLabel}>Début</Text>
              <DateButton label="Date début" value={dateDebut} onPress={() => setShowDateDebut(true)} />
            </View>
            <Text style={s.dateSep}>→</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.dateSubLabel}>Fin</Text>
              <DateButton label="Date fin" value={dateFin} onPress={() => setShowDateFin(true)} />
            </View>
          </View>
        </Field>

        {dateDebut && dateFin && (
          <View style={s.joursDisponiblesCard}>
            <Text style={s.joursDisponiblesLabel}>Jours disponibles</Text>
            <Text style={s.joursDisponiblesValue}>{joursDisponibles} jour{joursDisponibles > 1 ? 's' : ''}</Text>
            <Text style={s.joursDisponiblesHint}>Les locataires choisissent les jours qu'ils veulent dans cette période</Text>
          </View>
        )}

        <Field label="Prix par box / nuit (€ HT) *" hint={prixTTC ? `→ ${prixTTC}€ TTC par box par nuit` : 'Recommandé : 45–80€'}>
          <View style={f.priceRow}>
            <TextInput
              style={[f.input, { flex: 1 }, !!prix && f.inputFilled]}
              value={prix}
              onChangeText={setPrix}
              placeholder="55"
              placeholderTextColor={Colors.textTertiary}
              keyboardType="numeric"
            />
            <View style={f.priceUnit}><Text style={f.priceUnitText}>€ / nuit HT</Text></View>
          </View>
        </Field>

        <Field label="Type de litière">
          <View style={s.litiereRow}>
            {['Paille', 'Copeaux', 'Paille + Copeaux', 'Non incluse'].map((l) => (
              <TouchableOpacity
                key={l}
                style={[s.litiereBtn, litiere === l && s.litiereBtnActive]}
                onPress={() => setLitiere(l)}
              >
                <Text style={[s.litiereBtnText, litiere === l && s.litiereBtnTextActive]}>{l}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Field>

        <Field label="Concours associé">
          <ConcoursPicker value={concours} onChange={setConcours} />
        </Field>

        <Field label="Équipements disponibles">
          <View style={s.equipRow}>
            {EQUIPEMENTS.map((e) => {
              const sel = equipements.includes(e);
              return (
                <TouchableOpacity
                  key={e}
                  style={[s.equipChip, sel && s.equipChipActive]}
                  onPress={() => toggleEquipement(e)}
                >
                  {sel && <Text style={s.equipCheck}>✓ </Text>}
                  <Text style={[s.equipText, sel && s.equipTextActive]}>{e}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Field>

        <Field label="Description libre">
          <TextInput
            style={[f.input, f.inputMultiline, !!description && f.inputFilled]}
            value={description}
            onChangeText={setDescription}
            placeholder="Précisions supplémentaires : taille des boxes, accès, conditions..."
            placeholderTextColor={Colors.textTertiary}
            multiline
            numberOfLines={3}
          />
        </Field>

        <View style={s.stripeNote}>
          <Text style={s.stripeNoteIcon}>🔒</Text>
          <Text style={s.stripeNoteText}>Paiements gérés par Stripe. Vous recevrez le montant après déduction de la commission 9% à chaque réservation confirmée.</Text>
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

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>{label}</Text>
      {children}
      {hint && <Text style={s.fieldHint}>{hint}</Text>}
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
  infoHighlight: { color: Colors.primary, fontWeight: FontWeight.bold },
  field: { gap: Spacing.xs },
  fieldLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldHint: { fontSize: FontSize.xs, color: Colors.primary, fontStyle: 'italic' },
  datesRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm },
  dateSubLabel: { fontSize: FontSize.xs, color: Colors.textTertiary, marginBottom: Spacing.xs },
  dateSep: { fontSize: FontSize.xl, color: Colors.primary, paddingBottom: Spacing.sm },
  placesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  placeBtn: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  placeBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  placeBtnText: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textSecondary },
  placeBtnTextActive: { color: Colors.textInverse },
  litiereRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  litiereBtn: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  litiereBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  litiereBtnText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  litiereBtnTextActive: { color: Colors.textInverse },
  suggestionsBox: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderTopWidth: 0, borderBottomLeftRadius: Radius.md, borderBottomRightRadius: Radius.md, overflow: 'hidden' },
  suggestionItem: { paddingVertical: Spacing.sm + 2, paddingHorizontal: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  suggestionText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.semibold },
  stripeNote: { flexDirection: 'row', gap: Spacing.sm, backgroundColor: Colors.surfaceVariant, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'flex-start' },
  stripeNoteIcon: { fontSize: 14 },
  stripeNoteText: { flex: 1, fontSize: FontSize.xs, color: Colors.textTertiary, lineHeight: 18 },
  submitBtn: { backgroundColor: Colors.primary, borderRadius: Radius.lg, paddingVertical: Spacing.md + 4, alignItems: 'center', ...Shadow.fab },
  submitText: { color: Colors.textInverse, fontWeight: FontWeight.extrabold, fontSize: FontSize.base },
  equipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  equipChip: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.xs + 2, paddingHorizontal: Spacing.sm + 2, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  equipChipActive: { backgroundColor: Colors.successBg, borderColor: Colors.success },
  equipCheck: { fontSize: FontSize.xs, color: Colors.success, fontWeight: FontWeight.bold },
  equipText: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  equipTextActive: { color: Colors.success, fontWeight: FontWeight.bold },
  joursDisponiblesCard: { backgroundColor: Colors.primaryLight, borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.primaryBorder, alignItems: 'center', gap: Spacing.sm },
  joursDisponiblesLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5 },
  joursDisponiblesValue: { fontSize: FontSize.xxl, fontWeight: FontWeight.extrabold, color: Colors.primary },
  joursDisponiblesHint: { fontSize: FontSize.xs, color: Colors.primary, fontStyle: 'italic', textAlign: 'center' },
});

const f = StyleSheet.create({
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 4, fontSize: FontSize.base, color: Colors.textPrimary, backgroundColor: Colors.surface },
  inputFilled: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  inputMultiline: { minHeight: 80, textAlignVertical: 'top' },
  priceRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
  priceUnit: { backgroundColor: Colors.surfaceVariant, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 4, borderWidth: 1, borderColor: Colors.border },
  priceUnitText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.semibold },
  inputText: { flex: 1, fontSize: FontSize.base, color: Colors.textPrimary },
  placeholder: { color: Colors.textTertiary },
  arrow: { fontSize: 11, color: Colors.textTertiary },
});

const cp = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: Spacing.lg },
  sheet: { backgroundColor: Colors.surface, borderRadius: Radius.xxl, width: '100%', maxWidth: 400, maxHeight: '80%', padding: Spacing.xl, ...Shadow.modal },
  title: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.md, textAlign: 'center' },
  list: { maxHeight: 380 },
  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.md, paddingHorizontal: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  itemActive: { backgroundColor: Colors.primaryLight },
  itemText: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary, flex: 1 },
  itemTextActive: { color: Colors.primary },
  itemSub: { fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: 2 },
  check: { fontSize: FontSize.base, color: Colors.primary, fontWeight: FontWeight.bold },
  itemAutre: { backgroundColor: Colors.surfaceVariant, borderBottomWidth: 0, marginTop: Spacing.xs, borderRadius: Radius.md },
  itemAutreText: { fontSize: FontSize.base, color: Colors.textSecondary, fontWeight: FontWeight.semibold },
  autreRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center', marginTop: Spacing.xs },
  autreInput: { flex: 1, borderWidth: 1, borderColor: Colors.primary, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2, fontSize: FontSize.base, color: Colors.textPrimary, backgroundColor: Colors.primaryLight },
  autreConfirm: { backgroundColor: Colors.primary, borderRadius: Radius.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm + 2 },
  autreConfirmText: { color: Colors.textInverse, fontWeight: FontWeight.bold, fontSize: FontSize.base },
});
