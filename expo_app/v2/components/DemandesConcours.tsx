// ─────────────────────────────────────────────────────────────────────────────
// DemandesConcours — « Demandes en cours » d'un concours (SIMULATION front).
//
//   · <DemandesBanner kind concoursId /> : bandeau compact « N cavaliers
//     cherchent un <kind> vers ce concours » (écrans « Je cherche » / « Je
//     propose »).
//   · <DemandesEnCoursModal /> : liste complète groupée par besoin (fiche
//     concours).
//
// Données = v2/adapters/concoursDemands (exemples + recherches publiées par
// l'utilisateur). Phase 2 = vraie table partagée + notifications.
// ─────────────────────────────────────────────────────────────────────────────
import { View, Text, Modal, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { BL, FONT } from '../ui/blush';
import { useConcoursDemands, DemandKind, ConcoursDemand } from '../adapters/concoursDemands';

const KIND_LABEL: Record<DemandKind, string> = { transport: 'un transport', box: 'un box', coach: 'un coach' };
const KIND_ICON: Record<DemandKind, string> = { transport: '🚚', box: '🏠', coach: '🎓' };

// ── Bandeau compact ─────────────────────────────────────────────────────────
export function DemandesBanner({
  kind, concoursId, concoursNom, tone = 'info', onPress,
}: {
  kind: DemandKind;
  concoursId?: string;
  concoursNom?: string;
  /** 'info' (je cherche) · 'cta' (je propose — incite à publier). */
  tone?: 'info' | 'cta';
  onPress?: () => void;
}) {
  const d = useConcoursDemands(concoursId);
  const list = d.byKind(kind);
  if (!concoursId || list.length === 0) return null;

  const n = list.length;
  const others = list.filter((x) => !x.own).length;

  return (
    <TouchableOpacity
      activeOpacity={onPress ? 0.85 : 1}
      onPress={onPress}
      style={[b.wrap, tone === 'cta' && b.wrapCta]}
    >
      <Text style={b.title}>
        🔔 {tone === 'cta'
          ? `${others} cavalier${others > 1 ? 's' : ''} attend${others > 1 ? 'ent' : ''} ${KIND_LABEL[kind]}${concoursNom ? '' : ' pour ce concours'}`
          : `${n} cavalier${n > 1 ? 's' : ''} cherche${n > 1 ? 'nt' : ''} ${KIND_LABEL[kind]} vers ce concours`}
      </Text>
      <Text style={b.sub}>
        {list.slice(0, 3).map((x) => (x.own ? 'toi' : x.nom.split(' ')[0])).join(', ')}
        {n > 3 ? ` +${n - 3}` : ''}
        {onPress ? '  ·  voir' : ''}
      </Text>
      {tone === 'cta' && (
        <Text style={b.ctaHint}>Publie ton offre : ces cavaliers pourront te réserver.</Text>
      )}
      <Text style={b.demo}>simulation — la mise en relation réelle arrive avec le backend</Text>
    </TouchableOpacity>
  );
}

// ── Modal liste complète ────────────────────────────────────────────────────
export function DemandesEnCoursModal({
  visible, onClose, concoursId,
}: {
  visible: boolean;
  onClose: () => void;
  concoursId?: string;
}) {
  const d = useConcoursDemands(concoursId);

  const Group = ({ kind }: { kind: DemandKind }) => {
    const list = d.byKind(kind);
    if (list.length === 0) return null;
    return (
      <View style={m.group}>
        <Text style={m.groupTitle}>{KIND_ICON[kind]}  {list.length} pour {KIND_LABEL[kind]}</Text>
        {list.map((x: ConcoursDemand) => (
          <View key={x.id} style={[m.card, x.own && m.cardOwn]}>
            <View style={[m.avatar, x.own && m.avatarOwn]}><Text style={m.avatarTxt}>{x.initiales}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={m.name}>{x.own ? 'Ta demande' : x.nom}{x.cheval ? `  ·  ${x.cheval}` : ''}</Text>
              <Text style={m.detail}>{x.detail}</Text>
            </View>
          </View>
        ))}
      </View>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={m.backdrop}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={m.sheet}>
          <View style={m.grabber} />
          <Text style={m.title}>Demandes en cours</Text>
          <Text style={m.subtitle}>Ce que d'autres cavaliers cherchent pour ce concours</Text>
          <ScrollView style={{ maxHeight: 460 }} contentContainerStyle={{ gap: 14, paddingBottom: 6 }} showsVerticalScrollIndicator={false}>
            {d.total === 0 ? (
              <Text style={m.empty}>Aucune demande pour ce concours pour l'instant.</Text>
            ) : (
              <>
                <Group kind="transport" />
                <Group kind="box" />
                <Group kind="coach" />
                <Text style={m.foot}>
                  Simulation : entre deux testeurs sur deux téléphones, chacun voit ces exemples + ses propres
                  demandes. La vraie mise en relation (+ notifications) demande le backend.
                </Text>
              </>
            )}
          </ScrollView>
          <TouchableOpacity style={m.close} onPress={onClose}><Text style={m.closeTxt}>Fermer</Text></TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const b = StyleSheet.create({
  wrap: { backgroundColor: BL.lilacSoft, borderRadius: 14, borderWidth: 1, borderColor: BL.accentLine, padding: 12, marginVertical: 8, gap: 2 },
  wrapCta: { backgroundColor: BL.coralSoft },
  title: { fontFamily: FONT.body, fontSize: 12.5, fontWeight: '700', color: BL.ink },
  sub: { fontFamily: FONT.body, fontSize: 11, color: BL.sub },
  ctaHint: { fontFamily: FONT.body, fontSize: 11, color: BL.coralInk, marginTop: 3 },
  demo: { fontFamily: FONT.body, fontSize: 9.5, color: BL.faint, fontStyle: 'italic', marginTop: 3 },
});

const m = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(30,20,26,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: BL.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 18 },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: BL.accentLine, marginBottom: 10 },
  title: { fontFamily: FONT.head, fontSize: 20, fontWeight: '700', color: BL.ink },
  subtitle: { fontFamily: FONT.body, fontSize: 12, color: BL.sub, marginTop: 2, marginBottom: 12 },
  empty: { fontFamily: FONT.body, fontSize: 13, color: BL.sub, textAlign: 'center', padding: 18 },
  group: { gap: 8 },
  groupTitle: { fontFamily: FONT.head, fontSize: 14, fontWeight: '700', color: BL.accent },
  card: { flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: BL.card, borderRadius: 14, borderWidth: 1, borderColor: BL.line, padding: 11 },
  cardOwn: { borderColor: BL.accentLine, backgroundColor: BL.accentSoft },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: BL.faint, alignItems: 'center', justifyContent: 'center' },
  avatarOwn: { backgroundColor: BL.accent },
  avatarTxt: { color: '#fff', fontWeight: '800', fontSize: 11, fontFamily: FONT.body },
  name: { fontFamily: FONT.body, fontSize: 13, fontWeight: '700', color: BL.ink },
  detail: { fontFamily: FONT.body, fontSize: 11, color: BL.sub, marginTop: 1 },
  foot: { fontFamily: FONT.body, fontSize: 10.5, color: BL.faint, lineHeight: 15, fontStyle: 'italic', marginTop: 4 },
  close: { marginTop: 12, alignItems: 'center', paddingVertical: 12, borderRadius: 999, borderWidth: 1, borderColor: BL.line, backgroundColor: BL.card },
  closeTxt: { fontFamily: FONT.body, fontSize: 13, fontWeight: '700', color: BL.sub },
});
