// ─────────────────────────────────────────────────────────────────────────────
// FicheConcoursV2 — LE CENTRE DE CONTRÔLE.
//   Identité + FFE
//   [ J'y serai ]  → Préparer mon concours (skippable)
//   MON CONCOURS : Cheval · Épreuves · Transport · Box · Coach
//   INFOS : météo · épreuves · horaires · « voir dans mon agenda »
//   ÉCHANGES : discussion · participants
//   (ORG) bandeau organisateur : Radar · Éditer · Publier
//
// F2 : identité = lecture réelle (useConcours). « J'y serai » / « Suivre » /
// prépa = état LOCAL simulé (useConcoursLocal) — AUCUNE écriture PROD.
// ─────────────────────────────────────────────────────────────────────────────
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../../constants/theme';
import { Screen, Section, Card, Row, RowGroup, PrimaryButton, GhostButton, Placeholder } from '../ui/kit';
import { useCapabilities } from '../capabilities';
import { useConcours } from '../../hooks/useConcours';
import { useMyConcours } from '../../hooks/useConcours';
import { useConcoursLocal, NeedChoice } from '../state/concoursLocal';
import { MOCK_COACHES_ON_CONCOURS } from '../mocks/f2';

const needLabel: Record<NeedChoice, string> = {
  unset: 'à organiser', done: '✓ déjà organisé', searching: '🔍 je cherche', none: '— pas nécessaire',
};

