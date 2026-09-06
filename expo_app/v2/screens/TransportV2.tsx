// ─────────────────────────────────────────────────────────────────────────────
// TransportV2 — parcours Transport V2 (LOT F5, FRONT-ONLY).
//
//   Hub : 🔎 Je cherche   |   📣 Je propose   (poids égal, aucun rôle actif)
//   Je cherche : contexte concours prérempli → résultats (réels lecture seule +
//                démo si non connecté) → détail → réservation SIMULÉE.
//                Aucun résultat → « Publier ma recherche » (LOCAL v2:transport).
//   Je propose : formulaire prérempli si concours → publication SIMULÉE (locale).
//
// Aucune écriture PROD. Aucun Stripe. Aucune vraie réservation.
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, FontWeight } from '../../constants/theme';
import { Screen, Card, Row, RowGroup, PrimaryButton, GhostButton, Placeholder, EmptyState } from '../ui/kit';
import { useConcours } from '../../hooks/useConcours';
import { useMyChevaux } from '../../hooks/useChevaux';
import { useConcoursLocal } from '../state/concoursLocal';
import { useTransportLocal } from '../state/transportLocal';
import { useV2TransportResults, V2TransportResult } from '../adapters/transport';

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

// ═══════════════════════ HUB (2 portes équivalentes) ═══════════════════════
export function TransportHubV2() {
  const { concoursId, chevalId, face } = useLocalSearchParams<{ concoursId?: string; chevalId?: string; face?: string }>();
  if (face === 'cherche') return <TransportChercheV2 />;
  if (face === 'propose') return <TransportProposeV2 />;

  const { concours } = useConcours(concoursId);
  const q = new URLSearchParams();
  if (concoursId) q.set('concoursId', concoursId);
  if (chevalId) q.set('chevalId', chevalId);
  const base = q.toString() ? `?${q.toString()}` : '';

  return (
    <Screen>
      <TouchableOpacity onPress={() => backTo(concoursId)} hitSlop={8}><Text style={s.back}>← Retour</Text></TouchableOpacity>
      <Text style={s.h1}>🚚 Transport</Text>
      {concours && <Text style={s.sub}>Pour {concours.nom} · {concours.lieu} · {concours.dateLabel}</Text>}

      <TouchableOpacity style={[s.door, s.doorSearch]} activeOpacity={0.9} onPress={() => router.push(`/(v2)/transport${base}${base ? '&' : '?'}face=cherche` as any)}>
        <Text style={s.doorIcon}>🔎</Text>
        <Text style={s.doorTitle}>Je cherche un transport</Text>
        <Text style={s.doorSub}>Trouver une place pour mon cheval</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[s.door, s.doorOffer]} activeOpacity={0.9} onPress={() => router.push(`/(v2)/transport${base}${base ? '&' : '?'}face=propose` as any)}>
        <Text style={s.doorIcon}>📣</Text>
        <Text style={s.doorTitle}>Je propose un transport</Text>
        <Text style={s.doorSub}>Proposer des places dans mon véhicule</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.push('/(v2)/transport/mes-transports' as any)} hitSlop={8}>
        <Text style={s.link}>Mes transports ›</Text>
      </TouchableOpacity>
    </Screen>
  );
}

