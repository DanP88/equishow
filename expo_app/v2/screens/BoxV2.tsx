// ─────────────────────────────────────────────────────────────────────────────
// BoxV2 — parcours Box V2 (LOT F6, FRONT-ONLY).
//
//   Hub : 🔎 Je cherche   |   📣 Je propose   (poids égal, aucun rôle actif)
//   Je cherche : contexte concours prérempli → résultats (réels lecture seule +
//                démo si non connecté) → détail → réservation SIMULÉE.
//                Aucun résultat → « Publier ma recherche » (LOCAL v2:box).
//   Je propose : formulaire prérempli si concours → publication SIMULÉE (locale).
//
// Aucune écriture PROD. Aucun Stripe. Aucune vraie réservation.
// Miroir strict de v2/screens/TransportV2 (F5).
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, FontWeight } from '../../constants/theme';
import { Screen, Card, Row, RowGroup, PrimaryButton, GhostButton, Placeholder, EmptyState } from '../ui/kit';
import { useConcours } from '../../hooks/useConcours';
import { useSearchHorses } from '../state/searchHorses';
import { useConcoursLocal } from '../state/concoursLocal';
import { useBoxLocal } from '../state/boxLocal';
import { useV2BoxResults, nightsBetween, V2BoxResult } from '../adapters/box';
import { V2DateRange, todayStart } from '../components/V2DateField';
import { V2DestinationField } from '../components/V2DestinationField';
import { V2HorsePicker } from '../components/V2HorsePicker';
import { useAutoDestination } from '../state/autoDestination';

// ── helpers ────────────────────────────────────────────────────────────────
function fmtDate(d?: string) {
  if (!d) return '—';
  const dt = new Date(d.length >= 10 ? d : `${d}T00:00:00`);
  return isNaN(dt.getTime()) ? d : dt.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}
function fmtPeriode(a?: string, b?: string) {
  if (!a && !b) return '—';
  return `${fmtDate(a)} → ${fmtDate(b)}`;
}
function backTo(concoursId?: string) {
  if (router.canGoBack()) router.back();
  else router.replace((concoursId ? `/(v2)/concours/${concoursId}` : '/(v2)/accueil') as any);
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <View style={s.field}><Text style={s.fieldLabel}>{label}</Text>{children}</View>;
}

// ═══════════════════════ HUB (2 portes équivalentes) ═══════════════════════
export function BoxHubV2() {
  const { concoursId, chevalId, chevalIds, face } = useLocalSearchParams<{ concoursId?: string; chevalId?: string; chevalIds?: string; face?: string }>();
  if (face === 'cherche') return <BoxChercheV2 />;
  if (face === 'propose') return <BoxProposeV2 />;

  const { concours } = useConcours(concoursId);
  const q = new URLSearchParams();
  if (concoursId) q.set('concoursId', concoursId);
  if (chevalIds) q.set('chevalIds', chevalIds);
  else if (chevalId) q.set('chevalId', chevalId);
  const base = q.toString() ? `?${q.toString()}` : '';

  return (
    <Screen>
      <TouchableOpacity onPress={() => backTo(concoursId)} hitSlop={8}><Text style={s.back}>← Retour</Text></TouchableOpacity>
      <Text style={s.h1}>🏠 Box</Text>
      {concours && <Text style={s.sub}>Pour {concours.nom} · {concours.lieu} · {concours.dateLabel}</Text>}

      <TouchableOpacity style={[s.door, s.doorSearch]} activeOpacity={0.9} onPress={() => router.push(`/(v2)/box${base}${base ? '&' : '?'}face=cherche` as any)}>
        <Text style={s.doorIcon}>🔎</Text>
        <Text style={s.doorTitle}>Je cherche un box</Text>
        <Text style={s.doorSub}>Loger mon cheval sur ou près du concours</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[s.door, s.doorOffer]} activeOpacity={0.9} onPress={() => router.push(`/(v2)/box${base}${base ? '&' : '?'}face=propose` as any)}>
        <Text style={s.doorIcon}>📣</Text>
        <Text style={s.doorTitle}>Je propose un box</Text>
        <Text style={s.doorSub}>Louer un box libre dans mon écurie</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.push('/(v2)/box/mes-box' as any)} hitSlop={8}>
        <Text style={s.link}>Mes box ›</Text>
      </TouchableOpacity>
    </Screen>
  );
}