export function FicheConcoursV2() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const caps = useCapabilities();
  const { concours, isLoading } = useConcours(id);
  const { entry, prepScore, setGoing, toggleFollow, update } = useConcoursLocal(id);
  const { concours: mine } = useMyConcours();
  const iOrganise = mine.some((c) => c.id === id);

  if (isLoading) return <Screen scroll={false}><View style={s.center}><ActivityIndicator color={Colors.primary} /></View></Screen>;
  if (!concours) return <Screen><Text style={s.h1}>Concours introuvable</Text><GhostButton label="← Retour" onPress={() => router.back()} /></Screen>;

  const openService = (kind: 'transport' | 'box' | 'coach', face: 'cherche' | 'propose' = 'cherche') =>
    router.push(`/(v2)/service/${kind}?concoursId=${id}&face=${face}` as any);

  return (
    <Screen>
      <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/(v2)/concours' as any))}>
        <Text style={s.back}>← Concours</Text>
      </TouchableOpacity>

      {/* Bandeau ORGANISATEUR */}
      {(caps.has('organisateur') && iOrganise) && (
        <Card>
          <Text style={s.orgKicker}>🏟 VOUS ORGANISEZ CE CONCOURS</Text>
          <View style={s.orgActions}>
            <TouchableOpacity onPress={() => router.push('/(tabs)/org-concours' as any)}><Text style={s.orgBtn}>✏️ Éditer</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/(tabs)/org-concours' as any)}><Text style={s.orgBtn}>🚀 Publier / Archiver</Text></TouchableOpacity>
          </View>
          <View style={s.radar}>
            <Text style={s.radarTitle}>📊 Radar (agrégats, masquage &lt; 5)</Text>
            <Text style={s.radarLine}>👥 34 participants · 🐴 41 chevaux</Text>
            <Text style={s.radarLine}>🚚 3 trajets · 🏠 6/11 box réservés · 🎓 2 coachs</Text>
            <Placeholder note="Radar réel rebranché en F10" v1Path="/(tabs)/org-radar" v1Label="Radar actuel" />
          </View>
        </Card>
      )}

      {/* IDENTITÉ */}
      <View style={s.band}><Text style={s.bandTxt}>{(concours.type_concours && concours.type_concours !== 'nan') ? concours.type_concours : 'Concours'}{concours.departement ? ` · Dépt ${concours.departement}` : ''}</Text></View>
      <Text style={s.h1}>🏆 {concours.nom}</Text>
      {!!concours.dateLabel && <Text style={s.meta}>📅 {concours.dateLabel}</Text>}
      {!!concours.lieu && <Text style={s.meta}>📍 {concours.lieu}</Text>}
      {!!concours.numero_ffe && <Text style={s.metaDim}>N° FFE {concours.numero_ffe}</Text>}
      {!!concours.lien_ffe && <GhostButton label="🔗 S'inscrire sur la FFE ↗" onPress={() => router.push(concours.lien_ffe as any)} />}

      {/* J'Y SERAI */}
      {!entry.going ? (
        <PrimaryButton label="🟢 J'y serai" onPress={() => { setGoing(true); router.push(`/(v2)/concours/${id}/preparer` as any); }} />
      ) : (
        <Card pad={false}>
          <View style={s.mcHead}>
            <Text style={s.mcTitle}>MON CONCOURS</Text>
            <TouchableOpacity onPress={() => setGoing(false)} hitSlop={6}><Text style={s.mcModif}>Retirer</Text></TouchableOpacity>
          </View>
          <Row icon="🐴" label="Cheval" value={entry.chevalId ? 'choisi' : 'à choisir'} onPress={() => router.push(`/(v2)/concours/${id}/preparer` as any)} />
          <Row icon="📋" label="Épreuve(s)" value={entry.epreuves.length ? entry.epreuves.join(', ') : 'à préciser'} onPress={() => router.push(`/(v2)/concours/${id}/preparer` as any)} />
          <Row icon="🚚" label="Transport" value={needLabel[entry.needTransport]} right={entry.needTransport === 'searching' || entry.needTransport === 'unset' ? <TouchableOpacity onPress={() => openService('transport')}><Text style={s.miniCta}>Chercher</Text></TouchableOpacity> : undefined} />
          <Row icon="🏠" label="Box" value={needLabel[entry.needBox]} right={entry.needBox === 'searching' || entry.needBox === 'unset' ? <TouchableOpacity onPress={() => openService('box')}><Text style={s.miniCta}>Chercher</Text></TouchableOpacity> : undefined} />
          <Row icon="🎓" label="Coach" value={needLabel[entry.needCoach]} right={entry.needCoach === 'searching' || entry.needCoach === 'unset' ? <TouchableOpacity onPress={() => openService('coach')}><Text style={s.miniCta}>Chercher</Text></TouchableOpacity> : undefined} />
          <View style={s.mcFoot}>
            <Text style={s.prep}>Préparation ◕ {prepScore}/5</Text>
            <PrimaryButton label="Compléter ma préparation" onPress={() => router.push(`/(v2)/concours/${id}/preparer` as any)} />
            <TouchableOpacity onPress={() => router.replace('/(v2)/agenda' as any)} hitSlop={6}><Text style={s.link}>📅 Voir dans mon agenda</Text></TouchableOpacity>
          </View>
        </Card>
      )}

      {/* CE CONCOURS & VOUS (multi-capacités) */}
      {(caps.has('coach')) && (
        <Section title="Vous y coachez">
          <Card>
            <Text style={s.coachHere}>2 séances prévues ici · Julie/Tornado, Thomas/Rio</Text>
            <View style={s.rowBtns}>
              <GhostButton label="Gérer mes séances" onPress={() => router.push('/(v2)/service/coach?face=eleves' as any)} />
              <GhostButton label="Proposer un créneau ici" onPress={() => openService('coach', 'propose')} />
            </View>
            <Placeholder note="séances de coaching sur ce concours rebranchées en F7" />
          </Card>
        </Section>
      )}

      {/* PRÉSENCE */}
      <Section title="Présence">
        <Card>
          <Text style={s.presence}>👥 12 participants · 🐴 9 chevaux</Text>
          <Text style={s.presenceSub}>Que vous connaissez · 3 — Marie L. (Ideal) · Coach Émilie</Text>
          <TouchableOpacity hitSlop={6}><Text style={s.link}>Voir tous les participants (12) ›</Text></TouchableOpacity>
          <Placeholder note="présence & connaissances communes rebranchées en F10" />
        </Card>
      </Section>

      {/* ORGANISE TON DÉPLACEMENT */}
      <Section title="Organise ton déplacement">
        <RowGroup>
          <Row icon="🚚" label="Transport" value="3 offres" onPress={() => openService('transport')} />
          <Row icon="🏠" label="Box" value="5 offres" onPress={() => openService('box')} />
          <Row icon="🎓" label="Coachs présents" value={String(MOCK_COACHES_ON_CONCOURS.length)} onPress={() => openService('coach')} />
        </RowGroup>
      </Section>

      {/* INFOS CONCOURS */}
      <Section title="Infos concours">
        <RowGroup>
          <Row icon="🌤" label="Météo (J–3 → J+1)" />
          <Row icon="📋" label={`Épreuves · ${concours.liste_epreuves.length}`} onPress={() => {}} />
          <Row icon="🕓" label="Horaires" value="non publiés" />
        </RowGroup>
        <Placeholder note="météo & épreuves reprises de la V1 ; horaires structurés = pas de source" v1Path={`/concours/${id}`} v1Label="fiche concours actuelle" />
      </Section>

      {/* ÉCHANGES */}
      <Section title="Échanges">
        <RowGroup>
          <Row icon="💬" label="Discussion du concours" value="12" onPress={() => router.push(`/concours/${id}/discussion` as any)} />
          {entry.going ? <Row icon="🧵" label="Fil des participants" onPress={() => router.push(`/concours/${id}/participants` as any)} /> : null}
        </RowGroup>
      </Section>

      {/* SUIVRE */}
      <GhostButton label={entry.following ? '⭐ Concours suivi ✓' : '⭐ Suivre ce concours'} onPress={toggleFollow} />
    </Screen>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  back: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.bold, marginBottom: 4 },
  band: { alignSelf: 'flex-start', backgroundColor: Colors.primary, borderRadius: Radius.xs, paddingHorizontal: Spacing.md, paddingVertical: 3 },
  bandTxt: { color: Colors.textInverse, fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  h1: { fontSize: FontSize.xxl, fontWeight: FontWeight.extrabold, color: Colors.textPrimary },
  meta: { fontSize: FontSize.base, color: Colors.textSecondary },
  metaDim: { fontSize: FontSize.xs, color: Colors.textTertiary },
  mcHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: 4 },
  mcTitle: { fontSize: 11, fontWeight: FontWeight.extrabold, color: Colors.primaryDark, letterSpacing: 0.8 },
  mcModif: { fontSize: FontSize.xs, color: Colors.textTertiary, fontWeight: FontWeight.semibold },
  mcFoot: { padding: Spacing.lg, gap: 8, borderTopWidth: 1, borderTopColor: '#ECEBE7' },
  miniCta: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: FontWeight.bold, backgroundColor: Colors.primaryLight, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, overflow: 'hidden' },
  prep: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  link: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.bold },
  coachHere: { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: FontWeight.semibold },
  rowBtns: { gap: Spacing.sm },
  presence: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  presenceSub: { fontSize: FontSize.sm, color: Colors.textSecondary },
  orgKicker: { fontSize: FontSize.xs, fontWeight: FontWeight.extrabold, color: Colors.primaryDark, letterSpacing: 0.6 },
  orgActions: { flexDirection: 'row', gap: Spacing.lg },
  orgBtn: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.bold },
  radar: { marginTop: Spacing.sm, gap: 3 },
  radarTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  radarLine: { fontSize: FontSize.sm, color: Colors.textSecondary },
});
