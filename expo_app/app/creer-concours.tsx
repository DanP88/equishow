import { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView,
  TextInput, Alert, Modal, Switch,
} from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../constants/theme';
import { DatePickerModal, DateButton } from '../components/DatePickerModal';
import { userStore, concoursStore } from '../data/store';
import { Concours } from '../types/concours';

const DISCIPLINES = ['CSO', 'Dressage', 'CCE', 'Raid', 'Voltige', 'Hunter', 'Saut d\'obstacles'];
const TYPES_CAVALIERS = ['Poney', 'Loisir', 'Amateur', 'Pro', 'Elite'];
const EPREUVES = ['1.00m', '1.10m', '1.20m', '1.30m', 'Dressage Novice', 'Dressage Amateur', 'CCE jeune', 'CCE amateur'];

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

function MultiSelectChip({ options, selected, onChange }: {
  options: string[]; selected: string[]; onChange: (s: string[]) => void;
}) {
  return (
    <View style={s.chipsRow}>
      {options.map((opt) => (
        <TouchableOpacity
          key={opt}
          style={[s.chip, selected.includes(opt) && s.chipActive]}
          onPress={() => {
            if (selected.includes(opt)) {
              onChange(selected.filter(x => x !== opt));
            } else {
              onChange([...selected, opt]);
            }
          }}
        >
          <Text style={[s.chipText, selected.includes(opt) && s.chipTextActive]}>{opt}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export default function CreerConcoursScreen() {
  const [nom, setNom] = useState('');
  const [dateDebut, setDateDebut] = useState<Date | undefined>();
  const [dateFin, setDateFin] = useState<Date | undefined>();
  const [lieu, setLieu] = useState('');
  const [adresse, setAdresse] = useState('');
  const [codePostal, setCodePostal] = useState('');
  const [ville, setVille] = useState('');
  const [discipline, setDiscipline] = useState('');
  const [disciplines, setDisciplines] = useState<string[]>([]);
  const [epreuves, setEpreuves] = useState<string[]>([]);
  const [typesCavaliers, setTypesCavaliers] = useState<string[]>([]);
  const [nbPlaces, setNbPlaces] = useState('');
  const [prix, setPrix] = useState('');
  const [horaireDebut, setHoraireDebut] = useState('09:00');
  const [horaireFin, setHoraireFin] = useState('18:00');
  const [description, setDescription] = useState('');
  const [restauration, setRestauration] = useState('');
  const [parking, setParking] = useState('');
  const [coaching, setCoaching] = useState(false);
  const [securite, setSecurite] = useState('');
  const [veterinaire, setVeterinaire] = useState(false);
  const [soins, setSoins] = useState(false);
  const [douches, setDouches] = useState(false);
  const [wifi, setWifi] = useState(false);
  const [autre, setAutre] = useState('');
  const [showDateDebut, setShowDateDebut] = useState(false);
  const [showDateFin, setShowDateFin] = useState(false);

  function submit() {
    if (!nom.trim() || !dateDebut || !dateFin || !lieu || !discipline || !nbPlaces) {
      Alert.alert('Champs manquants', 'Veuillez remplir au minimum: nom, dates, lieu, discipline et nombre de places.');
      return;
    }

    if (dateFin.getTime() < dateDebut.getTime()) {
      Alert.alert('Date invalide', 'La date de fin doit être égale ou après la date de début.');
      return;
    }

    const newConcours: Concours = {
      id: `concours_${Date.now()}`,
      nom: nom.trim(),
      dateDebut,
      dateFin,
      lieu: lieu.trim(),
      adresseComplete: adresse.trim() || undefined,
      codePostal: codePostal.trim() || undefined,
      ville: ville.trim() || undefined,
      discipline,
      disciplines: disciplines.length > 0 ? disciplines : [discipline],
      epreuves,
      typesCavaliers,
      organisateurId: userStore.id,
      organisateurNom: `${userStore.prenom} ${userStore.nom}`,
      statut: 'brouillon',
      nbPlaces: parseInt(nbPlaces, 10),
      nbInscrits: 0,
      description: description.trim() || undefined,
      prix: prix ? parseInt(prix, 10) : undefined,
      region: userStore.region || undefined,
      horaireDebut,
      horaireFin,
      enLive: false,
      infosComplementaires: {
        restauration: restauration.trim() || undefined,
        parking: parking.trim() || undefined,
        coaching,
        securite: securite.trim() || undefined,
        veterinaire,
        soinsChevauxDisponibles: soins,
        douches,
        wifi,
        autre: autre.trim() || undefined,
      },
    };

    concoursStore.list = [newConcours, ...concoursStore.list];

    Alert.alert(
      'Concours créé ! 🏆',
      `"${nom}" a été créé avec succès en brouillon.`,
      [{ text: 'OK', onPress: () => router.replace('/(tabs)/org-concours' as any) }],
    );
  }

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Text style={s.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Créer un concours</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
        {/* INFORMATIONS GÉNÉRALES */}
        <Text style={s.sectionTitle}>📝 Informations générales</Text>

        <View style={s.field}>
          <Text style={s.fieldLabel}>Nom du concours *</Text>
          <TextInput
            style={[f.input, !!nom && f.inputFilled]}
            value={nom}
            onChangeText={setNom}
            placeholder="Grand Prix de Lyon"
            placeholderTextColor={Colors.textTertiary}
          />
        </View>

        <View style={s.datesRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.fieldLabel}>Début *</Text>
            <DateButton label="Date début" value={dateDebut} onPress={() => setShowDateDebut(true)} />
          </View>
          <Text style={s.dateSep}>→</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.fieldLabel}>Fin *</Text>
            <DateButton label="Date fin" value={dateFin} onPress={() => setShowDateFin(true)} />
          </View>
        </View>

        <View style={s.horaireRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.fieldLabel}>Heure début</Text>
            <TextInput
              style={[f.input, f.smallInput]}
              value={horaireDebut}
              onChangeText={setHoraireDebut}
              placeholder="09:00"
              placeholderTextColor={Colors.textTertiary}
            />
          </View>
          <View style={{ width: Spacing.md }} />
          <View style={{ flex: 1 }}>
            <Text style={s.fieldLabel}>Heure fin</Text>
            <TextInput
              style={[f.input, f.smallInput]}
              value={horaireFin}
              onChangeText={setHoraireFin}
              placeholder="18:00"
              placeholderTextColor={Colors.textTertiary}
            />
          </View>
        </View>

        {/* LIEU */}
        <Text style={s.sectionTitle}>📍 Lieu</Text>

        <View style={s.field}>
          <Text style={s.fieldLabel}>Nom du lieu *</Text>
          <TextInput
            style={[f.input, !!lieu && f.inputFilled]}
            value={lieu}
            onChangeText={setLieu}
            placeholder="Haras de Lyon"
            placeholderTextColor={Colors.textTertiary}
          />
        </View>

        <View style={s.field}>
          <Text style={s.fieldLabel}>Adresse complète</Text>
          <TextInput
            style={[f.input, !!adresse && f.inputFilled]}
            value={adresse}
            onChangeText={setAdresse}
            placeholder="123 Rue du Cheval"
            placeholderTextColor={Colors.textTertiary}
          />
        </View>

        <View style={s.locationRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.fieldLabel}>Code postal</Text>
            <TextInput
              style={[f.input, !!codePostal && f.inputFilled]}
              value={codePostal}
              onChangeText={setCodePostal}
              placeholder="69000"
              placeholderTextColor={Colors.textTertiary}
            />
          </View>
          <View style={{ width: Spacing.md }} />
          <View style={{ flex: 1 }}>
            <Text style={s.fieldLabel}>Ville</Text>
            <TextInput
              style={[f.input, !!ville && f.inputFilled]}
              value={ville}
              onChangeText={setVille}
              placeholder="Lyon"
              placeholderTextColor={Colors.textTertiary}
            />
          </View>
        </View>

        {/* DISCIPLINES & ÉPREUVES */}
        <Text style={s.sectionTitle}>🎯 Disciplines & Épreuves</Text>

        <View style={s.field}>
          <Text style={s.fieldLabel}>Discipline principale *</Text>
          <Dropdown placeholder="Sélectionner" value={discipline} options={DISCIPLINES} onChange={setDiscipline} />
        </View>

        <View style={s.field}>
          <Text style={s.fieldLabel}>Épreuves</Text>
          <MultiSelectChip options={EPREUVES} selected={epreuves} onChange={setEpreuves} />
        </View>

        <View style={s.field}>
          <Text style={s.fieldLabel}>Types de cavaliers</Text>
          <MultiSelectChip options={TYPES_CAVALIERS} selected={typesCavaliers} onChange={setTypesCavaliers} />
        </View>

        {/* PLACES & PRIX */}
        <Text style={s.sectionTitle}>💰 Places & Tarifs</Text>

        <View style={s.priceRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.fieldLabel}>Nombre de places *</Text>
            <TextInput
              style={[f.input, !!nbPlaces && f.inputFilled]}
              value={nbPlaces}
              onChangeText={setNbPlaces}
              placeholder="60"
              placeholderTextColor={Colors.textTertiary}
              keyboardType="number-pad"
            />
          </View>
          <View style={{ width: Spacing.md }} />
          <View style={{ flex: 1 }}>
            <Text style={s.fieldLabel}>Prix d'inscription</Text>
            <TextInput
              style={[f.input, !!prix && f.inputFilled]}
              value={prix}
              onChangeText={setPrix}
              placeholder="45"
              placeholderTextColor={Colors.textTertiary}
              keyboardType="numeric"
            />
          </View>
        </View>

        {/* INFOS COMPLÉMENTAIRES */}
        <Text style={s.sectionTitle}>ℹ️ Infos complémentaires</Text>

        <View style={s.field}>
          <Text style={s.fieldLabel}>Restauration</Text>
          <TextInput
            style={[f.input, !!restauration && f.inputFilled]}
            value={restauration}
            onChangeText={setRestauration}
            placeholder="Sandwichs, bar, restaurant"
            placeholderTextColor={Colors.textTertiary}
          />
        </View>

        <View style={s.field}>
          <Text style={s.fieldLabel}>Parking</Text>
          <TextInput
            style={[f.input, !!parking && f.inputFilled]}
            value={parking}
            onChangeText={setParking}
            placeholder="Gratuit, sécurisé, capacité..."
            placeholderTextColor={Colors.textTertiary}
          />
        </View>

        <View style={s.field}>
          <Text style={s.fieldLabel}>Sécurité</Text>
          <TextInput
            style={[f.input, !!securite && f.inputFilled]}
            value={securite}
            onChangeText={setSecurite}
            placeholder="Pompiers, infirmerie..."
            placeholderTextColor={Colors.textTertiary}
          />
        </View>

        <View style={s.togglesRow}>
          <View style={s.toggleItem}>
            <Text style={s.toggleLabel}>Coaching disponible</Text>
            <Switch value={coaching} onValueChange={setCoaching} />
          </View>
          <View style={s.toggleItem}>
            <Text style={s.toggleLabel}>Vétérinaire</Text>
            <Switch value={veterinaire} onValueChange={setVeterinaire} />
          </View>
        </View>

        <View style={s.togglesRow}>
          <View style={s.toggleItem}>
            <Text style={s.toggleLabel}>Soins chevaux</Text>
            <Switch value={soins} onValueChange={setSoins} />
          </View>
          <View style={s.toggleItem}>
            <Text style={s.toggleLabel}>Douches</Text>
            <Switch value={douches} onValueChange={setDouches} />
          </View>
        </View>

        <View style={s.toggleItem}>
          <Text style={s.toggleLabel}>Wi-Fi</Text>
          <Switch value={wifi} onValueChange={setWifi} />
        </View>

        <View style={s.field}>
          <Text style={s.fieldLabel}>Autre info</Text>
          <TextInput
            style={[f.input, f.inputMultiline, !!autre && f.inputFilled]}
            value={autre}
            onChangeText={setAutre}
            placeholder="Infos supplémentaires..."
            placeholderTextColor={Colors.textTertiary}
            multiline
            numberOfLines={3}
          />
        </View>

        <View style={s.field}>
          <Text style={s.fieldLabel}>Description</Text>
          <TextInput
            style={[f.input, f.inputMultiline, !!description && f.inputFilled]}
            value={description}
            onChangeText={setDescription}
            placeholder="Décrivez votre concours..."
            placeholderTextColor={Colors.textTertiary}
            multiline
            numberOfLines={4}
          />
        </View>

        <TouchableOpacity style={s.submitBtn} onPress={submit} activeOpacity={0.85}>
          <Text style={s.submitText}>Créer le concours</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      <DatePickerModal visible={showDateDebut} value={dateDebut} onConfirm={setDateDebut} onClose={() => setShowDateDebut(false)} title="Date de début" />
      <DatePickerModal visible={showDateFin} value={dateFin} onConfirm={setDateFin} onClose={() => setShowDateFin(false)} title="Date de fin" />
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
  sectionTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.primary, marginTop: Spacing.lg },
  field: { gap: Spacing.xs },
  fieldLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5 },
  datesRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-end' },
  dateSep: { color: Colors.primary, fontSize: FontSize.sm, marginBottom: Spacing.xs + 8 },
  horaireRow: { flexDirection: 'row', gap: Spacing.sm },
  locationRow: { flexDirection: 'row', gap: Spacing.sm },
  priceRow: { flexDirection: 'row', gap: Spacing.sm },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.semibold },
  chipTextActive: { color: Colors.textInverse },
  togglesRow: { flexDirection: 'row', gap: Spacing.md },
  toggleItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border },
  toggleLabel: { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: FontWeight.semibold },
  submitBtn: { backgroundColor: Colors.primary, borderRadius: Radius.lg, paddingVertical: Spacing.md + 4, alignItems: 'center', marginTop: Spacing.lg, ...Shadow.fab },
  submitText: { color: Colors.textInverse, fontWeight: FontWeight.extrabold, fontSize: FontSize.base },
});

const f = StyleSheet.create({
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 4, fontSize: FontSize.base, color: Colors.textPrimary, backgroundColor: Colors.surface },
  inputFilled: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  smallInput: { paddingVertical: Spacing.sm },
  inputMultiline: { minHeight: 80, textAlignVertical: 'top' },
  inputText: { flex: 1, fontSize: FontSize.base, color: Colors.textPrimary },
  placeholder: { color: Colors.textTertiary },
  arrow: { fontSize: 11, color: Colors.textTertiary },
  dropList: { backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, maxHeight: 200, overflow: 'hidden' },
  dropItem: { paddingVertical: Spacing.sm + 2, paddingHorizontal: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  dropItemActive: { backgroundColor: Colors.primaryLight },
  dropItemText: { fontSize: FontSize.base, color: Colors.textPrimary },
  dropItemTextActive: { color: Colors.primary, fontWeight: FontWeight.bold },
});