// ═══════════════════════ JE CHERCHE ═══════════════════════
export function BoxChercheV2() {
  const { concoursId, concoursNom, chevalIds } = useLocalSearchParams<{ concoursId?: string; chevalIds?: string; concoursNom?: string }>();
  const { concours } = useConcours(concoursId);
  const cl = useConcoursLocal(concoursId);
  const bl = useBoxLocal(concoursId);
  // Chevaux concernés par CETTE recherche (seed = hub / Préparer, modifiable ici).
  const ch = useSearchHorses(concoursId, 'box', chevalIds);

  // Prérempli depuis le contexte concours + cheval.
  const dest = useAutoDestination(concoursId, concours);
  const [dateDebut, setDateDebut] = useState(concours?.date_debut ?? '');
  const [dateFin, setDateFin] = useState(concours?.date_fin ?? '');
  const nbBox = ch.count || 1;
  const [litiere, setLitiere] = useState(true);
  const [searched, setSearched] = useState(false);
  const [publishedId, setPublishedId] = useState<string | null>(null);

  const { results, demo } = useV2BoxResults({ concoursId, lieu: dest.value, dateDebut, dateFin });
  const alreadyPublished = !!(bl.context.search || (publishedId && bl.searches.some((x) => x.id === publishedId)));

  const publishSearch = () => {
    ch.persist();
    const rec = bl.publishSearch({
      concoursId, concoursNom: concours?.nom, chevalId: ch.primaryId,
      lieu: dest.value.trim() || '—',
      dateDebut: dateDebut || undefined, dateFin: dateFin || undefined,
      nbBox, litiereIncluse: litiere,
    });
    setPublishedId(rec.id);
    if (concoursId && (cl.entry.needBox === 'unset' || cl.entry.needBox === 'searching')) {
      cl.update({ needBox: 'searching' });
    }
  };

  const runSearch = () => { ch.persist(); setSearched(true); };

  return (
    <Screen>
      <TouchableOpacity onPress={() => backTo(concoursId)} hitSlop={8}><Text style={s.back}>← Box</Text></TouchableOpacity>
      <Text style={s.h1}>🔎 Je cherche un box</Text>

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
        {ch.hasSelection && <Text style={s.forHorses}>{ch.count > 1 ? `${ch.count} box` : '1 box'} · {ch.label}</Text>}
        <V2DestinationField label="Secteur recherché" auto={dest} placeholder="Ville / commune" concoursNom={!concours ? concoursNom : undefined} />
        <V2DateRange
          startLabel="Arrivée" endLabel="Départ"
          start={dateDebut} end={dateFin}
          onChangeStart={setDateDebut} onChangeEnd={setDateFin}
          minDate={todayStart()}
        />
        <TouchableOpacity style={s.check} onPress={() => setLitiere((v) => !v)}>
          <Text style={s.checkBox}>{litiere ? '☑' : '☐'}</Text>
          <Text style={s.checkTxt}>Litière incluse souhaitée</Text>
        </TouchableOpacity>
        <PrimaryButton label="Rechercher" onPress={runSearch} />
      </Card>

      {searched && (
        results.length > 0 ? (
          <>
            <Text style={s.resultsTitle}>{results.length} box compatible{results.length > 1 ? 's' : ''}{demo ? ' (démonstration)' : ''}</Text>
            {results.map((r) => <ResultCard key={r.id} r={r} concoursId={concoursId} chevalIds={ch.param} dateDebut={dateDebut} dateFin={dateFin} />)}
            {demo && <Placeholder note="résultats de démonstration — connecte-toi pour voir les vraies annonces" v1Path="/(tabs)/services?tab=box" v1Label="annonces actuelles" />}
          </>
        ) : (
          <Card>
            <EmptyState icon="🏠" title="Aucun box disponible pour cette recherche" body="Personne ne propose de box ici pour l'instant. Publie ta recherche : les écuries du secteur pourront te répondre." />
            {alreadyPublished ? (
              <View style={s.published}>
                <Text style={s.publishedTxt}>✅ Recherche publiée</Text>
                <Text style={s.sub}>Les écuries proches de cette destination pourront te proposer un box.</Text>
                <GhostButton label="Voir / modifier ma recherche" onPress={() => router.push('/(v2)/box/mes-box' as any)} />
              </View>
            ) : (
              <PrimaryButton label="📣 Publier ma recherche de box" onPress={publishSearch} />
            )}
          </Card>
        )
      )}
    </Screen>
  );
}

