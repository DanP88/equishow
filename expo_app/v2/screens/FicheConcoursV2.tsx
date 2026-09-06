// ─────────────────────────────────────────────────────────────────────────────
// FicheConcoursV2 — LE CENTRE DE CONTRÔLE PERSONNEL DU CONCOURS (LOT F4).
//
//   [identité]  →  [Vos activités : organisateur / coach — simultanées]
//   →  J'y serai  →  ✅ J'y participe  →  MON CONCOURS (tableau de bord)
//        · Préparation X/5
//        · 🐴 Cheval · 📝 Épreuves · 🚚 Transport · 🏠 Box · 🎓 Coach + état
//        · [ Préparer mon concours ]
//   →  Infos concours  →  Échanges
//
// F4 : identité = lecture réelle (useConcours). Participation / préparation =
// état LOCAL (useConcoursLocal, AsyncStorage) — AUCUNE écriture PROD.
// Ne construit PAS les moteurs Transport/Box/Coach (F5+). Assure le contexte,
// la navigation, l'état et le préremplissage.
// ─────────────────────────────────────────────────────────────────────────────
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Spacing, FontSize, FontWeight } from '../../constants/theme';
import { Screen, Section, Card, Row, RowGroup, PrimaryButton, GhostButton, Placeholder } from '../ui/kit';
import { PrepBar, StatePill } from '../ui/prep';
import { useCapabilities } from '../capabilities';
import { useConcours, useMyConcours } from '../../hooks/useConcours';
import { useMyChevaux } from '../../hooks/useChevaux';
import { useConcoursLocal, needStatus, NeedChoice } from '../state/concoursLocal';