// ═══════════════════════ JE CHERCHE ═══════════════════════
export function TransportChercheV2() {
  const { concoursId, chevalId } = useLocalSearchParams<{ concoursId?: string; chevalId?: string }>();
  const { concours } = useConcours(concoursId);
  const { chevaux } = useMyChevaux();
  const cl = useConcoursLocal(concoursId);
  const tl = useTransportLocal(concoursId);

  // Prérempli depuis le contexte concours + cheval.
  const [depart, setDepart] = useState('');
  const [destination, setDestination] = useState(concours?.lieu ?? '');
  const [dateAller, setDateAller] = useState(concours?.date_debut ?? '');
  const [dateRetour, setDateRetour] = useState(concours?.date_fin ?? '');
  const [nbChevaux, setNbChevaux] = useState('1');
  const [avecCavalier, setAvecCavalier] = useState(false);
  const [searched, setSearched] = useState(false);
  const [publishedId, setPublishedId] = useState<string | null>(null);
  const cheval = chevalId ? chevaux.find((c) => c.id === chevalId) : (cl.entry.chevalId ? chevaux.find((c) => c.id === cl.entry.chevalId) : undefined);

  const { results, demo } = useV2TransportResults({ concoursId, destination, dateAller });
  // Recherche déjà publiée : rattachée au concours OU publiée pendant cette session.
  const alreadyPublished = !!(tl.context.search || (publishedId && tl.searches.some((x) => x.id === publishedId)));

  const publishSearch = () => {
    const rec = tl.publishSearch({
      concoursId, concoursNom: concours?.nom, chevalId: cheval?.id,
      depart: depart.trim() || '—', destination: destination.trim() || '—',
      dateAller: dateAller || undefined, dateRetour: dateRetour || undefined,
      nbChevaux: parseInt(nbChevaux, 10) || 1, avecCavalier,
    });
    setPublishedId(rec.id);
    // Synchro Mon concours (sans écraser un choix manuel « pas nécessaire »).
    if (concoursId && (cl.entry.needTransport === 'unset' || cl.entry.needTransport === 'searching')) {
      cl.update({ needTransport: 'searching' });
    }
  };

  return (
    <Screen>
      <TouchableOpacity onPress={() => backTo(concoursId)} hitSlop={8}><Text style={s.back}>← Transport</Text></TouchableOpacity>
      <Text style={s.h1}>🔎 Je cherche un transport</Text>

      {concours && (
        <View style={s.ctxCard}>
          <Text style={s.ctxTitle}>Contexte du concours</Text>
          <Text style={s.ctxLine}>🏆 {concours.nom}</Text>
          <Text style={s.ctxLine}>📍 {concours.lieu || '—'}   ·   📅 {concours.dateLabel || '—'}</Text>
          {cheval ? <Text style={s.ctxLine}>🐴 {cheval.nom}</Text> : null}
        </View>
      )}

      <Card>
        <Field label="Lieu de départ"><TextInput style={s.input} value={depart} onChangeText={setDepart} placeholder="Ville / commune" placeholderTextColor={Colors.textTertiary} /></Field>
        <Field label={`Destination${concours ? ' (du concours)' : ''}`}><TextInput style={s.input} value={destination} onChangeText={setDestination} placeholder="Ville d'arrivée" placeholderTextColor={Colors.textTertiary} /></Field>
        <View style={s.rowFields}>
          <Field label="Date aller"><TextInput style={s.input} value={dateAller} onChangeText={setDateAller} placeholder="AAAA-MM-JJ" placeholderTextColor={Colors.textTertiary} /></Field>
          <Field label="Date retour"><TextInput style={s.input} value={dateRetour} onChangeText={setDateRetour} placeholder="optionnel" placeholderTextColor={Colors.textTertiary} /></Field>
        </View>
        <View style={s.rowFields}>
          <Field label="Nombre de chevaux"><TextInput style={s.input} value={nbChevaux} onChangeText={setNbChevaux} keyboardType="number-pad" /></Field>
          <TouchableOpacity style={s.check} onPress={() => setAvecCavalier((v) => !v)}>
            <Text style={s.checkBox}>{avecCavalier ? '☑' : '☐'}</Text>
            <Text style={s.checkTxt}>Je souhaite voyager avec mon cheval</Text>
          </TouchableOpacity>
        </View>
        <PrimaryButton label="Rechercher" onPress={() => setSearched(true)} />
      </Card>

      {searched && (
        results.length > 0 ? (
          <>
            <Text style={s.resultsTitle}>{results.length} transport{results.length > 1 ? 's' : ''} compatible{results.length > 1 ? 's' : ''}{demo ? ' (démonstration)' : ''}</Text>
            {results.map((r) => <ResultCard key={r.id} r={r} concoursId={concoursId} chevalId={cheval?.id} />)}
            {demo && <Placeholder note="résultats de démonstration — connecte-toi pour voir les vraies annonces" v1Path="/(tabs)/services?tab=transport" v1Label="annonces actuelles" />}
          </>
        ) : (
          <Card>
            <EmptyState icon="🚚" title="Aucun transport disponible pour cette recherche" body="Personne ne propose ce trajet pour l'instant. Publie ta recherche : les conducteurs pourront te proposer une place." />
            {alreadyPublished ? (
              <View style={s.published}>
                <Text style={s.publishedTxt}>✅ Recherche publiée</Text>
                <Text style={s.sub}>Les conducteurs vers cette destination pourront te proposer une place.</Text>
                <GhostButton label="Voir / modifier ma recherche" onPress={() => router.push('/(v2)/transport/mes-transports' as any)} />
              </View>
            ) : (
              <PrimaryButton label="📣 Publier ma recherche de transport" onPress={publishSearch} />
            )}
          </Card>
        )
      )}
    </Screen>
  );
}

