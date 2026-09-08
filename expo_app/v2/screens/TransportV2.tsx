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
import { BL } from '../ui/blush';
import { Spacing, Radius, FontSize, FontWeight } from '../../constants/theme';
import { Screen, Card, Row, RowGroup, PrimaryButton, GhostButton, Placeholder, EmptyState } from '../ui/kit';
import { useConcours } from '../../hooks/useConcours';
import { useConcoursLocal } from '../state/concoursLocal';
import { useSearchHorses } from '../state/searchHorses';
import { useTransportLocal } from '../state/transportLocal';
import { useV2TransportResults, V2TransportResult } from '../adapters/transport';
import { V2DateField, V2DateRange, todayStart } from '../components/V2DateField';
import { V2DestinationField } from '../components/V2DestinationField';
import { V2AddressAutocomplete } from '../components/V2AddressAutocomplete';
import { DemandeStatusCard } from '../components/DemandeStatusCard';
import { V2HorsePicker } from '../components/V2HorsePicker';
import { useAutoDestination } from '../state/autoDestination';
import {
  RECOMMENDED_PRICE_PER_KM, geocodeFr, buildEstimate, type TransportEstimate,
} from '../lib/transportPricing';

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
  const { concoursId, chevalId, chevalIds, face } = useLocalSearchParams<{ concoursId?: string; chevalId?: string; chevalIds?: string; face?: string }>();
  if (face === 'cherche') return <TransportChercheV2 />;
  if (face === 'propose') return <TransportProposeV2 />;

  const { concours } = useConcours(concoursId);
  const q = new URLSearchParams();
  if (concoursId) q.set('concoursId', concoursId);
  if (chevalIds) q.set('chevalIds', chevalIds);
  else if (chevalId) q.set('chevalId', chevalId);
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
  const { concoursId, concoursNom, chevalIds } = useLocalSearchParams<{ concoursId?: string; chevalIds?: string; concoursNom?: string }>();
  const { concours } = useConcours(concoursId);
  const cl = useConcoursLocal(concoursId);
  const tl = useTransportLocal(concoursId);
  // Chevaux concernés par CETTE recherche (seed = hub / Préparer, modifiable ici).
  const ch = useSearchHorses(concoursId, 'transport', chevalIds);

  // Prérempli depuis le contexte concours + cheval.
  const [depart, setDepart] = useState('');
  const dest = useAutoDestination(concoursId, concours);
  const [dateAller, setDateAller] = useState(concours?.date_debut ?? '');
  const [dateRetour, setDateRetour] = useState(concours?.date_fin ?? '');
  const [avecCavalier, setAvecCavalier] = useState(false);
  const [searched, setSearched] = useState(false);
  const [publishedId, setPublishedId] = useState<string | null>(null);

  const { results, demo } = useV2TransportResults({ concoursId, destination: dest.value, dateAller });
  // Recherche déjà publiée : rattachée au concours OU publiée pendant cette session.
  const alreadyPublished = !!(tl.context.search || (publishedId && tl.searches.some((x) => x.id === publishedId)));

  const publishSearch = () => {
    ch.persist();
    const rec = tl.publishSearch({
      concoursId, concoursNom: concours?.nom, chevalId: ch.primaryId,
      depart: depart.trim() || '—', destination: dest.value.trim() || '—',
      dateAller: dateAller || undefined, dateRetour: dateRetour || undefined,
      nbChevaux: ch.count || 1, avecCavalier,
    });
    setPublishedId(rec.id);
    // Synchro Mon concours (sans écraser un choix manuel « pas nécessaire »).
    if (concoursId && (cl.entry.needTransport === 'unset' || cl.entry.needTransport === 'searching')) {
      cl.update({ needTransport: 'searching' });
    }
  };

  const runSearch = () => { ch.persist(); setSearched(true); };

  return (
    <Screen>
      <TouchableOpacity onPress={() => backTo(concoursId)} hitSlop={8}><Text style={s.back}>← Transport</Text></TouchableOpacity>
      <Text style={s.h1}>🔎 Je cherche un transport</Text>

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
        <Field label="Lieu de départ"><V2AddressAutocomplete value={depart} onChangeText={setDepart} kind="city" placeholder="Ville / commune" /></Field>
        <V2DestinationField label="Destination" auto={dest} placeholder="Ville d'arrivée" concoursNom={!concours ? concoursNom : undefined} />
        <V2DateRange
          startLabel="Date aller" endLabel="Date retour"
          start={dateAller} end={dateRetour}
          onChangeStart={setDateAller} onChangeEnd={setDateRetour}
          endOptional minDate={todayStart()}
        />
        <TouchableOpacity style={s.check} onPress={() => setAvecCavalier((v) => !v)}>
          <Text style={s.checkBox}>{avecCavalier ? '☑' : '☐'}</Text>
          <Text style={s.checkTxt}>Je souhaite voyager avec mon cheval</Text>
        </TouchableOpacity>
        <PrimaryButton label="Rechercher" onPress={runSearch} />
      </Card>

      {searched && (
        results.length > 0 ? (
          <>
            <Text style={s.resultsTitle}>{results.length} transport{results.length > 1 ? 's' : ''} compatible{results.length > 1 ? 's' : ''}{demo ? ' (démonstration)' : ''}</Text>
            {results.map((r) => <ResultCard key={r.id} r={r} concoursId={concoursId} chevalIds={ch.param} />)}
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

function ResultCard({ r, concoursId, chevalIds }: { r: V2TransportResult; concoursId?: string; chevalIds?: string }) {
  const q = new URLSearchParams({ id: r.id, src: r.src });
  if (concoursId) q.set('concoursId', concoursId);
  if (chevalIds) q.set('chevalIds', chevalIds);
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
        {r.places} place{r.places > 1 ? 's' : ''} disponible{r.places > 1 ? 's' : ''} · {r.pricePerKm && r.pricePerKm > 0 ? `${r.pricePerKm.toFixed(2)} €/km` : `~${r.prix} €`}{r.concoursNom ? ` · 🏆 ${r.concoursNom}` : ''}
      </Text>
      <Text style={s.resultCta}>Voir le détail ›</Text>
    </TouchableOpacity>
  );
}

// ═══════════════════════ DÉTAIL ═══════════════════════
export function TransportDetailV2() {
  const { id, concoursId, chevalIds } = useLocalSearchParams<{ id: string; src?: string; concoursId?: string; chevalIds?: string }>();
  const { results } = useV2TransportResults({ concoursId });
  const r = useMemo(() => results.find((x) => x.id === id), [results, id]);

  if (!r) return <Screen scroll={false}><View style={s.center}><ActivityIndicator color={BL.accent} /><Text style={s.sub}>Chargement…</Text></View></Screen>;

  const q = new URLSearchParams({ id: r.id, src: r.src });
  if (concoursId) q.set('concoursId', concoursId);
  if (chevalIds) q.set('chevalIds', chevalIds);

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
        {r.pricePerKm && r.pricePerKm > 0
          ? <Row icon="🛣" label="Tarif au km" value={`${r.pricePerKm.toFixed(2)} €/km`} sub="prix final calculé selon ton adresse (logique V1)" />
          : <Row icon="💶" label="Prix" value={`~${r.prix} € / place`} />}
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
  const { id, concoursId, chevalIds } = useLocalSearchParams<{ id: string; src?: string; concoursId?: string; chevalIds?: string }>();
  const { concours } = useConcours(concoursId);
  const { results, commission } = useV2TransportResults({ concoursId });
  const cl = useConcoursLocal(concoursId);
  const tl = useTransportLocal(concoursId);
  const ch = useSearchHorses(concoursId, 'transport', chevalIds);
  const r = results.find((x) => x.id === id);
  const [done, setDone] = useState(false);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  // ── Logique tarif au km (reprise V1) ──────────────────────────────────────
  // V1 : le cavalier saisit son adresse de prise en charge → l'Edge calcule
  // distance(transporteur → cavalier → concours) × price_per_km. Ici : même
  // formule, distance ESTIMÉE côté front (Phase 2 = trajet routier exact).
  const [pickup, setPickup] = useState('');
  const [estimate, setEstimate] = useState<TransportEstimate | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [estimateErr, setEstimateErr] = useState<string | null>(null);
  const kmMode = !!(r && r.pricePerKm && r.pricePerKm > 0);

  if (!r) return <Screen scroll={false}><View style={s.center}><ActivityIndicator color={BL.accent} /></View></Screen>;

  const runEstimate = async () => {
    if (!r.pricePerKm || !pickup.trim()) { setEstimateErr('Saisis ton adresse de prise en charge.'); return; }
    setEstimating(true); setEstimateErr(null); setEstimate(null);
    try {
      const [a, p, b] = await Promise.all([
        geocodeFr(r.depart), geocodeFr(pickup), geocodeFr(r.destination),
      ]);
      if (!a || !p || !b) { setEstimateErr('Adresse introuvable — vérifie ta saisie.'); setEstimating(false); return; }
      setEstimate(buildEstimate({
        depart: { ...a, label: r.depart },
        pickup: { ...p, label: pickup.trim() },
        concours: { ...b, label: r.destination },
        pricePerKm: r.pricePerKm, nbPlaces: 1, allerRetour: r.allerRetour,
      }));
    } catch {
      setEstimateErr('Estimation impossible pour le moment.');
    }
    setEstimating(false);
  };

  // Sous-total = estimation km si calculée, sinon prix forfaitaire de l'annonce.
  const sousTotal = kmMode && estimate ? estimate.price : r.prix;
  const totalCommission = Math.round(sousTotal * commission);
  const total = Math.round((sousTotal + totalCommission) * 100) / 100;

  const confirm = () => {
    ch.persist();
    const rec = tl.book({
      src: r.src, refId: r.id, concoursId, concoursNom: concours?.nom, chevalId: ch.primaryId,
      trajet: `${r.depart} → ${r.destination}`, date: r.date, heure: r.heure,
      prix: total, conducteur: r.conducteur, places: 1,
      status: 'pending',
    });
    setBookingId(rec.id);
    // Demande envoyée : le module reste « ⏳ En attente » tant que le
    // transporteur n'a pas validé (+ paiement). Pas « Organisé ».
    if (concoursId && cl.entry.needTransport !== 'done') cl.update({ needTransport: 'pending' });
    // Ferme la recherche publiée pour ce concours, le cas échéant.
    const sr = tl.context.search;
    if (sr) tl.updateSearch(sr.id, { status: 'closed' });
    setDone(true);
  };

  const simulateConfirm = () => {
    if (bookingId) tl.updateBooking(bookingId, { status: 'confirmed' });
    if (concoursId) cl.update({ needTransport: 'done' });
    setConfirmed(true);
  };

  if (done) {
    return (
      <Screen>
        <View style={s.successWrap}>
          <Text style={s.successIcon}>{confirmed ? '✅' : '⏳'}</Text>
          <Text style={s.successTitle}>{confirmed ? 'Transport confirmé' : 'Demande envoyée'}</Text>
          <Text style={s.sub}>Réservation simulée — aucun paiement réel n'a été effectué.</Text>
        </View>
        <DemandeStatusCard vendorLabel="transporteur" confirmed={confirmed} onSimulate={simulateConfirm} />
        <RowGroup>
          <Row icon="🛣" label="Trajet" value={`${r.depart} → ${r.destination}`} />
          <Row icon="📅" label="Quand" value={fmtDate(r.date)} />
          {concours ? <Row icon="🏆" label="Concours" value={concours.nom} /> : null}
          {ch.count > 0 ? <Row icon="🐴" label={ch.count > 1 ? 'Chevaux' : 'Cheval'} value={ch.names.join(', ')} /> : null}
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
        {ch.count > 0
          ? <Row icon="🐴" label={ch.count > 1 ? 'Chevaux' : 'Cheval'} value={ch.names.join(', ')} sub={ch.count > 1 ? `${ch.count} chevaux concernés` : undefined} />
          : <Row icon="🐴" label="Cheval" value="non précisé" sub="défini dans « Préparer mon concours »" />}
        <Row icon="👤" label="Conducteur" value={`${r.conducteur}${r.note ? ` · ★ ${r.note}` : ''}`} />
        <Row icon="💺" label="Places" value="1" />
        {kmMode ? <Row icon="🛣" label="Tarif au km" value={`${r.pricePerKm!.toFixed(2)} €/km`} /> : null}
      </RowGroup>

      {kmMode && (
        <Card>
          <Text style={s.fieldLabel}>Ton adresse de prise en charge</Text>
          <V2AddressAutocomplete
            value={pickup} onChangeText={setPickup} kind="address"
            placeholder="Ville / adresse de départ du cheval"
          />
          <Text style={s.sub}>
            Prix calculé sur la distance totale : {r.depart} → toi → {r.destination} · {r.pricePerKm!.toFixed(2)} €/km (logique V1).
          </Text>
          <GhostButton label={estimating ? 'Calcul…' : 'Estimer mon prix'} onPress={runEstimate} />
          {estimateErr ? <Text style={s.demoLine}>{estimateErr}</Text> : null}
          {estimate ? (
            <View style={{ marginTop: Spacing.sm }}>
              {estimate.legs.map((l, i) => <Row key={i} label={`${l.from} → ${l.to}`} value={`${l.km} km`} />)}
              <Row label={`Distance totale estimée${estimate.allerRetour ? ' (aller-retour)' : ''}`} value={`${estimate.distanceKm} km`} />
              <Row label="Sous-total transport" value={`${estimate.price} €`} />
            </View>
          ) : null}
          <Text style={s.simTag}>
            Estimation front (distance à vol d'oiseau × 1,3). Le trajet routier exact est calculé à la réservation réelle — Phase 2.
          </Text>
        </Card>
      )}

      <Card>
        <Row label={kmMode ? `Sous-total transport${estimate ? ' (estimé)' : ''}` : 'Prix de la place'} value={`${sousTotal} €`} />
        <Row label={`Commission plateforme (${Math.round(commission * 100)} %)`} value={`${totalCommission} €`} />
        <View style={s.totalRow}><Text style={s.totalLabel}>Total</Text><Text style={s.totalValue}>{total} €</Text></View>
      </Card>

      <PrimaryButton
        label={kmMode && !estimate ? 'Estime ton prix pour continuer' : 'Confirmer la réservation'}
        onPress={confirm}
        disabled={kmMode && !estimate}
      />
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
  const dest = useAutoDestination(concoursId, concours);
  const [date, setDate] = useState(concours?.date_debut ?? '');
  const [heure, setHeure] = useState('');
  const [places, setPlaces] = useState('2');
  const [pxKm, setPxKm] = useState(String(RECOMMENDED_PRICE_PER_KM)); // logique V1 : tarif au km
  const [peutCavalier, setPeutCavalier] = useState(false);
  const [description, setDescription] = useState('');
  const [done, setDone] = useState(false);

  // Estimation indicative « départ → concours » (hors détour prise en charge).
  const [estimate, setEstimate] = useState<TransportEstimate | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [estimateErr, setEstimateErr] = useState<string | null>(null);
  const pricePerKm = parseFloat(pxKm.replace(',', '.')) || RECOMMENDED_PRICE_PER_KM;

  const runEstimate = async () => {
    if (!depart.trim() || !dest.value.trim()) { setEstimateErr('Renseigne le départ et la destination.'); return; }
    setEstimating(true); setEstimateErr(null); setEstimate(null);
    try {
      const [a, b] = await Promise.all([geocodeFr(depart), geocodeFr(dest.value)]);
      if (!a || !b) { setEstimateErr('Adresse introuvable — vérifie ta saisie.'); setEstimating(false); return; }
      setEstimate(buildEstimate({
        depart: { ...a, label: depart.trim() },
        concours: { ...b, label: dest.value.trim() },
        pricePerKm, nbPlaces: 1, allerRetour: false,
      }));
    } catch {
      setEstimateErr('Estimation impossible pour le moment.');
    }
    setEstimating(false);
  };

  const existing = tl.context.offer;

  const publish = () => {
    tl.publishOffer({
      concoursId, concoursNom: concours?.nom,
      depart: depart.trim() || '—', destination: dest.value.trim() || '—',
      date: date || undefined, heure: heure || undefined,
      places: parseInt(places, 10) || 1,
      prix: estimate?.price ?? 0,
      pricePerKm,
      estimKm: estimate?.distanceKm,
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
          <Row icon="🛣" label="Trajet" value={`${existing?.depart ?? depart} → ${existing?.destination ?? dest.value}`} />
          <Row icon="📅" label="Date" value={fmtDate(existing?.date ?? date)} />
          <Row icon="💺" label="Places" value={String(existing?.places ?? places)} />
          <Row icon="🛣" label="Tarif au km" value={`${(existing?.pricePerKm ?? pricePerKm).toFixed(2)} €/km`} />
          {(existing?.estimKm ?? estimate?.distanceKm) != null
            ? <Row icon="💶" label="Sous-total estimé" value={`~${existing?.prix ?? estimate?.price} € (${existing?.estimKm ?? estimate?.distanceKm} km)`} />
            : null}
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
        <Field label="Lieu de départ"><V2AddressAutocomplete value={depart} onChangeText={setDepart} kind="city" placeholder="Ville / commune" /></Field>
        <V2DestinationField label="Destination" auto={dest} placeholder="Ville d'arrivée" />
        <View style={s.rowFields}>
          <V2DateField label="Date" value={date} onChange={setDate} minDate={todayStart()} style={s.flex1} />
          <Field label="Heure de départ"><TextInput style={s.input} value={heure} onChangeText={setHeure} placeholder="07:00" placeholderTextColor={Colors.textTertiary} /></Field>
        </View>
        <View style={s.rowFields}>
          <Field label="Places chevaux disponibles"><TextInput style={s.input} value={places} onChangeText={setPlaces} keyboardType="number-pad" /></Field>
          <Field label="Prix au kilomètre (€/km)"><TextInput style={s.input} value={pxKm} onChangeText={setPxKm} keyboardType="decimal-pad" placeholder="0.8" placeholderTextColor={Colors.textTertiary} /></Field>
        </View>
        <Text style={s.sub}>Logique V1 : distance totale (départ → cavalier → concours) × ce tarif. Recommandé : 0,8 €/km.</Text>
        <GhostButton label={estimating ? 'Calcul…' : 'Estimer le prix vers le concours'} onPress={runEstimate} />
        {estimateErr ? <Text style={s.demoLine}>{estimateErr}</Text> : null}
        {estimate ? (
          <View style={s.estimBox}>
            <Row label={`${estimate.legs[0].from} → ${estimate.legs[0].to}`} value={`~${estimate.distanceKm} km`} />
            <Row label="Prix indicatif (1 cheval)" value={`~${estimate.price} €`} />
            <Text style={s.simTag}>Indicatif, hors détour de prise en charge d'un cavalier. Distance à vol d'oiseau × 1,3 — trajet routier exact à la réservation (Phase 2).</Text>
          </View>
        ) : null}
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
  back: { fontSize: FontSize.sm, color: BL.accent, fontWeight: FontWeight.bold, marginBottom: 4 },
  h1: { fontSize: 22, fontWeight: FontWeight.extrabold, color: Colors.textPrimary, letterSpacing: -0.3 },
  sub: { fontSize: FontSize.sm, color: Colors.textSecondary },
  link: { fontSize: FontSize.sm, color: BL.accent, fontWeight: FontWeight.bold, marginTop: Spacing.md },

  door: { borderRadius: 16, borderWidth: 1, padding: Spacing.lg, gap: 4, marginTop: Spacing.md },
  doorSearch: { backgroundColor: Colors.infoBg, borderColor: Colors.infoBorder },
  doorOffer: { backgroundColor: BL.accentSoft, borderColor: BL.accentLine },
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
  rowFields: { flexDirection: 'row', gap: Spacing.md },
  flex1: { flex: 1 },
  check: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: Spacing.sm, flex: 1 },
  checkBox: { fontSize: 18, color: BL.accent },
  checkTxt: { fontSize: FontSize.sm, color: Colors.textPrimary, flex: 1 },

  resultsTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textSecondary, marginTop: Spacing.md },
  result: { backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, gap: 4, marginTop: Spacing.sm },
  resultHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { color: '#fff', fontWeight: FontWeight.bold, fontSize: FontSize.sm },
  resultName: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  resultTrajet: { fontSize: FontSize.sm, color: Colors.textSecondary },
  resultMeta: { fontSize: FontSize.sm, color: Colors.textSecondary },
  resultCta: { fontSize: FontSize.sm, color: BL.accent, fontWeight: FontWeight.bold, marginTop: 2 },
  simTag: { fontSize: FontSize.xs, color: Colors.warning, fontStyle: 'italic', marginTop: 4, lineHeight: 16 },
  estimBox: { marginTop: Spacing.sm, gap: 2, backgroundColor: Colors.infoBg, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.infoBorder, padding: Spacing.sm },
  demoTag: { backgroundColor: Colors.warningBg, borderColor: Colors.warningBorder, borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  demoTagTxt: { fontSize: 9, color: Colors.warning, fontWeight: FontWeight.bold },
  demoLine: { fontSize: FontSize.xs, color: Colors.warning, fontWeight: FontWeight.semibold },

  published: { gap: Spacing.sm, marginTop: Spacing.sm },
  publishedTxt: { fontSize: FontSize.base, fontWeight: FontWeight.extrabold, color: Colors.success },
  rowBtns: { gap: Spacing.sm },

  desc: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 19 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.sm, marginTop: 4 },
  totalLabel: { fontSize: FontSize.base, fontWeight: FontWeight.extrabold, color: Colors.textPrimary },
  totalValue: { fontSize: FontSize.base, fontWeight: FontWeight.extrabold, color: BL.accent },

  successWrap: { alignItems: 'center', gap: 6, paddingVertical: Spacing.lg },
  successIcon: { fontSize: 40 },
  successTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.extrabold, color: Colors.success },
});
