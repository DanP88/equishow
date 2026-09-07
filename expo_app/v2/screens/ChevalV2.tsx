// ─────────────────────────────────────────────────────────────────────────────
// ChevalV2 — fiche cheval V2 + formulaire d'ajout / modification (LOT F8).
//
//   ChevalV2      : fiche d'un cheval.
//                   · cheval RÉEL (Supabase) → LECTURE SEULE (aucune écriture V2).
//                   · cheval LOCAL V2 (`v2c-…`) → + Modifier / Supprimer.
//   ChevalFormV2  : création / édition d'un cheval LOCAL V2 uniquement.
//                   La création réelle passe par un INSERT Supabase (app V1) →
//                   INTERDIT en V2. Ici : AsyncStorage `v2:chevaux`.
//
// Aucune date à saisir (« année de naissance » = nombre) → pas de V2DateField.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, FontWeight } from '../../constants/theme';
import { Screen, Card, Chip, Row, RowGroup, PrimaryButton, GhostButton, Placeholder } from '../ui/kit';
import { useCheval } from '../../hooks/useChevaux';
import { useChevauxLocal, isLocalHorseId, LocalChevalInput } from '../state/chevauxLocal';
import { V2SelectField } from '../components/V2SelectField';

const SEXES = ['Hongre', 'Jument', 'Étalon'];
const DISCIPLINES = ['CSO', 'Dressage', 'CCE', 'Hunter', 'Endurance', 'Autre'];

// Listes fermées (F8.1) — évitent les fautes / valeurs incohérentes.
const RACES = [
  'Selle Français', 'KWPN', 'Holsteiner', 'Hanovrien', 'Oldenbourg', 'BWP',
  'Zangersheide', 'Anglo-Arabe', 'Pur-sang', 'Trotteur Français', 'Arabe',
  'Connemara', 'Poney Français de Selle', 'Welsh', 'Shetland', 'Haflinger',
  'Fjord', 'Paint Horse', 'Quarter Horse', 'Appaloosa', 'Lusitanien', 'PRE',
  'Frison', 'Trait', 'ONC', 'Autre',
];
const ROBES = [
  'Bai', 'Bai brun', 'Alezan', 'Noir', 'Gris', 'Blanc', 'Isabelle', 'Palomino',
  'Pie', 'Rouan', 'Souris', 'Aubère', 'Louvet', 'Crème', 'Champagne', 'Autre',
];
const NOW_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 41 }, (_, i) => String(NOW_YEAR - i)); // décroissant, ~40 ans
const TAILLES = Array.from({ length: 121 }, (_, i) => ({ value: String(80 + i), label: `${80 + i} cm` })); // 80 → 200 cm

function ageOf(y?: number) {
  if (!y) return undefined;
  const a = new Date().getFullYear() - y;
  return a > 0 && a < 45 ? `${a} ans` : undefined;
}