function ResultCard({ r, concoursId, chevalId }: { r: V2TransportResult; concoursId?: string; chevalId?: string }) {
  const q = new URLSearchParams({ id: r.id, src: r.src });
  if (concoursId) q.set('concoursId', concoursId);
  if (chevalId) q.set('chevalId', chevalId);
  return (
    <TouchableOpacity style={s.result} activeOpacity={0.9} onPress={() => router.push(`/(v2)/transport/detail?${q.toString()}` as any)}>
      <View style={s.resultHead}>
        <View style={[s.avatar, { backgroundColor: r.couleur }]}><Text style={s.avatarTxt}>{r.initiales}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={s.resultName}>{r.conducteur}{r.note ? `  ★ ${r.note}` : ''}</Text>
          <Text style={s.resultTrajet}>{r.depart} → {r.destination}</Text>
        </View>
        {r.src === 'demo' && <View style={s.demoTag}><Text style={s.demoTagTxt}>démo</Text></View>}
      </View>
      <Text style={s.resultMeta}>
        📅 {fmtDate(r.date)}{r.heure ? ` · ${r.heure}` : ''} · {r.allerRetour ? 'aller-retour' : 'aller simple'}
      </Text>
      <Text style={s.resultMeta}>
        {r.places} place{r.places > 1 ? 's' : ''} disponible{r.places > 1 ? 's' : ''} · ~{r.prix} €{r.concoursNom ? ` · 🏆 ${r.concoursNom}` : ''}
      </Text>
      <Text style={s.resultCta}>Voir le détail ›</Text>
    </TouchableOpacity>
  );
}

// ═══════════════════════ DÉTAIL ═══════════════════════
export function TransportDetailV2() {
  const { id, concoursId, chevalId } = useLocalSearchParams<{ id: string; src?: string; concoursId?: string; chevalId?: string }>();
  const { results } = useV2TransportResults({ concoursId });
  const r = useMemo(() => results.find((x) => x.id === id), [results, id]);

  if (!r) return <Screen scroll={false}><View style={s.center}><ActivityIndicator color={Colors.primary} /><Text style={s.sub}>Chargement…</Text></View></Screen>;

  const q = new URLSearchParams({ id: r.id, src: r.src });
  if (concoursId) q.set('concoursId', concoursId);
  if (chevalId) q.set('chevalId', chevalId);

  return (
    <Screen>
      <TouchableOpacity onPress={() => router.back()} hitSlop={8}><Text style={s.back}>← Résultats</Text></TouchableOpacity>
      <Text style={s.h1}>{r.depart} → {r.destination}</Text>
      {r.src === 'demo' && <Text style={s.demoLine}>Trajet de démonstration</Text>}

      <RowGroup>
        <Row icon="👤" label="Conducteur" value={`${r.conducteur}${r.note ? ` · ★ ${r.note}` : ''}`} sub={r.trajets ? `${r.trajets} trajets réalisés` : undefined} />
        <Row icon="🛣" label="Trajet" value={`${r.depart} → ${r.destination}`} />
        <Row icon="📅" label="Quand" value={`${fmtDate(r.date)}${r.heure ? ` · ${r.heure}` : ''}`} sub={r.allerRetour ? 'aller-retour' : 'aller simple'} />
        {r.concoursNom ? <Row icon="🏆" label="Concours" value={r.concoursNom} /> : null}
        <Row icon="💺" label="Places disponibles" value={String(r.places)} />
        <Row icon="💶" label="Prix" value={`~${r.prix} € / place`} />
        <Row icon="🧍" label="Voyager avec son cheval" value={r.peutTransporterCavalier ? 'possible' : 'non proposé'} />
      </RowGroup>

      {r.description ? <Card><Text style={s.desc}>{r.description}</Text></Card> : null}

      <PrimaryButton label="Réserver une place" onPress={() => router.push(`/(v2)/transport/reserver?${q.toString()}` as any)} />
      <Placeholder note="réservation simulée en F5 — aucun paiement, aucune écriture" />
    </Screen>
  );
}

