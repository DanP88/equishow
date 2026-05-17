import { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView,
  TextInput,
} from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../constants/theme';
import { useMyCoachProfile } from '../hooks/useCoachProfiles';
import { useAuth } from '../hooks/useAuth';
import { AlertModal } from '../components/AlertModal';

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

export default function ProposerCoachScreen() {
  const { profile } = useAuth();
  const { upsert } = useMyCoachProfile();
  const [submitting, setSubmitting] = useState(false);
  const [prenom, setPrenom] = useState('');
  const [nom, setNom] = useState('');
  const [pseudo, setPseudo] = useState('');
  const [disciplines, setDisciplines] = useState<string[]>([]);
  const [niveaux, setNiveaux] = useState<string[]>([]);
  const [specialites, setSpecialites] = useState<string[]>([]);
  const [region, setRegion] = useState('');
  const [tarifHeure, setTarifHeure] = useState('');
  const [bio, setBio] = useState('');
  const [couleur, setCouleur] = useState(COULEURS[0]);
  const [alertState, setAlertState] = useState<{ title: string; message: string; variant: 'info' | 'error'; onClose?: () => void } | null>(null);

  function showErr(title: string, message: string) {
    setAlertState({ title, message, variant: 'error' });
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

  async function valider() {
    if (!profile?.id) {
      showErr('Non connecté', 'Vous devez être connecté pour créer un profil coach.');
      return;
    }
    if (!prenom.trim()) { showErr('Prénom manquant', 'Indiquez votre prénom.'); return; }
    if (!nom.trim()) { showErr('Nom manquant', 'Indiquez votre nom.'); return; }
    if (!pseudo.trim()) { showErr('Pseudo manquant', 'Choisissez un pseudo unique.'); return; }
    if (!region.trim()) { showErr('Région manquante', 'Indiquez votre région d\'activité.'); return; }
    if (!tarifHeure.trim()) { showErr('Tarif manquant', 'Indiquez votre tarif horaire.'); return; }
    const tarifNum = Number(tarifHeure);
    if (Number.isNaN(tarifNum) || tarifNum <= 0) {
      showErr('Tarif invalide', 'Le tarif horaire doit être un nombre supérieur à 0€.');
      return;
    }
    if (disciplines.length === 0) { showErr('Disciplines manquantes', 'Sélectionnez au moins une discipline.'); return; }
    if (niveaux.length === 0) { showErr('Niveaux manquants', 'Sélectionnez au moins un niveau enseigné.'); return; }

    setSubmitting(true);
    const { error } = await upsert({
      bio: bio.trim(),
      disciplines,
      niveaux,
      specialites,
      region: region.trim(),
      tarifHeure: Math.round(tarifNum),
      disponible: true,
    });
    setSubmitting(false);

    if (error) {
      showErr('Erreur', error);
      return;
    }

    setAlertState({
      title: 'Profil coach créé 🎓',
      message: 'Votre profil coach a été enregistré.',
      variant: 'info',
      onClose: () => {
        setAlertState(null);
        router.replace(`/preview-coach?coachId=${profile.id}` as any);
      },
    });
  }

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.canGoBack() ? router.back() : router.replace('/')}>
          <Text style={s.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Ajouter un coach</Text>
        <View style={{ width: 40 }} />
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
            placeholder="Pseudo unique (ex: JohnDoe_CSO)"
            placeholderTextColor={Colors.textTertiary}
          />
        </View>

        <View style={s.field}>
          <Text style={s.fieldLabel}>Région *</Text>
          <TextInput
            style={[s.input, !!region && s.inputFilled]}
            value={region}
            onChangeText={setRegion}
            placeholder="Région (ex: Île-de-France)"
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
            placeholder="Décrivez votre expérience et votre approche pédagogique..."
            placeholderTextColor={Colors.textTertiary}
            multiline
            numberOfLines={4}
          />
        </View>

        <TouchableOpacity style={s.submitBtn} onPress={valider} activeOpacity={0.85} disabled={submitting}>
          <Text style={s.submitText}>{submitting ? 'Création…' : 'Ajouter le coach'}</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      <AlertModal
        visible={!!alertState}
        title={alertState?.title ?? ''}
        message={alertState?.message}
        variant={alertState?.variant ?? 'info'}
        onClose={alertState?.onClose ?? (() => setAlertState(null))}
      />
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
  couleursRow: { flexDirection: 'row', gap: Spacing.sm },
  couleurBtn: { width: 44, height: 44, borderRadius: 22 },
  couleurBtnActive: { borderWidth: 3, borderColor: Colors.textPrimary },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.semibold },
  chipTextActive: { color: Colors.textInverse },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 4, fontSize: FontSize.base, color: Colors.textPrimary, backgroundColor: Colors.surface },
  inputFilled: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  inputMulti: { minHeight: 100, textAlignVertical: 'top' },
  submitBtn: { backgroundColor: Colors.primary, borderRadius: Radius.lg, paddingVertical: Spacing.md + 4, alignItems: 'center', ...Shadow.fab },
  submitText: { color: Colors.textInverse, fontWeight: FontWeight.extrabold, fontSize: FontSize.base },
});