// ═══════════════════════ FICHE ═══════════════════════
export function ChevalV2() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const local = useChevauxLocal();
  const isLocal = isLocalHorseId(id);
  // Hooks toujours appelés dans le même ordre — id réel seulement si non-local.
  const { cheval: realCheval, isLoading } = useCheval(isLocal ? undefined : id);

  if (isLocal) {
    const c = local.get(id!);
    if (!c) return <Screen><Text style={s.h1}>Cheval introuvable</Text><GhostButton label="← Mes chevaux" onPress={() => router.replace('/(v2)/chevaux' as any)} /></Screen>;
    return (
      <Screen>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/(v2)/chevaux' as any))} hitSlop={8}><Text style={s.back}>← Chevaux</Text></TouchableOpacity>
        <View style={s.headRow}>
          <View style={[s.dot, { backgroundColor: c.couleur }]} />
          <Text style={s.h1}>{c.nom}</Text>
        </View>
        <Text style={s.localTag}>Cheval local V2 — cet appareil uniquement</Text>

        <RowGroup>
          {c.sexe ? <Row icon="⚥" label="Sexe" value={c.sexe} /> : null}
          {c.race ? <Row icon="🐎" label="Race" value={c.race} /> : null}
          {c.robe ? <Row icon="🎨" label="Robe" value={c.robe} /> : null}
          {c.anneeNaissance ? <Row icon="🎂" label="Naissance" value={`${c.anneeNaissance}${ageOf(c.anneeNaissance) ? ` · ${ageOf(c.anneeNaissance)}` : ''}`} /> : null}
          {c.taille ? <Row icon="📏" label="Taille" value={`${c.taille} cm`} /> : null}
          {c.discipline ? <Row icon="🏇" label="Discipline" value={c.discipline} /> : null}
        </RowGroup>

        <PrimaryButton label="Modifier" onPress={() => router.push(`/(v2)/chevaux/${id}/modifier` as any)} />
        <GhostButton label="Supprimer ce cheval" onPress={() => { local.remove(id!); router.replace('/(v2)/chevaux' as any); }} />
        <Placeholder note="stocké localement (v2:chevaux) — aucune donnée Supabase" />
      </Screen>
    );
  }

  // Cheval réel — LECTURE SEULE.
  const c = realCheval;
  if (isLoading) return <Screen scroll={false}><View style={s.center}><ActivityIndicator color={Colors.primary} /></View></Screen>;
  if (!c) return <Screen><Text style={s.h1}>Cheval introuvable</Text><GhostButton label="← Mes chevaux" onPress={() => router.replace('/(v2)/chevaux' as any)} /></Screen>;

  return (
    <Screen>
      <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/(v2)/chevaux' as any))} hitSlop={8}><Text style={s.back}>← Chevaux</Text></TouchableOpacity>
      <View style={s.headRow}>
        <View style={[s.dot, { backgroundColor: c.photoColor || Colors.primary }]} />
        <Text style={s.h1}>{c.nom}</Text>
      </View>

      <RowGroup>
        {c.type ? <Row icon="🐴" label="Type" value={String(c.type)} /> : null}
        {c.sexe ? <Row icon="⚥" label="Sexe" value={c.sexe} /> : null}
        {c.race ? <Row icon="🐎" label="Race" value={c.race} /> : null}
        {c.robe ? <Row icon="🎨" label="Robe" value={c.robe} /> : null}
        {c.anneeNaissance ? <Row icon="🎂" label="Naissance" value={`${c.anneeNaissance}${ageOf(c.anneeNaissance) ? ` · ${ageOf(c.anneeNaissance)}` : ''}`} /> : null}
        {c.taille ? <Row icon="📏" label="Taille" value={c.taille} /> : null}
        {c.numeroSire ? <Row icon="🔖" label="N° SIRE" value={c.numeroSire} /> : null}
        {c.disciplines?.length ? <Row icon="🏇" label="Disciplines" value={c.disciplines.join(', ')} /> : null}
        {c.niveauPratique ? <Row icon="📊" label="Niveau" value={String(c.niveauPratique)} /> : null}
      </RowGroup>

      {c.objectifs ? <Card><Text style={s.sub}>{c.objectifs}</Text></Card> : null}

      <Placeholder note="fiche en LECTURE SEULE dans la V2 — la modification d'un cheval réel passe par l'app actuelle" v1Path={`/cheval/${id}`} v1Label="ouvrir la fiche V1" />
    </Screen>
  );
}