// ═══════════════════════ RÉSERVATION SIMULÉE ═══════════════════════
export function TransportReserverV2() {
  const { id, concoursId, chevalId } = useLocalSearchParams<{ id: string; src?: string; concoursId?: string; chevalId?: string }>();
  const { concours } = useConcours(concoursId);
  const { chevaux } = useMyChevaux();
  const { results, commission } = useV2TransportResults({ concoursId });
  const cl = useConcoursLocal(concoursId);
  const tl = useTransportLocal(concoursId);
  const r = results.find((x) => x.id === id);
  const cheval = chevalId ? chevaux.find((c) => c.id === chevalId) : (cl.entry.chevalId ? chevaux.find((c) => c.id === cl.entry.chevalId) : undefined);
  const [done, setDone] = useState(false);

  if (!r) return <Screen scroll={false}><View style={s.center}><ActivityIndicator color={Colors.primary} /></View></Screen>;

  const totalCommission = Math.round(r.prix * commission);
  const total = r.prix + totalCommission;

  const confirm = () => {
    tl.book({
      src: r.src, refId: r.id, concoursId, concoursNom: concours?.nom, chevalId: cheval?.id,
      trajet: `${r.depart} → ${r.destination}`, date: r.date, heure: r.heure,
      prix: total, conducteur: r.conducteur, places: 1,
    });
    if (concoursId) cl.update({ needTransport: 'done' });
    // Ferme la recherche publiée pour ce concours, le cas échéant.
    const sr = tl.context.search;
    if (sr) tl.updateSearch(sr.id, { status: 'closed' });
    setDone(true);
  };

  if (done) {
    return (
      <Screen>
        <View style={s.successWrap}>
          <Text style={s.successIcon}>✅</Text>
          <Text style={s.successTitle}>Transport réservé</Text>
          <Text style={s.sub}>Réservation simulée — aucun paiement réel n'a été effectué.</Text>
        </View>
        <RowGroup>
          <Row icon="🛣" label="Trajet" value={`${r.depart} → ${r.destination}`} />
          <Row icon="📅" label="Quand" value={fmtDate(r.date)} />
          {concours ? <Row icon="🏆" label="Concours" value={concours.nom} /> : null}
          {cheval ? <Row icon="🐴" label="Cheval" value={cheval.nom} /> : null}
          <Row icon="👤" label="Conducteur" value={r.conducteur} />
          <Row icon="💶" label="Total" value={`${total} €`} />
        </RowGroup>
        <PrimaryButton label={concoursId ? 'Retour à Mon concours' : 'Voir Mes transports'} onPress={() => router.replace((concoursId ? `/(v2)/concours/${concoursId}` : '/(v2)/transport/mes-transports') as any)} />
        <GhostButton label="Accueil" onPress={() => router.replace('/(v2)/accueil' as any)} />
      </Screen>
    );
  }

  return (
    <Screen>
      <TouchableOpacity onPress={() => router.back()} hitSlop={8}><Text style={s.back}>← Détail</Text></TouchableOpacity>
      <Text style={s.h1}>Récapitulatif</Text>

      <RowGroup>
        <Row icon="🛣" label="Trajet" value={`${r.depart} → ${r.destination}`} />
        <Row icon="📅" label="Date" value={`${fmtDate(r.date)}${r.heure ? ` · ${r.heure}` : ''}`} />
        {concours ? <Row icon="🏆" label="Concours" value={concours.nom} /> : null}
        {cheval ? <Row icon="🐴" label="Cheval" value={cheval.nom} /> : <Row icon="🐴" label="Cheval" value="non précisé" />}
        <Row icon="👤" label="Conducteur" value={`${r.conducteur}${r.note ? ` · ★ ${r.note}` : ''}`} />
        <Row icon="💺" label="Places" value="1" />
      </RowGroup>

      <Card>
        <Row label="Prix de la place" value={`${r.prix} €`} />
        <Row label={`Commission plateforme (${Math.round(commission * 100)} %)`} value={`${totalCommission} €`} />
        <View style={s.totalRow}><Text style={s.totalLabel}>Total</Text><Text style={s.totalValue}>{total} €</Text></View>
      </Card>

      <PrimaryButton label="Confirmer la réservation" onPress={confirm} />
      <Placeholder note="F5 : confirmation LOCALE simulée — pas de Stripe, pas de paiement, pas d'écriture PROD" />
    </Screen>
  );
}

