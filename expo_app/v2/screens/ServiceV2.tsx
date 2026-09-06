// ─────────────────────────────────────────────────────────────────────────────
// ServiceV2 — écran générique Transport / Box / Coach.
//   Segment 2 faces de POIDS ÉGAL : 🔍 Je cherche | 📣 Je propose
//   (+ 👥 Mes élèves pour Coach si capacité coach)
//
// F2 = STRUCTURE uniquement. Les parcours détaillés (recherche réelle,
// formulaires d'annonce, réservation, paiement) = LOTS F5 (Transport) /
// F6 (Box) / F7 (Coach). Ici : maquette des champs + lien vers l'écran V1.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Spacing, FontSize, FontWeight } from '../../constants/theme';
import { Screen, Segment, Card, Row, Placeholder, EmptyState } from '../ui/kit';
import { useCapabilities } from '../capabilities';
import { useConcours } from '../../hooks/useConcours';
import { MOCK_COACHES_ON_CONCOURS, MOCK_COACH_DEMANDS, MOCK_STUDENT_HORSES } from '../mocks/f2';

type Kind = 'transport' | 'box' | 'coach';
const META: Record<Kind, { title: string; icon: string; v1: string; lot: string }> = {
  transport: { title: 'Transport', icon: '🚚', v1: '/(tabs)/services?tab=transport', lot: 'F5' },
  box: { title: 'Box', icon: '🏠', v1: '/(tabs)/services?tab=box', lot: 'F6' },
  coach: { title: 'Coach', icon: '🎓', v1: '/(tabs)/services?tab=coach', lot: 'F7' },
};