// ═══════════════════════ FORMULAIRE (LOCAL V2) ═══════════════════════
export function ChevalFormV2() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const local = useChevauxLocal();
  const editing = id && isLocalHorseId(id) ? local.get(id) : undefined;

  const [nom, setNom] = useState(editing?.nom ?? '');
  const [sexe, setSexe] = useState(editing?.sexe ?? '');
  const [race, setRace] = useState(editing?.race ?? '');
  const [robe, setRobe] = useState(editing?.robe ?? '');
  const [annee, setAnnee] = useState(editing?.anneeNaissance ? String(editing.anneeNaissance) : '');
  const [taille, setTaille] = useState(editing?.taille ?? '');
  const [discipline, setDiscipline] = useState(editing?.discipline ?? '');

  const canSave = nom.trim().length > 0;

  const save = () => {
    const payload: LocalChevalInput = {
      nom: nom.trim(),
      sexe: sexe || undefined,
      race: race.trim() || undefined,
      robe: robe.trim() || undefined,
      anneeNaissance: /^\d{4}$/.test(annee) ? parseInt(annee, 10) : undefined,
      taille: taille.trim() || undefined,
      discipline: discipline || undefined,
    };
    if (editing) { local.update(editing.id, payload); router.replace(`/(v2)/chevaux/${editing.id}` as any); }
    else { const rec = local.add(payload); router.replace(`/(v2)/chevaux/${rec.id}` as any); }
  };

  return (
    <Screen>
      <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/(v2)/chevaux' as any))} hitSlop={8}><Text style={s.back}>← Retour</Text></TouchableOpacity>
      <Text style={s.h1}>{editing ? 'Modifier le cheval' : 'Ajouter un cheval'}</Text>
      <Text style={s.sub}>Cheval enregistré localement dans la V2 (aucune écriture Supabase).</Text>

      <Card>
        <Field label="Nom *"><TextInput style={s.input} value={nom} onChangeText={setNom} placeholder="Ex. Tornado" placeholderTextColor={Colors.textTertiary} /></Field>
        <Field label="Sexe">
          <View style={s.chips}>{SEXES.map((x) => <Chip key={x} label={x} on={sexe === x} onPress={() => setSexe(sexe === x ? '' : x)} />)}</View>
        </Field>
        <V2SelectField label="Race" value={race} onChange={setRace} options={RACES} placeholder="Sélectionner une race" allowOther />
        <V2SelectField label="Robe" value={robe} onChange={setRobe} options={ROBES} placeholder="Sélectionner une robe" allowOther />
        <View style={s.rowFields}>
          <V2SelectField label="Année de naissance" value={annee} onChange={setAnnee} options={YEARS} placeholder="Année" style={s.flex1} />
          <V2SelectField label="Taille" value={taille} onChange={setTaille} options={TAILLES} placeholder="Taille (cm)" style={s.flex1} />
        </View>
        <Field label="Discipline principale">
          <View style={s.chips}>{DISCIPLINES.map((x) => <Chip key={x} label={x} on={discipline === x} onPress={() => setDiscipline(discipline === x ? '' : x)} />)}</View>
        </Field>
        <PrimaryButton label={editing ? 'Enregistrer' : 'Ajouter ce cheval'} onPress={save} disabled={!canSave} />
      </Card>

      <Placeholder note="v2:chevaux (AsyncStorage) — id préfixé « v2c- », zéro collision avec les chevaux réels, zéro écriture PROD" v1Path="/(tabs)/chevaux" v1Label="création réelle (app V1)" />
    </Screen>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <View style={s.field}><Text style={s.fieldLabel}>{label}</Text>{children}</View>;
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  back: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.bold, marginBottom: 4 },
  h1: { fontSize: 22, fontWeight: FontWeight.extrabold, color: Colors.textPrimary, letterSpacing: -0.3 },
  sub: { fontSize: FontSize.sm, color: Colors.textSecondary },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  dot: { width: 34, height: 34, borderRadius: 17 },
  localTag: { fontSize: FontSize.xs, color: Colors.warning, fontWeight: FontWeight.semibold },
  field: { gap: 4, marginTop: Spacing.sm },
  fieldLabel: { fontSize: 11, fontWeight: FontWeight.bold, color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { borderWidth: 1, borderColor: '#ECEBE7', borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 3, fontSize: FontSize.base, color: Colors.textPrimary, backgroundColor: Colors.surface },
  rowFields: { flexDirection: 'row', gap: Spacing.md },
  flex1: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
});