function ResultCard({ r, concoursId, chevalIds, dateDebut, dateFin }: { r: V2BoxResult; concoursId?: string; chevalIds?: string; dateDebut?: string; dateFin?: string }) {
  const q = new URLSearchParams({ id: r.id, src: r.src });
  if (concoursId) q.set('concoursId', concoursId);
  if (chevalIds) q.set('chevalIds', chevalIds);
  if (dateDebut) q.set('d1', dateDebut);
  if (dateFin) q.set('d2', dateFin);
  return (
    <TouchableOpacity style={s.result} activeOpacity={0.9} onPress={() => router.push(`/(v2)/box/detail?${q.toString()}` as any)}>
      <View style={s.resultHead}>
        <View style={[s.avatar, { backgroundColor: r.couleur }]}><Text style={s.avatarTxt}>{r.initiales}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={s.resultName}>{r.hote}{r.note ? `  ★ ${r.note}` : ''}</Text>
          <Text style={s.resultTrajet}>📍 {r.lieu}{r.distanceKm != null ? ` · ${r.distanceKm} km du concours` : ''}</Text>
        </View>
        {r.src === 'demo' && <View style={s.demoTag}><Text style={s.demoTagTxt}>démo</Text></View>}
      </View>
      <Text style={s.resultMeta}>
        📅 {fmtPeriode(r.dateDebut, r.dateFin)} · {r.nbBox} box dispo
      </Text>
      <Text style={s.resultMeta}>
        {r.prixNuit} € / nuit · {r.litiereIncluse ? 'litière incluse' : 'litière en sus'}{r.concoursNom ? ` · 🏆 ${r.concoursNom}` : ''}
      </Text>
      <Text style={s.resultCta}>Voir le détail ›</Text>
    </TouchableOpacity>
  );
}

// ═══════════════════════ DÉTAIL ═══════════════════════
export function BoxDetailV2() {
  const { id, concoursId, chevalIds, d1, d2 } = useLocalSearchParams<{ id: string; src?: string; concoursId?: string; chevalIds?: string; d1?: string; d2?: string }>();
  const { results } = useV2BoxResults({ concoursId });
  const r = useMemo(() => results.find((x) => x.id === id), [results, id]);

  if (!r) return <Screen scroll={false}><View style={s.center}><ActivityIndicator color={Colors.primary} /><Text style={s.sub}>Chargement…</Text></View></Screen>;

  const q = new URLSearchParams({ id: r.id, src: r.src });
  if (concoursId) q.set('concoursId', concoursId);
  if (chevalIds) q.set('chevalIds', chevalIds);
  if (d1) q.set('d1', d1);
  if (d2) q.set('d2', d2);

  return (
    <Screen>
      <TouchableOpacity onPress={() => router.back()} hitSlop={8}><Text style={s.back}>← Résultats</Text></TouchableOpacity>
      <Text style={s.h1}>{r.hote}</Text>
      {r.src === 'demo' && <Text style={s.demoLine}>Annonce de démonstration</Text>}

      <RowGroup>
        <Row icon="🏡" label="Hôte" value={`${r.hote}${r.note ? ` · ★ ${r.note}` : ''}`} />
        <Row icon="📍" label="Lieu" value={r.lieu} sub={r.distanceKm != null ? `${r.distanceKm} km du site du concours` : undefined} />
        <Row icon="📅" label="Période" value={fmtPeriode(r.dateDebut, r.dateFin)} />
        {r.concoursNom ? <Row icon="🏆" label="Concours" value={r.concoursNom} /> : null}
        <Row icon="🚪" label="Box disponibles" value={String(r.nbBox)} />
        <Row icon="💶" label="Prix" value={`${r.prixNuit} € / box / nuit`} />
        <Row icon="🌾" label="Litière" value={r.litiereIncluse ? 'incluse' : 'non incluse'} />
        {r.equipements ? <Row icon="🧰" label="Équipements" value={r.equipements} /> : null}
      </RowGroup>

      {r.description ? <Card><Text style={s.desc}>{r.description}</Text></Card> : null}

      <PrimaryButton label="Réserver ce box" onPress={() => router.push(`/(v2)/box/reserver?${q.toString()}` as any)} />
      <Placeholder note="réservation simulée en F6 — aucun paiement, aucune écriture" />
    </Screen>
  );
}

