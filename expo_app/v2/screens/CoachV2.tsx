// ─────────────────────────────────────────────────────────────────────────────
// CoachV2 — parcours Coach V2 (LOT F7, FRONT-ONLY).
//
//   Double position, activités simultanées, AUCUN sélecteur de rôle :
//   🔎 Je cherche un coach   |   📣 Je propose du coaching   |   👥 Mes élèves
//   (« Je propose » / « Mes élèves » = capacité Coach ; sinon opt-in explicite.)
//
//   Je cherche : contexte concours prérempli → coachs (réels lecture seule +
//                démo si non connecté) → détail → demande SIMULÉE.
//                Aucun résultat → « Publier ma demande » (LOCAL v2:coach).
//   Je propose : annonce de coaching → publication SIMULÉE (locale).
//   Mes élèves : demandes reçues (lecture seule) + cavaliers coachés.
//
// Aucune écriture PROD. Aucun Stripe. Aucune vraie demande / séance.
// Miroir de v2/screens/TransportV2 / BoxV2 (F5/F6).
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams, Redirect } from 'expo-router';
import { Colors } from '../../constants/colors';
import { BL } from '../ui/blush';
import { Spacing, Radius, FontSize, FontWeight } from '../../constants/theme';
import { Screen, Card, Chip, Row, RowGroup, PrimaryButton, GhostButton, Placeholder, EmptyState } from '../ui/kit';
import { useConcours } from '../../hooks/useConcours';
import { useSearchHorses } from '../state/searchHorses';
import { useV2ContestHorses } from '../state/contestHorses';
import { useConcoursChevalCoach } from '../state/concoursChevalCoach';
import { V2HorsePicker } from '../components/V2HorsePicker';
import { useCapabilities } from '../capabilities';
import { useConcoursLocal } from '../state/concoursLocal';
import { useCoachLocal } from '../state/coachLocal';
import { useV2CoachResults, useV2CoachDemands, V2CoachResult } from '../adapters/coach';
import { V2DateField, V2DateRange, todayStart } from '../components/V2DateField';
import { V2DestinationField } from '../components/V2DestinationField';
import { useAutoDestination } from '../state/autoDestination';
import { MOCK_STUDENT_HORSES } from '../mocks/f2';

const DISCIPLINES = ['CSO', 'Dressage', 'CCE', 'Hunter', 'Autre'];
const NIVEAUX = ['Poney', 'Club', 'Amateur', 'Pro'];

// ── helpers ────────────────────────────────────────────────────────────────
function fmtDate(d?: string) {
  if (!d) return '—';
  const dt = new Date(d.length >= 10 ? d : `${d}T00:00:00`);
  return isNaN(dt.getTime()) ? d : dt.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}
function backTo(concoursId?: string) {
  if (router.canGoBack()) router.back();
  else router.replace((concoursId ? `/(v2)/concours/${concoursId}` : '/(v2)/accueil') as any);
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <View style={s.field}><Text style={s.fieldLabel}>{label}</Text>{children}</View>;
}
function Stepper({ value, onChange, min = 1, max = 5 }: { value: number; onChange: (n: number) => void; min?: number; max?: number }) {
  return (
    <View style={s.stepper}>
      <TouchableOpacity style={s.stepBtn} onPress={() => onChange(Math.max(min, value - 1))}><Text style={s.stepTxt}>−</Text></TouchableOpacity>
      <Text style={s.stepVal}>{value}</Text>
      <TouchableOpacity style={s.stepBtn} onPress={() => onChange(Math.min(max, value + 1))}><Text style={s.stepTxt}>+</Text></TouchableOpacity>
    </View>
  );
}

