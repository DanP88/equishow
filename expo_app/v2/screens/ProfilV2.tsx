// ─────────────────────────────────────────────────────────────────────────────
// ProfilV2 — onglet 👤. UN SEUL profil = UNE personne.
// En-tête : identité + vérifié + note + « Activités : … » (libellés, pas des
// boutons) + compteurs d'activité RÉELS (F9). Puis un bloc par capacité détenue.
// Aucun profil-coach / profil-org séparé. Aucun « changer de compte ».
// ─────────────────────────────────────────────────────────────────────────────
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Spacing, FontSize, FontWeight } from '../../constants/theme';
import { Screen, Card, Row, RowGroup, Section, Placeholder } from '../ui/kit';
import { useCapabilities, CAPABILITY_LABEL } from '../capabilities';
import { useV2Session } from '../auth';
import { useV2ActivityCounts } from '../state/activityCounts';

export function ProfilV2() {
  const caps = useCapabilities();
  const { identity, kind } = useV2Session();
  const a = useV2ActivityCounts();

  const name = `${identity?.prenom ?? ''} ${identity?.nom ?? ''}`.trim() || 'Utilisateur EquiShow';
  const activities = caps.held.map((c) => CAPABILITY_LABEL[c] + (caps.isPending(c) ? ' (en attente)' : '')).join(' · ') || '—';

  const counters = [
    a.chevaux ? `🐴 ${a.chevaux}` : null,
    a.concoursSuivis ? `🏆 ${a.concoursSuivis}` : null,
    a.transports ? `🚚 ${a.transports}` : null,
    a.box ? `🏠 ${a.box}` : null,
    a.coachings ? `🎓 ${a.coachings}` : null,
  ].filter(Boolean).join('  ·  ');

  const reservations = a.transports + a.box + a.coachings;

  return (
    <Screen>
      <Card>
        <View style={s.headRow}>
          <View style={s.avatar}><Text style={s.avatarTxt}>{((identity?.prenom?.[0] ?? '') + (identity?.nom?.[0] ?? '')).toUpperCase() || 'EQ'}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={s.name}>{name}</Text>
            <Text style={s.verif}>
              {kind === 'real' ? '✔︎ Compte réel' : '● Compte simulé'}  ·  ★ {a.avisNote || '—'} ({a.avisRecus} avis)
            </Text>
            <Text style={s.activities}>Activités : {activities}</Text>
          </View>
        </View>
        <Text style={s.counters}>{counters || 'Aucune activité pour le moment'}{a.demo ? '  · aperçu' : ''}</Text>
      </Card>

      {caps.has('cavalier') && (
        <Section title={`Cavalier${a.chevaux || reservations ? ` · ${a.chevaux} ${a.chevaux > 1 ? 'chevaux' : 'cheval'}, ${reservations} réservation${reservations > 1 ? 's' : ''}` : ''}`}>
          <RowGroup>
            <Row icon="🐴" label="Mes chevaux" value={a.chevaux ? String(a.chevaux) : undefined} onPress={() => router.replace('/(v2)/chevaux' as any)} />
            <Row icon="🏆" label="Mes concours (suivis / à venir)" value={a.concoursSuivis ? String(a.concoursSuivis) : undefined} onPress={() => router.push('/(v2)/concours?tab=suivis' as any)} />
            <Row icon="🚚" label="Mes transports" value={a.transports ? String(a.transports) : undefined} onPress={() => router.push('/(v2)/transport/mes-transports' as any)} />
            <Row icon="🏠" label="Mes box" value={a.box ? String(a.box) : undefined} onPress={() => router.push('/(v2)/box/mes-box' as any)} />
            <Row icon="🎓" label="Mes coachings" value={a.coachings ? String(a.coachings) : undefined} onPress={() => router.push('/(v2)/coach/mes-coachings' as any)} />
            <Row icon="🎫" label="Mes réservations & paiements" onPress={() => router.replace('/(v2)/agenda' as any)} />
          </RowGroup>
        </Section>
      )}

      {caps.has('coach') && (
        <Section title={`Coach${a.coachAnnonces || a.coachDemandesRecues ? ` · ${a.coachAnnonces} annonce${a.coachAnnonces > 1 ? 's' : ''}, ${a.coachDemandesRecues} demande${a.coachDemandesRecues > 1 ? 's' : ''}` : ''}`}>
          <RowGroup>
            <Row icon="🎓" label="Mes annonces de coaching" value={a.coachAnnonces ? String(a.coachAnnonces) : undefined} onPress={() => router.push('/(v2)/coach?face=propose' as any)} />
            <Row icon="👥" label="Mes élèves & demandes" value={a.coachDemandesRecues ? String(a.coachDemandesRecues) : undefined} onPress={() => router.push('/(v2)/coach?face=eleves' as any)} />
            <Row icon="💶" label="Mes revenus (commission 9 %)" onPress={() => router.push('/(v2)/coach/mes-coachings' as any)} />
          </RowGroup>
        </Section>
      )}
      {caps.isPending('coach') && <Text style={s.pending}>Activité Coach : en attente (prototype)</Text>}

      {(caps.has('organisateur') || caps.isPending('organisateur')) && (
        <Section title={`Organisateur${a.concoursOrganises ? ` · ${a.concoursOrganises} concours` : ''}`}>
          <RowGroup>
            <Row icon="🏟" label="Espace organisateur" value={a.concoursOrganises ? String(a.concoursOrganises) : undefined} onPress={() => router.push('/(v2)/organisateur' as any)} />
            <Row icon="📊" label="Radar (agrégats RGPD)" onPress={() => router.push('/(v2)/organisateur' as any)} />
            <Row icon="🏠" label="Mes box proposés" onPress={() => router.push('/(v2)/box/mes-box' as any)} />
            <Row icon="⏳" label="Statut" value={caps.isPending('organisateur') ? 'en attente' : 'validé'} />
          </RowGroup>
        </Section>
      )}

      <Section title="Réputation">
        <RowGroup>
          <Row icon="⭐" label="Mes avis" value={a.avisRecus ? `★ ${a.avisNote} · ${a.avisRecus}` : '—'} onPress={() => router.push('/(v2)/avis' as any)} />
          <Row icon="✍️" label="Avis que j'ai déposés" value={a.avisDeposes ? String(a.avisDeposes) : '—'} onPress={() => router.push('/(v2)/avis' as any)} />
        </RowGroup>
      </Section>

      <Section title="Compte">
        <RowGroup>
          <Row icon="🧩" label="Mes activités" value={String(caps.held.length)} onPress={() => router.push('/v2-dev' as any)} />
          <Row icon="⚙️" label="Paramètres" onPress={() => {}} />
          <Row icon="❓" label="Aide & contact" onPress={() => {}} />
        </RowGroup>
      </Section>

      <Placeholder note={a.demo
        ? 'compteurs = aperçu de démonstration (non connecté) — se remplissent avec vos vraies activités une fois connecté'
        : 'compteurs réels : activité V1 (lecture seule) + activité simulée V2'} v1Path="/(tabs)/profil" v1Label="profil actuel" />
    </Screen>
  );
}

const s = StyleSheet.create({
  headRow: { flexDirection: 'row', gap: Spacing.md, alignItems: 'center' },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { color: Colors.textInverse, fontWeight: FontWeight.extrabold, fontSize: FontSize.lg },
  name: { fontSize: FontSize.lg, fontWeight: FontWeight.extrabold, color: Colors.textPrimary },
  verif: { fontSize: FontSize.sm, color: Colors.textSecondary },
  activities: { fontSize: FontSize.sm, color: Colors.primaryDark, fontWeight: FontWeight.semibold, marginTop: 2 },
  counters: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.semibold, marginTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.sm },
  pending: { fontSize: FontSize.xs, color: Colors.warning, fontWeight: FontWeight.bold },
});
