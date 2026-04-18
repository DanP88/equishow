import { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView,
  TextInput, Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors } from '../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../constants/theme';
import { coachesStore } from '../data/store';

const DISCIPLINES = ['CSO', 'Dressage', 'CCE', 'Raid', 'Voltige', 'Hunter', 'Saut d\'obstacles'];
const NIVEAUX = ['Poney', 'Club', 'Amateur', 'Pro'];
const SPECIALITES = [
  'Travail du cavalier',
  'Préparation concours',
  'Débourrage',
  'Travail en liberté',
  'Rééducation',
  'Coaching mental',
  'Travail du jeune cheval',
  'Jumping',
];
const COULEURS = ['#7C3AED', '#0369A1', '#EA580C', '#16A34A', '#DC2626', '#F97316', '#B45309', '#7C2D12'];

export default function EditerCoachScreen() {
  const { coachId } = useLocalSearchParams<{ coachId: string }>();
  const idx = coachesStore.list.findIndex((c) => c.id === coachId);
  const coach = idx !== -1 ? coachesStore.list[idx] : null;

  const [prenom, setPrenom] = useState(coach?.prenom ?? '');
  const [nom, setNom] = useState(coach?.nom ?? '');
  const [pseudo, setPseudo] = useState(coach?.pseudo ?? '');
  const [disciplines, setDisciplines] = useState<string[]>(coach?.disciplines ?? []);
  const [niveaux, setNiveaux] = useState<string[]>(coach?.niveaux ?? []);
  const [specialites, setSpecialites] = useState<string[]>(coach?.specialites ?? []);
  const [region, setRegion] = useState(coach?.region ?? '');
  const [tarifHeure, setTarifHeure] = useState(String(coach?.tarifHeure ?? ''));
  const [bio, setBio] = useState(coach?.bio ?? '');
  const [couleur, setCouleur] = useState(coach?.couleur ?? COULEURS[0]);
  const [disponible, setDisponible] = useState(coach?.disponible ?? true);

  if (!coach) {
    return (
      <SafeAreaView style={s.root}>
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
            <Text style={s.backIcon}>‹</Text>
          </TouchableOpacity>
          <Text style={s.headerTitle}>Éditer coach</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={s.emptyWrap}>
          <Text style={s.emptyText}>Coach introuvable.</Text>
        </View>
      </SafeAreaView>
    );
  }

  function toggleDiscipline(d: string) {
    setDisciplines((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]);
  }

  function toggleNiveau(n: string) {
    setNiveaux((prev) => prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]);
  }

  function toggleSpecialite(s: string) {
    setSpecialites((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);
  }

  function sauvegarder() {
    if (!prenom.trim() || !nom.trim() || !pseudo.trim() || !region.trim() || !tarifHeure.trim()) {
      Alert.alert('Champs manquants', 'Veuillez remplir tous les champs requis.');
      return;
    }
    if (disciplines.length === 0 || niveaux.length === 0) {
      Alert.alert('Sélections manquantes', 'Veuillez sélectionner au moins une discipline et un niveau.');
      return;
    }

    if (idx !== -1) {
      coachesStore.list[idx] = {
        ...coachesStore.list[idx],
        auteurId: coachesStore.list[idx].auteurId,
        prenom,
        nom,
        pseudo,
        initiales: (prenom[0] + nom[0]).toUpperCase(),
        couleur,
        disciplines,
        niveaux,
        region,
        tarifHeure: Math.round(Number(tarifHeure)),
        bio,
        specialites,
        disponible,
      };
    }

    Alert.alert(
      'Coach mis à jour ! ✅',
      `Les modifications pour ${prenom} ${nom} ont été sauvegardées.`,
      [{ text: 'OK', onPress: () => router.replace('/(tabs)/services?tab=coach' as any) }],
    );
  }

  function supprimer() {
    Alert.alert(
      'Supprimer ce coach ?',
      `Êtes-vous sûr(e) de vouloir supprimer ${prenom} ${nom} de la liste des coachs ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => {
            // Mettre à jour le store
            coachesStore.list = coachesStore.list.filter((c) => c.id !== coachId);
            Alert.alert('Coach supprimé', `${prenom} ${nom} a été supprimé.`, [
              { text: 'OK', onPress: () => router.back() },
            ]);
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Text style={s.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Éditer coach</Text>
        <TouchableOpacity style={s.deleteBtn} onPress={supprimer}>
          <Text style={s.deleteIcon}>🗑</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
        {/* Avatar couleur */}
        <View style={s.field}>
          <Text style={s.fieldLabel}>Couleur avatar</Text>
          <View style={s.couleursRow}>
            {COULEURS.map((c) => (
              <TouchableOpacity
                key={c}
                style={[s.couleurBtn, { backgroundColor: c }, couleur === c && s.couleurBtnActive]}
                onPress={() => setCouleur(c)}
              />
            ))}
          </View>
        </View>

        {/* Infos personnelles */}
        <View style={s.field}>
          <Text style={s.fieldLabel}>Prénom *</Text>
          <TextInput
            style={[s.input, !!prenom && s.inputFilled]}
            value={prenom}
            onChangeText={setPrenom}
            placeholder="Prénom"
            placeholderTextColor={Colors.textTertiary}
          />
        </View>

        <View style={s.field}>
          <Text style={s.fieldLabel}>Nom *</Text>
          <TextInput
            style={[s.input, !!nom && s.inputFilled]}
            value={nom}
            onChangeText={setNom}
            placeholder="Nom"
            placeholderTextColor={Colors.textTertiary}
          />
        </View>

        <View style={s.field}>
          <Text style={s.fieldLabel}>Pseudo *</Text>
          <TextInput
            style={[s.input, !!pseudo && s.inputFilled]}
            value={pseudo}
            onChangeText={setPseudo}
            placeholder="Pseudo unique"
            placeholderTextColor={Colors.textTertiary}
          />
        </View>

        <View style={s.field}>
          <Text style={s.fieldLabel}>Région *</Text>
          <TextInput
            style={[s.input, !!region && s.inputFilled]}
            value={region}
            onChangeText={setRegion}
            placeholder="Région"
            placeholderTextColor={Colors.textTertiary}
          />
        </View>

        <View style={s.field}>
          <Text style={s.fieldLabel}>Tarif horaire (€ HT) *</Text>
          <TextInput
            style={[s.input, !!tarifHeure && s.inputFilled]}
            value={tarifHeure}
            onChangeText={setTarifHeure}
            placeholder="45"
            placeholderTextColor={Colors.textTertiary}
            keyboardType="number-pad"
          />
        </View>

        {/* Disponibilité */}
        <View style={s.field}>
          <Text style={s.fieldLabel}>Disponibilité</Text>
          <TouchableOpacity
            style={[s.disponibiliteBtn, disponible && s.disponibleActive]}
            onPress={() => setDisponible(!disponible)}
          >
            <Text style={s.disponibiliteText}>{disponible ? '✓ Disponible' : '✗ Non disponible'}</Text>
          </TouchableOpacity>
        </View>

        {/* Disciplines */}
        <View style={s.field}>
          <Text style={s.fieldLabel}>Disciplines *</Text>
          <View style={s.chipsRow}>
            {DISCIPLINES.map((d) => (
              <TouchableOpacity
                key={d}
                style={[s.chip, disciplines.includes(d) && s.chipActive]}
                onPress={() => toggleDiscipline(d)}
              >
                <Text style={[s.chipText, disciplines.includes(d) && s.chipTextActive]}>{d}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Niveaux */}
        <View style={s.field}>
          <Text style={s.fieldLabel}>Niveaux *</Text>
          <View style={s.chipsRow}>
            {NIVEAUX.map((n) => (
              <TouchableOpacity
                key={n}
                style={[s.chip, niveaux.includes(n) && s.chipActive]}
                onPress={() => toggleNiveau(n)}
              >
                <Text style={[s.chipText, niveaux.includes(n) && s.chipTextActive]}>{n}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Spécialités */}
        <View style={s.field}>
          <Text style={s.fieldLabel}>Spécialités</Text>
          <View style={s.chipsRow}>
            {SPECIALITES.map((s_) => (
              <TouchableOpacity
                key={s_}
                style={[s.chip, specialites.includes(s_) && s.chipActive]}
                onPress={() => toggleSpecialite(s_)}
              >
                <Text style={[s.chipText, specialites.includes(s_) && s.chipTextActive]}>{s_}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Bio */}
        <View style={s.field}>
          <Text style={s.fieldLabel}>Bio</Text>
          <TextInput
            style={[s.input, s.inputMulti, !!bio && s.inputFilled]}
            value={bio}
            onChangeText={setBio}
            placeholder="Décrivez votre expérience..."
            placeholderTextColor={Colors.textTertiary}
            multiline
            numberOfLines={4}
          />
        </View>

        <TouchableOpacity style={s.saveBtn} onPress={sauvegarder} activeOpacity={0.85}>
          <Text style={s.saveBtnText}>Sauvegarder les modifications</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.surface },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surfaceVariant, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 24, color: Colors.textPrimary, lineHeight: 28 },
  deleteBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surfaceVariant, alignItems: 'center', justifyContent: 'center' },
  deleteIcon: { fontSize: 20 },
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: Colors.textTertiary, fontSize: FontSize.base },
  container: { padding: Spacing.lg, gap: Spacing.lg },
  field: { gap: Spacing.sm },
  fieldLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5 },
  couleursRow: { flexDirection: 'row', gap: Spacing.sm },
  couleurBtn: { width: 44, height: 44, borderRadius: 22 },
  couleurBtnActive: { borderWidth: 3, borderColor: Colors.textPrimary },
  disponibiliteBtn: { paddingVertical: Spacing.sm + 4, paddingHorizontal: Spacing.md, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  disponibleActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  disponibiliteText: { fontSize: FontSize.base, color: Colors.textPrimary, fontWeight: FontWeight.semibold },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.semibold },
  chipTextActive: { color: Colors.textInverse },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 4, fontSize: FontSize.base, color: Colors.textPrimary, backgroundColor: Colors.surface },
  inputFilled: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  inputMulti: { minHeight: 100, textAlignVertical: 'top' },
  saveBtn: { backgroundColor: Colors.primary, borderRadius: Radius.lg, paddingVertical: Spacing.md + 4, alignItems: 'center', ...Shadow.fab },
  saveBtnText: { color: Colors.textInverse, fontWeight: FontWeight.extrabold, fontSize: FontSize.base },
});
