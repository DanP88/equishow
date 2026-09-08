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
import { BL } from '../ui/blush';
import { Spacing, Radius, FontSize, FontWeight } from '../../constants/theme';
import { Screen, Card, Chip, Row, RowGroup, Section, PrimaryButton, GhostButton, Placeholder } from '../ui/kit';
import { useCheval } from '../../hooks/useChevaux';
import { useChevauxLocal, isLocalHorseId, LocalChevalInput, LocalSante } from '../state/chevauxLocal';
import { V2SelectField } from '../components/V2SelectField';
import { V2DateField, todayStart } from '../components/V2DateField';
import { vaccinStatus, soinStatus, SanteStatus } from '../lib/santeStatus';

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

        <SanteSection local={c.sante} />

        <PrimaryButton label="Modifier" onPress={() => router.push(`/(v2)/chevaux/${id}/modifier` as any)} />
        <GhostButton label="Supprimer ce cheval" onPress={() => { local.remove(id!); router.replace('/(v2)/chevaux' as any); }} />
        <Placeholder note="stocké localement (v2:chevaux) — aucune donnée Supabase" />
      </Screen>
    );
  }

  // Cheval réel — LECTURE SEULE.
  const c = realCheval;
  if (isLoading) return <Screen scroll={false}><View style={s.center}><ActivityIndicator color={BL.accent} /></View></Screen>;
  if (!c) return <Screen><Text style={s.h1}>Cheval introuvable</Text><GhostButton label="← Mes chevaux" onPress={() => router.replace('/(v2)/chevaux' as any)} /></Screen>;

  return (
    <Screen>
      <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/(v2)/chevaux' as any))} hitSlop={8}><Text style={s.back}>← Chevaux</Text></TouchableOpacity>
      <View style={s.headRow}>
        <View style={[s.dot, { backgroundColor: c.photoColor || BL.accent }]} />
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

      <SanteSection real={c.sante} />

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
  const [sante, setSante] = useState<LocalSante>(editing?.sante ?? {});
  const setSanteKey = (k: keyof LocalSante) => (v: string) => setSante((s) => ({ ...s, [k]: v || undefined }));

  const canSave = nom.trim().length > 0;
  const today = todayStart();
  const santeFloor = new Date(NOW_YEAR - 10, 0, 1); // rappels au-delà de 10 ans = hors sujet

  const save = () => {
    const santeClean = Object.fromEntries(Object.entries(sante).filter(([, v]) => !!v));
    const payload: LocalChevalInput = {
      nom: nom.trim(),
      sexe: sexe || undefined,
      race: race.trim() || undefined,
      robe: robe.trim() || undefined,
      anneeNaissance: /^\d{4}$/.test(annee) ? parseInt(annee, 10) : undefined,
      taille: taille.trim() || undefined,
      discipline: discipline || undefined,
      sante: Object.keys(santeClean).length ? (santeClean as LocalSante) : undefined,
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

      <Text style={s.groupTitle}>Santé (facultatif)</Text>
      <Text style={s.sub}>Date du dernier rappel — le statut (à jour / rappel à prévoir / dépassé) est calculé automatiquement.</Text>
      <Card>
        <View style={s.rowFields}>
          <V2DateField label="Vaccin grippe" value={sante.grippe ?? ''} onChange={setSanteKey('grippe')} optional minDate={santeFloor} maxDate={today} style={s.flex1} />
          <V2DateField label="Vaccin rhino" value={sante.rhino ?? ''} onChange={setSanteKey('rhino')} optional minDate={santeFloor} maxDate={today} style={s.flex1} />
        </View>
        <View style={s.rowFields}>
          <V2DateField label="Vermifuge" value={sante.vermifuge ?? ''} onChange={setSanteKey('vermifuge')} optional minDate={santeFloor} maxDate={today} style={s.flex1} />
          <V2DateField label="Maréchal-ferrant" value={sante.marechal ?? ''} onChange={setSanteKey('marechal')} optional minDate={santeFloor} maxDate={today} style={s.flex1} />
        </View>
        <View style={s.rowFields}>
          <V2DateField label="Dentiste" value={sante.dentiste ?? ''} onChange={setSanteKey('dentiste')} optional minDate={santeFloor} maxDate={today} style={s.flex1} />
          <V2DateField label="Ostéopathe" value={sante.osteo ?? ''} onChange={setSanteKey('osteo')} optional minDate={santeFloor} maxDate={today} style={s.flex1} />
        </View>
      </Card>

      <Placeholder note="v2:chevaux (AsyncStorage) — id préfixé « v2c- », zéro collision avec les chevaux réels, zéro écriture PROD" v1Path="/(tabs)/chevaux" v1Label="création réelle (app V1)" />
    </Screen>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <View style={s.field}><Text style={s.fieldLabel}>{label}</Text>{children}</View>;
}

// ── Santé — statut RÉEL (corrige le « Valide » en dur de la V1) ──────────────
// Accepte la forme réelle (`SuiviSante`, dates Date) OU la forme locale V2
// (`LocalSante`, strings 'YYYY-MM-DD').
function fmtSanteDate(d?: Date | string) {
  if (!d) return '—';
  const dt = d instanceof Date ? d : new Date(d.length >= 10 ? `${d}T00:00:00` : d);
  return Number.isNaN(dt.getTime()) ? '—' : dt.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}
function SanteLine({ label, date, st }: { label: string; date?: Date | string; st: SanteStatus }) {
  const dot = st.level === 'ok' ? Colors.success : st.level === 'soon' ? Colors.warning : st.level === 'late' ? Colors.urgent : Colors.textTertiary;
  return (
    <View style={s.santeRow}>
      <View style={[s.santeDot, { backgroundColor: dot }]} />
      <View style={{ flex: 1 }}>
        <Text style={s.santeLabel}>{label}</Text>
        <Text style={s.santeDate}>{fmtSanteDate(date)}{st.ageLabel ? ` · ${st.ageLabel}` : ''}</Text>
      </View>
      <Text style={[s.santeStatus, { color: st.color }]}>{st.label}</Text>
    </View>
  );
}
function SanteSection({ real, local }: { real?: any; local?: any }) {
  const pick = (rk: string, lk: string) => real?.[rk] ?? local?.[lk];
  const specs: [string, Date | string | undefined, (d: any) => SanteStatus][] = [
    ['Vaccin grippe', pick('dateVaccinGrippe', 'grippe'), (d) => vaccinStatus(d)],
    ['Vaccin rhino', pick('dateVaccinRhino', 'rhino'), (d) => vaccinStatus(d)],
    ['Vermifuge', pick('dateVermifuge', 'vermifuge'), (d) => soinStatus(d, 4)],
    ['Maréchal-ferrant', pick('dateMarechal', 'marechal'), (d) => soinStatus(d, 2)],
    ['Dentiste', pick('dateDentiste', 'dentiste'), (d) => soinStatus(d, 12)],
    ['Ostéopathe', pick('dateOsteo', 'osteo'), (d) => soinStatus(d, 12)],
  ];
  const items = specs.filter(([, v]) => !!v).map(([label, v, fn]) => ({ label, date: v, st: fn(v) }));
  if (items.length === 0) return null;
  return (
    <Section title="Santé">
      <RowGroup>
        {items.map((it) => <SanteLine key={it.label} label={it.label} date={it.date} st={it.st} />)}
      </RowGroup>
      <Text style={s.santeNote}>Statut calculé d'après la date du dernier rappel (rappel annuel pour les vaccins).</Text>
    </Section>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  back: { fontSize: FontSize.sm, color: BL.accent, fontWeight: FontWeight.bold, marginBottom: 4 },
  h1: { fontSize: 22, fontWeight: FontWeight.extrabold, color: Colors.textPrimary, letterSpacing: -0.3 },
  sub: { fontSize: FontSize.sm, color: Colors.textSecondary },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  dot: { width: 34, height: 34, borderRadius: 17 },
  localTag: { fontSize: FontSize.xs, color: Colors.warning, fontWeight: FontWeight.semibold },
  field: { gap: 4, marginTop: Spacing.sm },
  fieldLabel: { fontSize: 11, fontWeight: FontWeight.bold, color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 3, fontSize: FontSize.base, color: Colors.textPrimary, backgroundColor: Colors.surface },
  rowFields: { flexDirection: 'row', gap: Spacing.md },
  flex1: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },

  santeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg },
  santeDot: { width: 8, height: 8, borderRadius: 4 },
  santeLabel: { fontSize: FontSize.base, color: Colors.textPrimary, fontWeight: FontWeight.semibold },
  santeDate: { fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: 1 },
  santeStatus: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  santeNote: { fontSize: FontSize.xs, color: Colors.textTertiary, fontStyle: 'italic', marginTop: 4 },
  groupTitle: { fontSize: 11, fontWeight: FontWeight.bold, color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: Spacing.lg },
});