// ═══════════════════════ RÉSERVATION SIMULÉE ═══════════════════════
export function BoxReserverV2() {
  const { id, concoursId, chevalIds, d1, d2 } = useLocalSearchParams<{ id: string; src?: string; concoursId?: string; chevalIds?: string; d1?: string; d2?: string }>();
  const { concours } = useConcours(concoursId);
  const { results, commission } = useV2BoxResults({ concoursId });
  const cl = useConcoursLocal(concoursId);
  const bl = useBoxLocal(concoursId);
  const ch = useSearchHorses(concoursId, 'box', chevalIds);
  const r = results.find((x) => x.id === id);
  const [done, setDone] = useState(false);

  if (!r) return <Screen scroll={false}><View style={s.center}><ActivityIndicator color={Colors.primary} /></View></Screen>;

  // Période demandée : dates de recherche sinon dates de l'annonce.
  const pDebut = d1 || (r.dateDebut ? r.dateDebut.slice(0, 10) : concours?.date_debut ?? undefined);
  const pFin = d2 || (r.dateFin ? r.dateFin.slice(0, 10) : concours?.date_fin ?? undefined);
  const nuits = nightsBetween(pDebut, pFin);
  const sousTotal = r.prixNuit * nuits;
  const totalCommission = Math.round(sousTotal * commission);
  const total = sousTotal + totalCommission;

  const confirm = () => {
    ch.persist();
    bl.book({
      src: r.src, refId: r.id, concoursId, concoursNom: concours?.nom, chevalId: ch.primaryId,
      lieu: `${r.hote} · ${r.lieu}`, dateDebut: pDebut, dateFin: pFin,
      nbNuits: nuits, nbBox: Math.max(1, ch.count), prixNuit: r.prixNuit, prix: total, hote: r.hote,
    });
    if (concoursId) cl.update({ needBox: 'done' });
    const sr = bl.context.search;
    if (sr) bl.updateSearch(sr.id, { status: 'closed' });
    setDone(true);
  };

  if (done) {
    return (
      <Screen>
        <View style={s.successWrap}>
          <Text style={s.successIcon}>✅</Text>
          <Text style={s.successTitle}>Box réservé</Text>
          <Text style={s.sub}>Réservation simulée — aucun paiement réel n'a été effectué.</Text>
        </View>
        <RowGroup>
          <Row icon="🏡" label="Hôte" value={r.hote} />
          <Row icon="📍" label="Lieu" value={r.lieu} />
          <Row icon="📅" label="Période" value={`${fmtPeriode(pDebut, pFin)} · ${nuits} nuit${nuits > 1 ? 's' : ''}`} />
          {concours ? <Row icon="🏆" label="Concours" value={concours.nom} /> : null}
          {ch.count > 0 ? <Row icon="🐴" label={ch.count > 1 ? 'Chevaux' : 'Cheval'} value={ch.names.join(', ')} /> : null}
          <Row icon="💶" label="Total" value={`${total} €`} />
        </RowGroup>
        <PrimaryButton label={concoursId ? 'Retour à Mon concours' : 'Voir Mes box'} onPress={() => router.replace((concoursId ? `/(v2)/concours/${concoursId}` : '/(v2)/box/mes-box') as any)} />
        <GhostButton label="Accueil" onPress={() => router.replace('/(v2)/accueil' as any)} />
      </Screen>
    );
  }

  return (
    <Screen>
      <TouchableOpacity onPress={() => router.back()} hitSlop={8}><Text style={s.back}>← Détail</Text></TouchableOpacity>
      <Text style={s.h1}>Récapitulatif</Text>

      <RowGroup>
        <Row icon="🏡" label="Hôte" value={`${r.hote}${r.note ? ` · ★ ${r.note}` : ''}`} />
        <Row icon="📍" label="Lieu" value={r.lieu} />
        <Row icon="📅" label="Période" value={`${fmtPeriode(pDebut, pFin)} · ${nuits} nuit${nuits > 1 ? 's' : ''}`} />
        {concours ? <Row icon="🏆" label="Concours" value={concours.nom} /> : null}
        {ch.count > 0
          ? <Row icon="🐴" label={ch.count > 1 ? 'Chevaux' : 'Cheval'} value={ch.names.join(', ')} sub={ch.count > 1 ? `${ch.count} chevaux — réservation multi-box = lot ultérieur` : undefined} />
          : <Row icon="🐴" label="Cheval" value="non précisé" sub="défini dans « Préparer mon concours »" />}
        <Row icon="🚪" label="Box" value="1" />
      </RowGroup>

      <Card>
        <Row label={`${r.prixNuit} € × ${nuits} nuit${nuits > 1 ? 's' : ''}`} value={`${sousTotal} €`} />
        <Row label={`Commission plateforme (${Math.round(commission * 100)} %)`} value={`${totalCommission} €`} />
        <View style={s.totalRow}><Text style={s.totalLabel}>Total</Text><Text style={s.totalValue}>{total} €</Text></View>
      </Card>

      <PrimaryButton label="Confirmer la réservation" onPress={confirm} />
      <Placeholder note="F6 : confirmation LOCALE simulée — pas de Stripe, pas de paiement, pas d'écriture PROD" />
    </Screen>
  );
}