// ═══════════════════════ HUB ═══════════════════════
export function CoachHubV2() {
  const { concoursId, chevalId, chevalIds, face } = useLocalSearchParams<{ concoursId?: string; chevalId?: string; chevalIds?: string; face?: string }>();
  if (face === 'cherche') return <CoachChercheV2 />;
  if (face === 'propose') return <CoachProposeV2 />;
  if (face === 'eleves') return <CoachElevesV2 />;

  const caps = useCapabilities();
  const { concours } = useConcours(concoursId);
  const q = new URLSearchParams();
  if (concoursId) q.set('concoursId', concoursId);
  if (chevalIds) q.set('chevalIds', chevalIds);
  else if (chevalId) q.set('chevalId', chevalId);
  const base = q.toString() ? `?${q.toString()}` : '';

  return (
    <Screen>
      <TouchableOpacity onPress={() => backTo(concoursId)} hitSlop={8}><Text style={s.back}>← Retour</Text></TouchableOpacity>
      <Text style={s.h1}>🎓 Coach</Text>
      {concours && <Text style={s.sub}>Pour {concours.nom} · {concours.lieu} · {concours.dateLabel}</Text>}

      <TouchableOpacity style={[s.door, s.doorSearch]} activeOpacity={0.9} onPress={() => router.push(`/(v2)/coach${base}${base ? '&' : '?'}face=cherche` as any)}>
        <Text style={s.doorIcon}>🔎</Text>
        <Text style={s.doorTitle}>Je cherche un coach</Text>
        <Text style={s.doorSub}>Pour un concours ou en général</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[s.door, s.doorOffer]} activeOpacity={0.9} onPress={() => router.push(`/(v2)/coach${base}${base ? '&' : '?'}face=propose` as any)}>
        <Text style={s.doorIcon}>📣</Text>
        <Text style={s.doorTitle}>Je propose du coaching</Text>
        <Text style={s.doorSub}>{caps.has('coach') ? 'Publier une annonce de coaching' : 'Nécessite d’activer l’activité Coach'}</Text>
      </TouchableOpacity>

      {caps.has('coach') && (
        <TouchableOpacity style={[s.door, s.doorEleves]} activeOpacity={0.9} onPress={() => router.push(`/(v2)/coach${base}${base ? '&' : '?'}face=eleves` as any)}>
          <Text style={s.doorIcon}>👥</Text>
          <Text style={s.doorTitle}>Mes élèves</Text>
          <Text style={s.doorSub}>Demandes reçues · cavaliers coachés</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity onPress={() => router.push('/(v2)/coach/mes-coachings' as any)} hitSlop={8}>
        <Text style={s.link}>Mes coachings ›</Text>
      </TouchableOpacity>
    </Screen>
  );
}

// ═══════════════════════ JE CHERCHE ═══════════════════════
export function CoachChercheV2() {
  const { concoursId, concoursNom, chevalIds } = useLocalSearchParams<{ concoursId?: string; chevalIds?: string; concoursNom?: string }>();
  const { concours } = useConcours(concoursId);
  const cl = useConcoursLocal(concoursId);
  const kl = useCoachLocal(concoursId);
  // Chevaux concernés par CETTE recherche (seed = hub / Préparer, modifiable ici).
  const ch = useSearchHorses(concoursId, 'coach', chevalIds);

  const [discipline, setDiscipline] = useState('CSO');
  const [niveau, setNiveau] = useState('Amateur');
  const [nbSeances, setNbSeances] = useState(1);
  const [dateSouhaitee, setDateSouhaitee] = useState('');
  const dest = useAutoDestination(concoursId, concours);
  const [message, setMessage] = useState('');
  const [searched, setSearched] = useState(false);
  const [publishedId, setPublishedId] = useState<string | null>(null);
  const type: 'concours' | 'regulier' = concoursId ? 'concours' : 'regulier';

  const { results, demo } = useV2CoachResults({ concoursId, discipline });
  const alreadyPublished = !!(kl.context.search || (publishedId && kl.searches.some((x) => x.id === publishedId)));

  const publishSearch = () => {
    ch.persist();
    const rec = kl.publishSearch({
      concoursId, concoursNom: concours?.nom, chevalId: ch.primaryId,
      type, discipline, niveau, nbSeances,
      dateSouhaitee: dateSouhaitee || undefined,
      lieu: dest.value.trim() || undefined,
      message: message.trim() || undefined,
    });
    setPublishedId(rec.id);
    if (concoursId && (cl.entry.needCoach === 'unset' || cl.entry.needCoach === 'searching')) {
      cl.update({ needCoach: 'searching' });
    }
  };

  const runSearch = () => { ch.persist(); setSearched(true); };

  return (
    <Screen>
      <TouchableOpacity onPress={() => backTo(concoursId)} hitSlop={8}><Text style={s.back}>← Coach</Text></TouchableOpacity>
      <Text style={s.h1}>🔎 Je cherche un coach</Text>

      {!concours && concoursNom ? <Text style={s.forHorses}>🏆 {concoursNom} (saisie libre)</Text> : null}
      {concours && (
        <View style={s.ctxCard}>
          <Text style={s.ctxTitle}>Contexte du concours</Text>
          <Text style={s.ctxLine}>🏆 {concours.nom}</Text>
          <Text style={s.ctxLine}>📍 {concours.lieu || '—'}   ·   📅 {concours.dateLabel || '—'}</Text>
        </View>
      )}

      <Card>
        <V2HorsePicker
          value={ch.ids}
          onChange={ch.setIds}
          title="Chevaux concernés"
          hint={concoursId ? 'Repris de « Préparer mon concours » — modifiable pour cette recherche.' : undefined}
        />
        {ch.hasSelection && <Text style={s.forHorses}>{ch.count > 1 ? `${ch.count} chevaux` : '1 cheval'} · {ch.label}</Text>}
        <Field label="Discipline">
          <View style={s.chips}>{DISCIPLINES.map((d) => <Chip key={d} label={d} on={discipline === d} onPress={() => setDiscipline(d)} />)}</View>
        </Field>
        <Field label="Niveau">
          <View style={s.chips}>{NIVEAUX.map((n) => <Chip key={n} label={n} on={niveau === n} onPress={() => setNiveau(n)} />)}</View>
        </Field>
        <View style={s.rowFields}>
          <Field label="Nombre de séances"><Stepper value={nbSeances} onChange={setNbSeances} /></Field>
          {!concoursId && (
            <V2DateField label="Quand ? (facultatif)" value={dateSouhaitee} onChange={setDateSouhaitee} optional minDate={todayStart()} style={s.flex1} />
          )}
        </View>
        <V2DestinationField
          label={concours ? 'Lieu du coaching' : 'Lieu / zone du coaching'}
          auto={dest}
          placeholder={concours ? 'Carrière, paddock… (précision)' : 'Ville / commune'}
          concoursNom={!concours ? concoursNom : undefined}
        />
        <Field label="Message au coach (facultatif)">
          <TextInput style={[s.input, s.multiline]} value={message} onChangeText={setMessage} placeholder="Objectif, cheval, horaires…" placeholderTextColor={Colors.textTertiary} multiline />
        </Field>
        <PrimaryButton label="Rechercher" onPress={runSearch} />
      </Card>

      {searched && (
        results.length > 0 ? (
          <>
            <Text style={s.resultsTitle}>{results.length} coach{results.length > 1 ? 's' : ''} disponible{results.length > 1 ? 's' : ''}{demo ? ' (démonstration)' : ''}</Text>
            {results.map((r) => <ResultCard key={r.id} r={r} concoursId={concoursId} chevalIds={ch.param} discipline={discipline} niveau={niveau} nbSeances={nbSeances} />)}
            {demo && <Placeholder note="résultats de démonstration — connecte-toi pour voir les vrais coachs" v1Path="/(tabs)/services?tab=coach" v1Label="annonces actuelles" />}
          </>
        ) : (
          <Card>
            <EmptyState icon="🎓" title="Aucun coach disponible pour cette recherche" body="Personne ne propose de coaching ici pour l'instant. Publie ta demande : les coachs du secteur pourront te répondre." />
            {alreadyPublished ? (
              <View style={s.published}>
                <Text style={s.publishedTxt}>✅ Demande publiée</Text>
                <Text style={s.sub}>Les coachs concernés pourront te proposer un créneau.</Text>
                <GhostButton label="Voir / modifier ma demande" onPress={() => router.push('/(v2)/coach/mes-coachings' as any)} />
              </View>
            ) : (
              <PrimaryButton label="📣 Publier ma demande de coaching" onPress={publishSearch} />
            )}
          </Card>
        )
      )}
    </Screen>
  );
}

function ResultCard({ r, concoursId, chevalIds, discipline, niveau, nbSeances }: { r: V2CoachResult; concoursId?: string; chevalIds?: string; discipline: string; niveau: string; nbSeances: number }) {
  const q = new URLSearchParams({ id: r.id, src: r.src, discipline, niveau, nb: String(nbSeances) });
  if (concoursId) q.set('concoursId', concoursId);
  if (chevalIds) q.set('chevalIds', chevalIds);
  return (
    <TouchableOpacity style={s.result} activeOpacity={0.9} onPress={() => router.push(`/(v2)/coach/detail?${q.toString()}` as any)}>
      <View style={s.resultHead}>
        <View style={[s.avatar, { backgroundColor: r.couleur }]}><Text style={s.avatarTxt}>{r.initiales}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={s.resultName}>{r.nom}{r.note ? `  ★ ${r.note}` : ''}</Text>
          <Text style={s.resultTrajet}>{r.disciplines} · {r.niveaux}</Text>
        </View>
        {r.src === 'demo' && <View style={s.demoTag}><Text style={s.demoTagTxt}>démo</Text></View>}
      </View>
      <Text style={s.resultMeta}>
        {r.prixSeance} € / séance · {r.places} créneau{r.places > 1 ? 'x' : ''} dispo{r.coachedHere != null ? ` · ${r.coachedHere} cavaliers coachés ici` : ''}
      </Text>
      <Text style={s.resultCta}>Voir le détail ›</Text>
    </TouchableOpacity>
  );
}

// ═══════════════════════ DÉTAIL ═══════════════════════
export function CoachDetailV2() {
  const { id, concoursId, chevalIds, discipline, niveau, nb } = useLocalSearchParams<{ id: string; src?: string; concoursId?: string; chevalIds?: string; discipline?: string; niveau?: string; nb?: string }>();
  const { results } = useV2CoachResults({ concoursId });
  const r = useMemo(() => results.find((x) => x.id === id), [results, id]);

  if (!r) return <Screen scroll={false}><View style={s.center}><ActivityIndicator color={BL.accent} /><Text style={s.sub}>Chargement…</Text></View></Screen>;

  const q = new URLSearchParams({ id: r.id, src: r.src });
  if (concoursId) q.set('concoursId', concoursId);
  if (chevalIds) q.set('chevalIds', chevalIds);
  if (discipline) q.set('discipline', discipline);
  if (niveau) q.set('niveau', niveau);
  if (nb) q.set('nb', nb);

  return (
    <Screen>
      <TouchableOpacity onPress={() => router.back()} hitSlop={8}><Text style={s.back}>← Résultats</Text></TouchableOpacity>
      <Text style={s.h1}>{r.nom}</Text>
      {r.src === 'demo' && <Text style={s.demoLine}>Coach de démonstration</Text>}

      <RowGroup>
        <Row icon="🎓" label="Coach" value={`${r.nom}${r.note ? ` · ★ ${r.note}` : ''}`} sub={r.coachedHere != null ? `${r.coachedHere} cavaliers coachés ici` : undefined} />
        <Row icon="🏇" label="Disciplines" value={r.disciplines} />
        <Row icon="📊" label="Niveaux" value={r.niveaux} />
        <Row icon="🗂" label="Type" value={r.type === 'concours' ? 'sur concours' : 'régulier'} />
        {r.concoursNom ? <Row icon="🏆" label="Concours" value={r.concoursNom} /> : null}
        {r.region ? <Row icon="📍" label="Secteur" value={r.region} /> : null}
        <Row icon="🎟" label="Créneaux disponibles" value={String(r.places)} />
        <Row icon="💶" label="Prix" value={`${r.prixSeance} € / séance`} />
      </RowGroup>

      {r.description ? <Card><Text style={s.desc}>{r.description}</Text></Card> : null}

      <PrimaryButton label="Demander un coaching" onPress={() => router.push(`/(v2)/coach/demander?${q.toString()}` as any)} />
      <Placeholder note="demande simulée en F7 — aucun paiement, aucune écriture" />
    </Screen>
  );
}

// ═══════════════════════ DEMANDE SIMULÉE ═══════════════════════
export function CoachDemanderV2() {
  const { id, concoursId, chevalIds, discipline, niveau, nb } = useLocalSearchParams<{ id: string; src?: string; concoursId?: string; chevalIds?: string; discipline?: string; niveau?: string; nb?: string }>();
  const { concours } = useConcours(concoursId);
  const { results, commission } = useV2CoachResults({ concoursId });
  const cl = useConcoursLocal(concoursId);
  const kl = useCoachLocal(concoursId);
  const ch = useSearchHorses(concoursId, 'coach', chevalIds);
  const contestCh = useV2ContestHorses(concoursId);
  const assocStore = useConcoursChevalCoach(concoursId);
  const r = results.find((x) => x.id === id);
  const [done, setDone] = useState(false);
  const [assocDone, setAssocDone] = useState(false);
  const [assocSel, setAssocSel] = useState<string[]>([]);

  // G3 — chevaux à proposer pour l'association (tous ceux du concours ;
  // pré-cochés = ceux visés par la recherche coach).
  const assocHorses = contestCh.horses.length ? contestCh.horses : ch.horses;
  useEffect(() => {
    if (done && assocSel.length === 0) {
      setAssocSel(ch.ids.length ? ch.ids : assocHorses.map((h) => h.id));
    }
  }, [done]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!r) return <Screen scroll={false}><View style={s.center}><ActivityIndicator color={BL.accent} /></View></Screen>;

  const nbSeances = Math.max(1, parseInt(nb || '1', 10) || 1);
  const sousTotal = r.prixSeance * nbSeances;
  const totalCommission = Math.round(sousTotal * commission);
  const total = sousTotal + totalCommission;

  const confirm = () => {
    ch.persist();
    kl.book({
      src: r.src, refId: r.id, concoursId, concoursNom: concours?.nom, chevalId: ch.primaryId,
      coach: r.nom, coachUserId: r.coachUserId, annonceId: r.src === 'real' ? r.id : undefined,
      discipline: discipline || r.disciplines, niveau: niveau || r.niveaux,
      nbSeances, prixSeance: r.prixSeance, prix: total,
      date: concours?.date_debut ?? undefined,
    });
    if (concoursId) cl.update({ needCoach: 'done' });
    const sr = kl.context.search;
    if (sr) kl.updateSearch(sr.id, { status: 'closed' });
    setDone(true);
  };

  const toggleAssoc = (hid: string) =>
    setAssocSel((v) => (v.includes(hid) ? v.filter((x) => x !== hid) : [...v, hid]));
  const doAssoc = () => {
    assocStore.setMany(assocSel, {
      coachUserId: r!.coachUserId,
      coachNom: r!.nom,
      coachInitiales: r!.initiales,
      coachCouleur: r!.couleur,
      annonceId: r!.src === 'real' ? r!.id : undefined,
      source: 'reservation',
    });
    setAssocDone(true);
  };

  if (done) {
    const showAssoc = !!concoursId && assocHorses.length > 0 && !assocDone;
    return (
      <Screen>
        <View style={s.successWrap}>
          <Text style={s.successIcon}>✅</Text>
          <Text style={s.successTitle}>Demande envoyée</Text>
          <Text style={s.sub}>Demande simulée — aucun paiement réel, le coach n'a pas été contacté.</Text>
        </View>

        {showAssoc && (
          <Card>
            <Text style={s.assocTitle}>Associer ce coach à vos chevaux pour ce concours</Text>
            <Text style={s.sub}>{r.nom} sera présent{concours ? ` au ${concours.nom}` : ' sur ce concours'}.</Text>
            <View style={{ gap: 6, marginTop: 8 }}>
              {assocHorses.map((h) => {
                const on = assocSel.includes(h.id);
                return (
                  <TouchableOpacity key={h.id} style={[s.assocRow, on && s.assocRowOn]} activeOpacity={0.85} onPress={() => toggleAssoc(h.id)}>
                    <Text style={s.assocCheck}>{on ? '☑' : '☐'}</Text>
                    <Text style={s.assocName}>{h.nom}{h.src === 'local' ? '  · local' : ''}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <PrimaryButton label="Associer aux chevaux sélectionnés" onPress={doAssoc} disabled={assocSel.length === 0} />
            <GhostButton label="Plus tard" onPress={() => setAssocDone(true)} />
            <Placeholder note="association stockée localement (v2:concours-cheval-coach) — n'affecte jamais le coach permanent" />
          </Card>
        )}
        {assocDone && assocSel.length > 0 && (
          <Text style={s.assocOk}>✅ {r.nom} associé à {assocSel.length} {assocSel.length > 1 ? 'chevaux' : 'cheval'} pour ce concours.</Text>
        )}

        <RowGroup>
          <Row icon="🎓" label="Coach" value={r.nom} />
          <Row icon="🏇" label="Coaching" value={`${discipline || r.disciplines} · ${niveau || r.niveaux}`} />
          <Row icon="🎟" label="Séances" value={String(nbSeances)} />
          {concours ? <Row icon="🏆" label="Concours" value={concours.nom} /> : null}
          {ch.count > 0 ? <Row icon="🐴" label={ch.count > 1 ? 'Chevaux' : 'Cheval'} value={ch.names.join(', ')} /> : null}
          <Row icon="💶" label="Total" value={`${total} €`} />
        </RowGroup>
        <PrimaryButton label={concoursId ? 'Retour à Mon concours' : 'Voir Mes coachings'} onPress={() => router.replace((concoursId ? `/(v2)/concours/${concoursId}` : '/(v2)/coach/mes-coachings') as any)} />
        <GhostButton label="Accueil" onPress={() => router.replace('/(v2)/accueil' as any)} />
      </Screen>
    );
  }

  return (
    <Screen>
      <TouchableOpacity onPress={() => router.back()} hitSlop={8}><Text style={s.back}>← Détail</Text></TouchableOpacity>
      <Text style={s.h1}>Récapitulatif</Text>

      <RowGroup>
        <Row icon="🎓" label="Coach" value={`${r.nom}${r.note ? ` · ★ ${r.note}` : ''}`} />
        <Row icon="🏇" label="Coaching" value={`${discipline || r.disciplines} · ${niveau || r.niveaux}`} />
        <Row icon="🎟" label="Séances" value={String(nbSeances)} />
        {concours ? <Row icon="🏆" label="Concours" value={concours.nom} /> : null}
        {ch.count > 0
          ? <Row icon="🐴" label={ch.count > 1 ? 'Chevaux' : 'Cheval'} value={ch.names.join(', ')} sub={ch.count > 1 ? `${ch.count} chevaux concernés` : undefined} />
          : <Row icon="🐴" label="Cheval" value="non précisé" sub="défini dans « Préparer mon concours »" />}
      </RowGroup>

      <Card>
        <Row label={`${r.prixSeance} € × ${nbSeances} séance${nbSeances > 1 ? 's' : ''}`} value={`${sousTotal} €`} />
        <Row label={`Commission plateforme (${Math.round(commission * 100)} %)`} value={`${totalCommission} €`} />
        <View style={s.totalRow}><Text style={s.totalLabel}>Total</Text><Text style={s.totalValue}>{total} €</Text></View>
      </Card>

      <PrimaryButton label="Confirmer la demande" onPress={confirm} />
      <Placeholder note="F7 : confirmation LOCALE simulée — pas de Stripe, pas de paiement, pas d'écriture PROD" />
    </Screen>
  );
}

// ═══════════════════════ JE PROPOSE ═══════════════════════
export function CoachProposeV2() {
  const { concoursId } = useLocalSearchParams<{ concoursId?: string }>();
  const caps = useCapabilities();
  const { concours } = useConcours(concoursId);
  const cl = useConcoursLocal(concoursId);
  const kl = useCoachLocal(concoursId);

  const [type, setType] = useState<'concours' | 'regulier'>(concoursId ? 'concours' : 'regulier');
  const [discipline, setDiscipline] = useState('CSO');
  const dest = useAutoDestination(concoursId, concours);
  const [niveaux, setNiveaux] = useState<string[]>(['Club', 'Amateur']);
  const [dateDebut, setDateDebut] = useState(concours?.date_debut ?? '');
  const [dateFin, setDateFin] = useState(concours?.date_fin ?? '');
  const [prixSeance, setPrixSeance] = useState('');
  const [places, setPlaces] = useState('4');
  const [description, setDescription] = useState('');
  const [done, setDone] = useState(false);

  // Opt-in explicite : proposer du coaching exige l'activité Coach.
  if (!caps.has('coach')) return <Redirect href={'/(v2)/coach-optin' as any} />;

  const existing = kl.context.offer;

  const toggleNiveau = (n: string) => setNiveaux((p) => p.includes(n) ? p.filter((x) => x !== n) : [...p, n]);

  const publish = () => {
    kl.publishOffer({
      concoursId, concoursNom: concours?.nom, type,
      discipline, niveaux: niveaux.length ? niveaux : ['Club'],
      dateDebut: type === 'concours' ? (concours?.date_debut ?? undefined) : (dateDebut || undefined),
      dateFin: type === 'concours' ? (concours?.date_fin ?? undefined) : (dateFin || undefined),
      prixSeance: parseInt(prixSeance, 10) || 0, places: parseInt(places, 10) || 1,
      lieu: dest.value.trim() || undefined,
      description: description.trim() || undefined,
    });
    if (concoursId && cl.entry.needCoach === 'unset') cl.update({ needCoach: 'offering' });
    setDone(true);
  };

  if (done || existing) {
    return (
      <Screen>
        <View style={s.successWrap}>
          <Text style={s.successIcon}>✅</Text>
          <Text style={s.successTitle}>Coaching publié</Text>
          <Text style={s.sub}>Annonce enregistrée localement (prototype).</Text>
        </View>
        <RowGroup>
          <Row icon="🗂" label="Type" value={(existing?.type ?? type) === 'concours' ? 'sur concours' : 'régulier'} />
          <Row icon="🏇" label="Discipline" value={existing?.discipline ?? discipline} />
          <Row icon="📊" label="Niveaux" value={(existing?.niveaux ?? niveaux).join(', ')} />
          <Row icon="💶" label="Prix / séance" value={`${existing?.prixSeance ?? prixSeance} €`} />
          <Row icon="🎟" label="Créneaux" value={String(existing?.places ?? places)} />
        </RowGroup>
        <PrimaryButton label="Voir dans Mes coachings" onPress={() => router.replace('/(v2)/coach/mes-coachings' as any)} />
        <GhostButton label={concoursId ? 'Retour à Mon concours' : 'Retour'} onPress={() => router.replace((concoursId ? `/(v2)/concours/${concoursId}` : '/(v2)/coach') as any)} />
      </Screen>
    );
  }

  return (
    <Screen>
      <TouchableOpacity onPress={() => backTo(concoursId)} hitSlop={8}><Text style={s.back}>← Coach</Text></TouchableOpacity>
      <Text style={s.h1}>📣 Je propose du coaching</Text>

      {concours && (
        <View style={s.ctxCard}>
          <Text style={s.ctxTitle}>Rattaché au concours</Text>
          <Text style={s.ctxLine}>🏆 {concours.nom} · 📍 {concours.lieu} · 📅 {concours.dateLabel}</Text>
        </View>
      )}

      <Card>
        {!concoursId && (
          <Field label="Type">
            <View style={s.chips}>
              <Chip label="Régulier" on={type === 'regulier'} onPress={() => setType('regulier')} />
              <Chip label="Sur un concours" on={type === 'concours'} onPress={() => setType('concours')} />
            </View>
          </Field>
        )}
        <Field label="Discipline">
          <View style={s.chips}>{DISCIPLINES.map((d) => <Chip key={d} label={d} on={discipline === d} onPress={() => setDiscipline(d)} />)}</View>
        </Field>
        <Field label="Niveaux encadrés">
          <View style={s.chips}>{NIVEAUX.map((n) => <Chip key={n} label={n} on={niveaux.includes(n)} onPress={() => toggleNiveau(n)} />)}</View>
        </Field>
        <V2DestinationField
          label={concours ? 'Lieu du coaching' : 'Zone du coaching'}
          auto={dest}
          placeholder={concours ? 'Carrière, paddock… (précision)' : 'Ville / secteur'}
        />
        {type === 'regulier' && !concoursId && (
          <V2DateRange startLabel="Disponible du" endLabel="au" start={dateDebut} end={dateFin} onChangeStart={setDateDebut} onChangeEnd={setDateFin} minDate={todayStart()} />
        )}
        <View style={s.rowFields}>
          <Field label="Prix / séance (€)"><TextInput style={s.input} value={prixSeance} onChangeText={setPrixSeance} keyboardType="number-pad" placeholder="45" placeholderTextColor={Colors.textTertiary} /></Field>
          <Field label="Créneaux"><TextInput style={s.input} value={places} onChangeText={setPlaces} keyboardType="number-pad" /></Field>
        </View>
        <Field label="Informations utiles"><TextInput style={[s.input, s.multiline]} value={description} onChangeText={setDescription} placeholder="Déroulé d'une séance, horaires, débrief vidéo…" placeholderTextColor={Colors.textTertiary} multiline /></Field>
        <PrimaryButton label="Publier l'annonce" onPress={publish} />
      </Card>
      <Placeholder note="publication LOCALE (v2:coach) — aucune écriture dans coach_annonces PROD" v1Path="/proposer-coach" v1Label="formulaire actuel (V1)" />
    </Screen>
  );
}

// ═══════════════════════ MES ÉLÈVES ═══════════════════════
export function CoachElevesV2() {
  const { concoursId } = useLocalSearchParams<{ concoursId?: string }>();
  const caps = useCapabilities();
  const { demands, demo } = useV2CoachDemands();
  const [handled, setHandled] = useState<Record<string, 'accepted' | 'rejected'>>({});

  if (!caps.has('coach')) return <Redirect href={'/(v2)/coach-optin' as any} />;

  return (
    <Screen>
      <TouchableOpacity onPress={() => backTo(concoursId)} hitSlop={8}><Text style={s.back}>← Coach</Text></TouchableOpacity>
      <Text style={s.h1}>👥 Mes élèves</Text>

      <Text style={s.section}>Demandes reçues · {demands.length}{demo ? ' (démonstration)' : ''}</Text>
      {demands.length === 0 ? (
        <EmptyState icon="📭" title="Aucune demande en attente" body="Les demandes de coaching de tes cavaliers apparaîtront ici." />
      ) : demands.map((d) => (
        <Card key={d.id}>
          <Text style={s.itemTitle}>{d.cavalier} / {d.cheval}</Text>
          <Text style={s.itemMeta}>{d.discipline} · {d.niveau} · {d.nbSeances} séance{d.nbSeances > 1 ? 's' : ''}</Text>
          {d.concoursNom ? <Text style={s.itemMeta}>🏆 {d.concoursNom}</Text> : null}
          {handled[d.id] ? (
            <Text style={[s.handledTxt, handled[d.id] === 'accepted' ? s.accepted : s.rejected]}>
              {handled[d.id] === 'accepted' ? '✅ Acceptée (simulé)' : '✕ Refusée (simulé)'}
            </Text>
          ) : (
            <View style={s.demandBtns}>
              <TouchableOpacity style={s.acceptBtn} onPress={() => setHandled((h) => ({ ...h, [d.id]: 'accepted' }))}><Text style={s.acceptTxt}>Accepter</Text></TouchableOpacity>
              <TouchableOpacity style={s.rejectBtn} onPress={() => setHandled((h) => ({ ...h, [d.id]: 'rejected' }))}><Text style={s.rejectTxt}>Refuser</Text></TouchableOpacity>
            </View>
          )}
        </Card>
      ))}

      <Text style={s.section}>Mes cavaliers & chevaux</Text>
      <RowGroup>
        {MOCK_STUDENT_HORSES.map((h) => (
          <Row key={h.id} icon="🐴" label={`${h.horse} — ${h.rider}`} value={h.discipline} sub={h.concours || undefined} />
        ))}
      </RowGroup>

      <Placeholder note="gestion réelle des demandes / séances (accept/refus, planning) = Phase 2 backend" v1Path="/(tabs)/coach-demandes" v1Label="demandes actuelles (V1)" />
    </Screen>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  back: { fontSize: FontSize.sm, color: BL.accent, fontWeight: FontWeight.bold, marginBottom: 4 },
  h1: { fontSize: 22, fontWeight: FontWeight.extrabold, color: Colors.textPrimary, letterSpacing: -0.3 },
  sub: { fontSize: FontSize.sm, color: Colors.textSecondary },
  link: { fontSize: FontSize.sm, color: BL.accent, fontWeight: FontWeight.bold, marginTop: Spacing.md },
  section: { fontSize: 11, fontWeight: FontWeight.bold, color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: Spacing.lg },

  door: { borderRadius: 16, borderWidth: 1, padding: Spacing.lg, gap: 4, marginTop: Spacing.md },
  doorSearch: { backgroundColor: Colors.infoBg, borderColor: Colors.infoBorder },
  doorOffer: { backgroundColor: BL.accentSoft, borderColor: BL.accentLine },
  doorEleves: { backgroundColor: Colors.successBg, borderColor: Colors.successBorder },
  doorIcon: { fontSize: 22 },
  doorTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.extrabold, color: Colors.textPrimary },
  doorSub: { fontSize: FontSize.sm, color: Colors.textSecondary },

  ctxCard: { backgroundColor: BL.accentSoft, borderColor: BL.accentLine, borderWidth: 1, borderRadius: 14, padding: Spacing.md, gap: 3, marginTop: Spacing.sm },
  ctxTitle: { fontSize: 11, fontWeight: FontWeight.extrabold, color: BL.accent, letterSpacing: 0.6, textTransform: 'uppercase' },
  ctxLine: { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: FontWeight.semibold },
  forHorses: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: BL.accent, marginTop: 2 },

  field: { gap: 4, marginTop: Spacing.sm },
  fieldLabel: { fontSize: 11, fontWeight: FontWeight.bold, color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 3, fontSize: FontSize.base, color: Colors.textPrimary, backgroundColor: Colors.surface },
  multiline: { minHeight: 64, textAlignVertical: 'top' },
  rowFields: { flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start' },
  flex1: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },

  stepper: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingVertical: 6, paddingHorizontal: Spacing.md, alignSelf: 'flex-start', backgroundColor: Colors.surface },
  stepBtn: { width: 26, height: 26, borderRadius: 13, backgroundColor: BL.accentSoft, alignItems: 'center', justifyContent: 'center' },
  stepTxt: { fontSize: 16, fontWeight: FontWeight.extrabold, color: BL.accent },
  stepVal: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary, minWidth: 16, textAlign: 'center' },

  resultsTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textSecondary, marginTop: Spacing.md },
  result: { backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, gap: 4, marginTop: Spacing.sm },
  resultHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { color: '#fff', fontWeight: FontWeight.bold, fontSize: FontSize.sm },
  resultName: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  resultTrajet: { fontSize: FontSize.sm, color: Colors.textSecondary },
  resultMeta: { fontSize: FontSize.sm, color: Colors.textSecondary },
  resultCta: { fontSize: FontSize.sm, color: BL.accent, fontWeight: FontWeight.bold, marginTop: 2 },
  demoTag: { backgroundColor: Colors.warningBg, borderColor: Colors.warningBorder, borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  demoTagTxt: { fontSize: 9, color: Colors.warning, fontWeight: FontWeight.bold },
  demoLine: { fontSize: FontSize.xs, color: Colors.warning, fontWeight: FontWeight.semibold },

  published: { gap: Spacing.sm, marginTop: Spacing.sm },
  publishedTxt: { fontSize: FontSize.base, fontWeight: FontWeight.extrabold, color: Colors.success },

  desc: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 19 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.sm, marginTop: 4 },
  totalLabel: { fontSize: FontSize.base, fontWeight: FontWeight.extrabold, color: Colors.textPrimary },
  totalValue: { fontSize: FontSize.base, fontWeight: FontWeight.extrabold, color: BL.accent },

  successWrap: { alignItems: 'center', gap: 6, paddingVertical: Spacing.lg },
  successIcon: { fontSize: 40 },
  successTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.extrabold, color: Colors.success },

  assocTitle: { fontSize: FontSize.base, fontWeight: FontWeight.extrabold, color: Colors.textPrimary },
  assocRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: BL.line, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, backgroundColor: BL.card },
  assocRowOn: { borderColor: BL.accent, backgroundColor: BL.accentSoft },
  assocCheck: { fontSize: 18, color: BL.accent },
  assocName: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  assocOk: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.success, textAlign: 'center', marginTop: 4 },

  itemTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  itemMeta: { fontSize: FontSize.sm, color: Colors.textSecondary },
  demandBtns: { flexDirection: 'row', gap: Spacing.sm, marginTop: 6 },
  acceptBtn: { backgroundColor: BL.accent, borderRadius: 8, paddingHorizontal: Spacing.md, paddingVertical: 7 },
  acceptTxt: { color: Colors.textInverse, fontWeight: FontWeight.bold, fontSize: FontSize.sm },
  rejectBtn: { borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: Spacing.md, paddingVertical: 7 },
  rejectTxt: { color: Colors.textSecondary, fontWeight: FontWeight.bold, fontSize: FontSize.sm },
  handledTxt: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, marginTop: 6 },
  accepted: { color: Colors.success },
  rejected: { color: Colors.textTertiary },
});