export function FicheConcoursV2() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const caps = useCapabilities();
  const { concours, isLoading } = useConcours(id);
  const { entry, prep, setGoing, toggleFollow } = useConcoursLocal(id);
  const { concours: mine } = useMyConcours();
  const { chevaux } = useMyChevaux();
  const iOrganise = mine.some((c) => c.id === id);

  if (isLoading) return <Screen scroll={false}><View style={s.center}><ActivityIndicator color={Colors.primary} /></View></Screen>;
  if (!concours) return <Screen><Text style={s.h1}>Concours introuvable</Text><GhostButton label="← Retour" onPress={() => router.back()} /></Screen>;

  const openPrep = (anchor?: string) => router.push(`/(v2)/concours/${id}/preparer${anchor ? `?focus=${anchor}` : ''}` as any);
  const openService = (kind: 'transport' | 'box' | 'coach', face: 'cherche' | 'propose') => {
    const q = new URLSearchParams({ concoursId: id, face });
    if (entry.chevalId) q.set('chevalId', entry.chevalId);
    router.push(`/(v2)/service/${kind}?${q.toString()}` as any);
  };
  // Ligne du tableau de bord : état + action contextualisée.
  const serviceRow = (kind: 'transport' | 'box' | 'coach', icon: string, label: string, need: NeedChoice) => {
    const st = needStatus(need);
    const goTo = () => {
      if (need === 'searching') openService(kind, 'cherche');
      else if (need === 'offering') openService(kind, 'propose');
      else openPrep(kind);
    };
    return (
      <Row key={kind} icon={icon} label={label} onPress={goTo} right={<StatePill status={st} />} />
    );
  };

  const chevalNom = entry.chevalId ? (chevaux.find((c) => c.id === entry.chevalId)?.nom ?? 'cheval') : null;

  return (
    <Screen>
      <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/(v2)/concours' as any))} hitSlop={8}>
        <Text style={s.back}>← Concours</Text>
      </TouchableOpacity>

      {/* ── IDENTITÉ ────────────────────────────────────────────── */}
      <Card>
        <View style={s.band}><Text style={s.bandTxt}>{(concours.type_concours && concours.type_concours !== 'nan') ? concours.type_concours : 'Concours'}{concours.departement ? ` · Dépt ${concours.departement}` : ''}</Text></View>
        <Text style={s.h1}>{concours.nom}</Text>
        {!!concours.dateLabel && <Text style={s.meta}>📅 {concours.dateLabel}</Text>}
        {!!concours.lieu && <Text style={s.meta}>📍 {concours.lieu}</Text>}
        <Text style={s.metaDim}>
          {concours.numero_ffe ? `N° FFE ${concours.numero_ffe}` : 'Concours importé FFE'}
          {iOrganise ? ' · organisé par vous' : ''}
        </Text>
        {!!concours.lien_ffe && (
          <TouchableOpacity style={s.ffe} onPress={() => router.push(concours.lien_ffe as any)}>
            <Text style={s.ffeTxt}>🔗 S'inscrire sur la FFE ↗</Text>
          </TouchableOpacity>
        )}
      </Card>

      {/* ── VOS ACTIVITÉS SUR CE CONCOURS (simultanées, jamais masquées) ── */}
      {(iOrganise || caps.has('coach')) && (
        <Section title="Vos activités sur ce concours">
          {iOrganise && (
            <Card>
              <Text style={s.actTitle}>🏟 Vous organisez ce concours</Text>
              <View style={s.actBtns}>
                <GhostButton label="📊 Radar" onPress={() => router.push('/(tabs)/org-radar' as any)} />
                <GhostButton label="✏️ Éditer / publier" onPress={() => router.push('/(tabs)/org-concours' as any)} />
              </View>
              <Placeholder note="outils organisateur détaillés = lot ultérieur" v1Path="/(tabs)/org-radar" v1Label="Radar actuel" />
            </Card>
          )}
          {caps.has('coach') && (
            <Card>
              <Text style={s.actTitle}>🎓 Vous pouvez y coacher</Text>
              <Text style={s.actSub}>2 séances prévues ici · Julie/Tornado, Thomas/Rio</Text>
              <View style={s.actBtns}>
                <GhostButton label="Gérer mes séances" onPress={() => router.push('/(v2)/service/coach?face=eleves' as any)} />
                <GhostButton label="Proposer un créneau" onPress={() => openService('coach', 'propose')} />
              </View>
              <Placeholder note="séances de coaching sur ce concours = F7" />
            </Card>
          )}
        </Section>
      )}

      {/* ── MON CONCOURS (pièce centrale) ───────────────────────── */}
      {!entry.going ? (
        <Card hero>
          <Text style={s.mcKicker}>MON CONCOURS</Text>
          <Text style={s.mcLead}>Dis que tu y seras — Equishow t'aide à organiser cheval, transport, box et coach.</Text>
          <PrimaryButton label="🟢 J'y serai" onPress={() => { setGoing(true); openPrep(); }} />
        </Card>
      ) : (
        <View style={{ gap: Spacing.md, marginTop: Spacing.md }}>
          <View style={s.goneRow}>
            <Text style={s.gone}>✅ J'y participe</Text>
            <TouchableOpacity onPress={() => setGoing(false)} hitSlop={6}><Text style={s.goneUndo}>Retirer</Text></TouchableOpacity>
          </View>

          <Card>
            <PrepBar score={prep.score} total={prep.total} />
          </Card>

          <PrimaryButton label="Préparer mon concours" onPress={() => openPrep()} />

          <RowGroup>
            <Row icon="🐴" label="Cheval" onPress={() => openPrep('cheval')}
              right={<StatePill status={entry.chevalId ? 'ready' : 'todo'} />}
              sub={chevalNom ?? undefined} />
            <Row icon="📝" label="Épreuves" onPress={() => openPrep('epreuves')}
              right={<StatePill status={entry.epreuves.length ? 'ready' : 'todo'} />}
              sub={entry.epreuves.length ? entry.epreuves.join(', ') : 'à renseigner'} />
            {serviceRow('transport', '🚚', 'Transport', entry.needTransport)}
            {serviceRow('box', '🏠', 'Box', entry.needBox)}
            {serviceRow('coach', '🎓', 'Coach', entry.needCoach)}
          </RowGroup>

          <TouchableOpacity onPress={() => router.replace('/(v2)/agenda' as any)} hitSlop={6}>
            <Text style={s.link}>📅 Voir ce concours dans mon agenda</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── INFOS CONCOURS ─────────────────────────────────────── */}
      <Section title="Infos concours">
        <RowGroup>
          <Row icon="🌤" label="Météo (J–3 → J+1)" />
          <Row icon="📋" label={`Épreuves du concours · ${concours.liste_epreuves.length}`} />
          <Row icon="🕓" label="Horaires" value="non publiés" />
        </RowGroup>
        <Placeholder note="météo & épreuves importées reprises de la V1 ; horaires structurés = pas de source" v1Path={`/concours/${id}`} v1Label="fiche concours actuelle" />
      </Section>

      {/* ── ÉCHANGES ──────────────────────────────────────────── */}
      <Section title="Échanges">
        <RowGroup>
          <Row icon="💬" label="Discussion du concours" onPress={() => router.push(`/concours/${id}/discussion` as any)} />
          {entry.going ? <Row icon="🧵" label="Fil des participants" onPress={() => router.push(`/concours/${id}/participants` as any)} /> : null}
        </RowGroup>
      </Section>

      {!entry.going && (
        <GhostButton label={entry.following ? '⭐ Concours suivi ✓' : '⭐ Suivre ce concours'} onPress={toggleFollow} />
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  back: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.bold, marginBottom: 4 },
  band: { alignSelf: 'flex-start', backgroundColor: Colors.primary, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 3 },
  bandTxt: { color: Colors.textInverse, fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  h1: { fontSize: 22, fontWeight: FontWeight.extrabold, color: Colors.textPrimary, letterSpacing: -0.3, marginTop: 4 },
  meta: { fontSize: FontSize.base, color: Colors.textSecondary },
  metaDim: { fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: 2 },
  ffe: { marginTop: 8, alignSelf: 'flex-start' },
  ffeTxt: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.bold },

  actTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  actSub: { fontSize: FontSize.sm, color: Colors.textSecondary },
  actBtns: { gap: Spacing.sm },

  mcKicker: { fontSize: 11, fontWeight: FontWeight.extrabold, color: Colors.primaryDark, letterSpacing: 0.8 },
  mcLead: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 19 },

  goneRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  gone: { fontSize: FontSize.lg, fontWeight: FontWeight.extrabold, color: Colors.success },
  goneUndo: { fontSize: FontSize.xs, color: Colors.textTertiary, fontWeight: FontWeight.semibold },
  link: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.bold, alignSelf: 'flex-start' },
});