// ═══════════════════════ JE PROPOSE ═══════════════════════
export function BoxProposeV2() {
  const { concoursId } = useLocalSearchParams<{ concoursId?: string }>();
  const { concours } = useConcours(concoursId);
  const cl = useConcoursLocal(concoursId);
  const bl = useBoxLocal(concoursId);

  const dest = useAutoDestination(concoursId, concours);
  const [adresse, setAdresse] = useState('');
  const [dateDebut, setDateDebut] = useState(concours?.date_debut ?? '');
  const [dateFin, setDateFin] = useState(concours?.date_fin ?? '');
  const [nbBox, setNbBox] = useState('1');
  const [prixNuit, setPrixNuit] = useState('');
  const [litiere, setLitiere] = useState(true);
  const [equipements, setEquipements] = useState('');
  const [description, setDescription] = useState('');
  const [done, setDone] = useState(false);

  const existing = bl.context.offer;

  const publish = () => {
    bl.publishOffer({
      concoursId, concoursNom: concours?.nom,
      lieu: dest.value.trim() || '—', adresse: adresse.trim() || undefined,
      dateDebut: dateDebut || undefined, dateFin: dateFin || undefined,
      nbBox: parseInt(nbBox, 10) || 1, prixNuit: parseInt(prixNuit, 10) || 0,
      litiereIncluse: litiere, equipements: equipements.trim() || undefined,
      description: description.trim() || undefined,
    });
    if (concoursId && cl.entry.needBox === 'unset') cl.update({ needBox: 'offering' });
    setDone(true);
  };

  if (done || existing) {
    return (
      <Screen>
        <View style={s.successWrap}>
          <Text style={s.successIcon}>✅</Text>
          <Text style={s.successTitle}>Box publié</Text>
          <Text style={s.sub}>Annonce enregistrée localement (prototype).</Text>
        </View>
        <RowGroup>
          <Row icon="📍" label="Lieu" value={existing?.lieu ?? dest.value} />
          <Row icon="📅" label="Période" value={fmtPeriode(existing?.dateDebut ?? dateDebut, existing?.dateFin ?? dateFin)} />
          <Row icon="🚪" label="Box" value={String(existing?.nbBox ?? nbBox)} />
          <Row icon="💶" label="Prix / nuit" value={`${existing?.prixNuit ?? prixNuit} €`} />
        </RowGroup>
        <PrimaryButton label="Voir dans Mes box" onPress={() => router.replace('/(v2)/box/mes-box' as any)} />
        <GhostButton label={concoursId ? 'Retour à Mon concours' : 'Retour'} onPress={() => router.replace((concoursId ? `/(v2)/concours/${concoursId}` : '/(v2)/box') as any)} />
      </Screen>
    );
  }

  return (
    <Screen>
      <TouchableOpacity onPress={() => backTo(concoursId)} hitSlop={8}><Text style={s.back}>← Box</Text></TouchableOpacity>
      <Text style={s.h1}>📣 Je propose un box</Text>

      {concours && (
        <View style={s.ctxCard}>
          <Text style={s.ctxTitle}>Rattaché au concours</Text>
          <Text style={s.ctxLine}>🏆 {concours.nom} · 📍 {concours.lieu} · 📅 {concours.dateLabel}</Text>
        </View>
      )}

      <Card>
        <V2DestinationField label="Secteur" auto={dest} placeholder="Ville / commune" />
        <Field label="Adresse de l'écurie"><TextInput style={s.input} value={adresse} onChangeText={setAdresse} placeholder="Visible une fois la mise en relation faite" placeholderTextColor={Colors.textTertiary} /></Field>
        <V2DateRange
          startLabel="Disponible du" endLabel="au"
          start={dateDebut} end={dateFin}
          onChangeStart={setDateDebut} onChangeEnd={setDateFin}
          minDate={todayStart()}
        />
        <View style={s.rowFields}>
          <Field label="Nombre de box"><TextInput style={s.input} value={nbBox} onChangeText={setNbBox} keyboardType="number-pad" /></Field>
          <Field label="Prix / box / nuit (€)"><TextInput style={s.input} value={prixNuit} onChangeText={setPrixNuit} keyboardType="number-pad" placeholder="25" placeholderTextColor={Colors.textTertiary} /></Field>
        </View>
        <TouchableOpacity style={s.check} onPress={() => setLitiere((v) => !v)}>
          <Text style={s.checkBox}>{litiere ? '☑' : '☐'}</Text>
          <Text style={s.checkTxt}>Litière incluse dans le prix</Text>
        </TouchableOpacity>
        <Field label="Équipements"><TextInput style={s.input} value={equipements} onChangeText={setEquipements} placeholder="Paddock, douche, point d'eau…" placeholderTextColor={Colors.textTertiary} /></Field>
        <Field label="Informations utiles"><TextInput style={[s.input, s.multiline]} value={description} onChangeText={setDescription} placeholder="Taille des box, foin, gardiennage, conditions…" placeholderTextColor={Colors.textTertiary} multiline /></Field>
        <PrimaryButton label="Publier l'annonce" onPress={publish} />
      </Card>
      <Placeholder note="publication LOCALE (v2:box) — aucune écriture dans les annonces Box PROD" v1Path="/proposer-box" v1Label="formulaire actuel (V1)" />
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
  doorSearch: { backgroundColor: Colors.infoBg, borderColor: Colors.infoBorder },
  doorOffer: { backgroundColor: Colors.primaryLight, borderColor: Colors.primaryBorder },
  doorIcon: { fontSize: 22 },
  doorTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.extrabold, color: Colors.textPrimary },
  doorSub: { fontSize: FontSize.sm, color: Colors.textSecondary },

  ctxCard: { backgroundColor: Colors.primaryLight, borderColor: Colors.primaryBorder, borderWidth: 1, borderRadius: 14, padding: Spacing.md, gap: 3, marginTop: Spacing.sm },
  ctxTitle: { fontSize: 11, fontWeight: FontWeight.extrabold, color: Colors.primaryDark, letterSpacing: 0.6, textTransform: 'uppercase' },
  ctxLine: { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: FontWeight.semibold },
  forHorses: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.primaryDark, marginTop: 2 },

  field: { gap: 4, marginTop: Spacing.sm },
  fieldLabel: { fontSize: 11, fontWeight: FontWeight.bold, color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 3, fontSize: FontSize.base, color: Colors.textPrimary, backgroundColor: Colors.surface },
  multiline: { minHeight: 64, textAlignVertical: 'top' },
  rowFields: { flexDirection: 'row', gap: Spacing.md },
  check: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: Spacing.sm, flex: 1 },
  checkBox: { fontSize: 18, color: Colors.primary },
  checkTxt: { fontSize: FontSize.sm, color: Colors.textPrimary, flex: 1 },

  resultsTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textSecondary, marginTop: Spacing.md },
  result: { backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, gap: 4, marginTop: Spacing.sm },
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

  desc: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 19 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.sm, marginTop: 4 },
  totalLabel: { fontSize: FontSize.base, fontWeight: FontWeight.extrabold, color: Colors.textPrimary },
  totalValue: { fontSize: FontSize.base, fontWeight: FontWeight.extrabold, color: Colors.primaryDark },

  successWrap: { alignItems: 'center', gap: 6, paddingVertical: Spacing.lg },
  successIcon: { fontSize: 40 },
  successTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.extrabold, color: Colors.success },
});