export function ServiceV2() {
  const { kind, concoursId, face } = useLocalSearchParams<{ kind: Kind; concoursId?: string; face?: string }>();
  const k: Kind = (kind === 'box' || kind === 'coach') ? kind : 'transport';
  const caps = useCapabilities();
  const { concours } = useConcours(concoursId);
  const m = META[k];

  const faces = [
    { key: 'cherche', label: '🔍 Je cherche' },
    { key: 'propose', label: '📣 Je propose' },
    ...(k === 'coach' && caps.has('coach') ? [{ key: 'eleves', label: '👥 Mes élèves' }] : []),
  ];
  const [tab, setTab] = useState<string>(faces.some((f) => f.key === face) ? face! : 'cherche');

  return (
    <Screen>
      <TouchableOpacity onPress={() => router.back()}><Text style={s.back}>← Retour</Text></TouchableOpacity>
      <Text style={s.h1}>{m.icon} {m.title}</Text>
      {concours && <Text style={s.ctx}>Concours : {concours.nom} · {concours.dateLabel} · {concours.lieu}</Text>}

      <Segment options={faces} value={tab} onChange={setTab} />

      {tab === 'cherche' && (
        <>
          <Card>
            <Text style={s.formTitle}>Ce qu’on te demandera</Text>
            {k !== 'coach' && <Row label="Cheval" value="à choisir" />}
            {k === 'transport' && <Row label="Lieu de départ" value="—" />}
            <Row label="Destination" value={concours ? `${concours.lieu} (du concours)` : 'libre'} />
            <Row label="Dates" value={concours ? 'autour du concours' : 'à définir'} />
            {k === 'transport' && <Row label="Nb chevaux · voyager avec" value="1 · non" />}
            {k === 'box' && <Row label="Nb box · litière" value="1 · indiff." />}
            {k === 'coach' && <Row label="Discipline · niveau" value="—" />}
          </Card>

          {k === 'coach' ? (
            MOCK_COACHES_ON_CONCOURS.map((c) => (
              <Card key={c.id}>
                <Text style={s.resTitle}>🎓 {c.name}   ★{c.note}</Text>
                <Text style={s.resSub}>{c.disciplines} · {c.price} €/séance · {c.coachedHere} cavaliers coachés ici</Text>
                <TouchableOpacity><Text style={s.cta}>Demander un coaching →</Text></TouchableOpacity>
              </Card>
            ))
          ) : (
            <EmptyState
              icon={m.icon}
              title={`Aucun ${m.title.toLowerCase()} ${concours ? 'pour ce concours' : ''} pour le moment`}
              body="Structure F2 — résultats réels branchés au lot fonctionnel."
              ctaLabel="Signaler que je cherche"
              onCta={() => {}}
            />
          )}
          <Placeholder note={`Parcours « Je cherche » complet (recherche réelle, réservation, paiement, messagerie) = LOT ${m.lot}.`} v1Path={m.v1} v1Label={`Voir le marché ${m.title} (V1)`} />
        </>
      )}

      {tab === 'propose' && (
        <>
          <Card>
            <Text style={s.formTitle}>Formulaire d’annonce (aperçu)</Text>
            {k === 'transport' && <><Row label="Lieu de départ" /><Row label="Destination" value={concours ? concours.lieu ?? '—' : '—'} /><Row label="Date · heure · places" /><Row label="Je peux aussi transporter le cavalier" value="non" /><Row label="Prix au km" /></>}
            {k === 'box' && <><Row label="Lieu / adresse" /><Row label="Période" value={concours ? 'dates du concours' : '—'} /><Row label="Nb de box · prix/nuit · litière" /><Row label="Équipements" /></>}
            {k === 'coach' && <><Row label="Type (concours / régulier)" /><Row label="Discipline · niveaux" /><Row label="Dates · places · prix/séance" /></>}
            <Row label="Concours associé" value={concours ? concours.nom : 'aucun'} />
          </Card>
          <Placeholder note={`Formulaire « Je propose » réel + wording revu + contrôles de cohérence (destination/dates ≠ concours) = LOT ${m.lot}.`} v1Path={k === 'coach' ? '/proposer-coach' : k === 'box' ? '/proposer-box' : '/proposer-transport'} v1Label={`Ouvrir « Proposer ${m.title} » (V1)`} />
        </>
      )}

      {tab === 'eleves' && (
        <>
          <Card>
            <Text style={s.formTitle}>Demandes reçues ({MOCK_COACH_DEMANDS.length})</Text>
            {MOCK_COACH_DEMANDS.map((d) => (
              <View key={d.id} style={s.demand}>
                <Text style={s.demandTxt}>{d.rider} / {d.horse} · {d.detail}</Text>
                <Text style={s.demandCtx}>🏆 {d.concours}</Text>
                <View style={s.demandBtns}>
                  <TouchableOpacity style={s.accept}><Text style={s.acceptTxt}>Accepter</Text></TouchableOpacity>
                  <TouchableOpacity style={s.reject}><Text style={s.rejectTxt}>Refuser</Text></TouchableOpacity>
                </View>
              </View>
            ))}
          </Card>
          <Card>
            <Text style={s.formTitle}>Mes cavaliers & leurs chevaux</Text>
            {MOCK_STUDENT_HORSES.map((h) => (
              <Row key={h.id} icon="🐴" label={`${h.horse} — ${h.rider}`} value={h.discipline} />
            ))}
          </Card>
          <Placeholder note="Gestion élèves / demandes / séances réelle (course_demands, accept/refuse, paiement post-acceptation) = LOT F7." v1Path="/(tabs)/coach-demandes" v1Label="Ouvrir « Demandes » coach (V1)" />
        </>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  back: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.bold },
  h1: { fontSize: FontSize.xxl, fontWeight: FontWeight.extrabold, color: Colors.textPrimary },
  ctx: { fontSize: FontSize.sm, color: Colors.textSecondary },
  formTitle: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5 },
  resTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  resSub: { fontSize: FontSize.sm, color: Colors.textSecondary },
  cta: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.bold, marginTop: 4 },
  demand: { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.sm, marginTop: Spacing.sm, gap: 3 },
  demandTxt: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  demandCtx: { fontSize: FontSize.xs, color: Colors.textSecondary },
  demandBtns: { flexDirection: 'row', gap: Spacing.sm, marginTop: 4 },
  accept: { backgroundColor: Colors.primary, borderRadius: 6, paddingHorizontal: Spacing.md, paddingVertical: 5 },
  acceptTxt: { color: Colors.textInverse, fontWeight: FontWeight.bold, fontSize: FontSize.xs },
  reject: { borderWidth: 1, borderColor: Colors.border, borderRadius: 6, paddingHorizontal: Spacing.md, paddingVertical: 5 },
  rejectTxt: { color: Colors.textSecondary, fontWeight: FontWeight.bold, fontSize: FontSize.xs },
});