// ═══════════════════════ JE PROPOSE ═══════════════════════
export function TransportProposeV2() {
  const { concoursId } = useLocalSearchParams<{ concoursId?: string }>();
  const { concours } = useConcours(concoursId);
  const cl = useConcoursLocal(concoursId);
  const tl = useTransportLocal(concoursId);

  const [depart, setDepart] = useState('');
  const [destination, setDestination] = useState(concours?.lieu ?? '');
  const [date, setDate] = useState(concours?.date_debut ?? '');
  const [heure, setHeure] = useState('');
  const [places, setPlaces] = useState('2');
  const [prix, setPrix] = useState('');
  const [peutCavalier, setPeutCavalier] = useState(false);
  const [description, setDescription] = useState('');
  const [done, setDone] = useState(false);

  const existing = tl.context.offer;

  const publish = () => {
    tl.publishOffer({
      concoursId, concoursNom: concours?.nom,
      depart: depart.trim() || '—', destination: destination.trim() || '—',
      date: date || undefined, heure: heure || undefined,
      places: parseInt(places, 10) || 1, prix: parseInt(prix, 10) || 0,
      peutTransporterCavalier: peutCavalier, description: description.trim() || undefined,
    });
    if (concoursId && cl.entry.needTransport === 'unset') cl.update({ needTransport: 'offering' });
    setDone(true);
  };

  if (done || existing) {
    return (
      <Screen>
        <View style={s.successWrap}>
          <Text style={s.successIcon}>✅</Text>
          <Text style={s.successTitle}>Transport publié</Text>
          <Text style={s.sub}>Annonce enregistrée localement (prototype).</Text>
        </View>
        <RowGroup>
          <Row icon="🛣" label="Trajet" value={`${existing?.depart ?? depart} → ${existing?.destination ?? destination}`} />
          <Row icon="📅" label="Date" value={fmtDate(existing?.date ?? date)} />
          <Row icon="💺" label="Places" value={String(existing?.places ?? places)} />
          <Row icon="💶" label="Prix / place" value={`${existing?.prix ?? prix} €`} />
        </RowGroup>
        <PrimaryButton label="Voir dans Mes transports" onPress={() => router.replace('/(v2)/transport/mes-transports' as any)} />
        <GhostButton label={concoursId ? 'Retour à Mon concours' : 'Retour'} onPress={() => router.replace((concoursId ? `/(v2)/concours/${concoursId}` : '/(v2)/transport') as any)} />
      </Screen>
    );
  }

  return (
    <Screen>
      <TouchableOpacity onPress={() => backTo(concoursId)} hitSlop={8}><Text style={s.back}>← Transport</Text></TouchableOpacity>
      <Text style={s.h1}>📣 Je propose un transport</Text>

      {concours && (
        <View style={s.ctxCard}>
          <Text style={s.ctxTitle}>Rattaché au concours</Text>
          <Text style={s.ctxLine}>🏆 {concours.nom} · 📍 {concours.lieu} · 📅 {concours.dateLabel}</Text>
        </View>
      )}

      <Card>
        <Field label="Lieu de départ"><TextInput style={s.input} value={depart} onChangeText={setDepart} placeholder="Ville / commune" placeholderTextColor={Colors.textTertiary} /></Field>
        <Field label={`Destination${concours ? ' (du concours)' : ''}`}><TextInput style={s.input} value={destination} onChangeText={setDestination} placeholder="Ville d'arrivée" placeholderTextColor={Colors.textTertiary} /></Field>
        <View style={s.rowFields}>
          <Field label="Date"><TextInput style={s.input} value={date} onChangeText={setDate} placeholder="AAAA-MM-JJ" placeholderTextColor={Colors.textTertiary} /></Field>
          <Field label="Heure de départ"><TextInput style={s.input} value={heure} onChangeText={setHeure} placeholder="07:00" placeholderTextColor={Colors.textTertiary} /></Field>
        </View>
        <View style={s.rowFields}>
          <Field label="Places chevaux disponibles"><TextInput style={s.input} value={places} onChangeText={setPlaces} keyboardType="number-pad" /></Field>
          <Field label="Prix / place (€)"><TextInput style={s.input} value={prix} onChangeText={setPrix} keyboardType="number-pad" placeholder="45" placeholderTextColor={Colors.textTertiary} /></Field>
        </View>
        <TouchableOpacity style={s.check} onPress={() => setPeutCavalier((v) => !v)}>
          <Text style={s.checkBox}>{peutCavalier ? '☑' : '☐'}</Text>
          <Text style={s.checkTxt}>Je peux également transporter le cavalier</Text>
        </TouchableOpacity>
        <Field label="Informations utiles"><TextInput style={[s.input, s.multiline]} value={description} onChangeText={setDescription} placeholder="Taille du van, horaires, conditions…" placeholderTextColor={Colors.textTertiary} multiline /></Field>
        <PrimaryButton label="Publier l'annonce" onPress={publish} />
      </Card>
      <Placeholder note="publication LOCALE (v2:transport) — aucune écriture dans les annonces Transport PROD" v1Path="/proposer-transport" v1Label="formulaire actuel (V1)" />
    </Screen>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  back: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.bold, marginBottom: 4 },
  h1: { fontSize: 22, fontWeight: FontWeight.extrabold, color: Colors.textPrimary, letterSpacing: -0.3 },
  sub: { fontSize: FontSize.sm, color: Colors.textSecondary },
  link: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.bold, marginTop: Spacing.md },

  door: { borderRadius: 16, borderWidth: 1, padding: Spacing.lg, gap: 4, marginTop: Spacing.md },
  doorSearch: { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' },
  doorOffer: { backgroundColor: Colors.primaryLight, borderColor: Colors.primaryBorder },
  doorIcon: { fontSize: 22 },
  doorTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.extrabold, color: Colors.textPrimary },
  doorSub: { fontSize: FontSize.sm, color: Colors.textSecondary },

  ctxCard: { backgroundColor: Colors.primaryLight, borderColor: Colors.primaryBorder, borderWidth: 1, borderRadius: 14, padding: Spacing.md, gap: 3, marginTop: Spacing.sm },
  ctxTitle: { fontSize: 11, fontWeight: FontWeight.extrabold, color: Colors.primaryDark, letterSpacing: 0.6, textTransform: 'uppercase' },
  ctxLine: { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: FontWeight.semibold },

  field: { gap: 4, marginTop: Spacing.sm },
  fieldLabel: { fontSize: 11, fontWeight: FontWeight.bold, color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { borderWidth: 1, borderColor: '#ECEBE7', borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 3, fontSize: FontSize.base, color: Colors.textPrimary, backgroundColor: Colors.surface },
  multiline: { minHeight: 64, textAlignVertical: 'top' },
  rowFields: { flexDirection: 'row', gap: Spacing.md },
  check: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: Spacing.sm, flex: 1 },
  checkBox: { fontSize: 18, color: Colors.primary },
  checkTxt: { fontSize: FontSize.sm, color: Colors.textPrimary, flex: 1 },

  resultsTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textSecondary, marginTop: Spacing.md },
  result: { backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: '#ECEBE7', padding: Spacing.md, gap: 4, marginTop: Spacing.sm },
  resultHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { color: '#fff', fontWeight: FontWeight.bold, fontSize: FontSize.sm },
  resultName: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  resultTrajet: { fontSize: FontSize.sm, color: Colors.textSecondary },
  resultMeta: { fontSize: FontSize.sm, color: Colors.textSecondary },
  resultCta: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.bold, marginTop: 2 },
  demoTag: { backgroundColor: Colors.warningBg, borderColor: Colors.warningBorder, borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  demoTagTxt: { fontSize: 9, color: Colors.warning, fontWeight: FontWeight.bold },
  demoLine: { fontSize: FontSize.xs, color: Colors.warning, fontWeight: FontWeight.semibold },

  published: { gap: Spacing.sm, marginTop: Spacing.sm },
  publishedTxt: { fontSize: FontSize.base, fontWeight: FontWeight.extrabold, color: Colors.success },
  rowBtns: { gap: Spacing.sm },

  desc: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 19 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#ECEBE7', paddingTop: Spacing.sm, marginTop: 4 },
  totalLabel: { fontSize: FontSize.base, fontWeight: FontWeight.extrabold, color: Colors.textPrimary },
  totalValue: { fontSize: FontSize.base, fontWeight: FontWeight.extrabold, color: Colors.primaryDark },

  successWrap: { alignItems: 'center', gap: 6, paddingVertical: Spacing.lg },
  successIcon: { fontSize: 40 },
  successTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.extrabold, color: Colors.success },
});
