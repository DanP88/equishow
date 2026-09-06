// ─────────────────────────────────────────────────────────────────────────────
// ProfilV2 — onglet 👤. UN SEUL profil = UNE personne.
// En-tête : identité + vérifié + note + « Activités : … » (libellés, pas des
// boutons). Puis un bloc par capacité détenue (CAVALIER / COACH / ORGANISATEUR).
// Aucun profil-coach / profil-org séparé. Aucun « changer de compte ».
// ─────────────────────────────────────────────────────────────────────────────
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, FontWeight } from '../../constants/theme';
import { Screen, Card, Row, RowGroup, Section, Placeholder } from '../ui/kit';
import { useCapabilities, CAPABILITY_LABEL } from '../capabilities';
import { useV2Session } from '../auth';
import { useAvisStats } from '../../hooks/useAvis';
import { useAuth } from '../../hooks/useAuth';

export function ProfilV2() {
  const caps = useCapabilities();
  const { identity, kind } = useV2Session();
  const { profile } = useAuth();
  const stats = useAvisStats((profile as any)?.id);

  const name = `${identity?.prenom ?? ''} ${identity?.nom ?? ''}`.trim() || 'Utilisateur EquiShow';
  const activities = caps.held.map((c) => CAPABILITY_LABEL[c] + (caps.isPending(c) ? ' (en attente)' : '')).join(' · ') || '—';

  return (
    <Screen>
      <Card>
        <View style={s.headRow}>
          <View style={s.avatar}><Text style={s.avatarTxt}>{((identity?.prenom?.[0] ?? '') + (identity?.nom?.[0] ?? '')).toUpperCase() || 'EQ'}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={s.name}>{name}</Text>
            <Text style={s.verif}>{kind === 'real' ? '✔︎ Compte réel' : '● Compte simulé'}  ·  ★ {stats.average || '—'} ({stats.count} avis)</Text>
            <Text style={s.activities}>Activités : {activities}</Text>
          </View>
        </View>
        <Text style={s.counters}>🚚 12 transports · 🏠 8 box · 🏆 15 concours</Text>
      </Card>

      {caps.has('cavalier') && (
        <Section title="Cavalier">
          <RowGroup>
            <Row icon="🐴" label="Mes chevaux" onPress={() => router.replace('/(v2)/chevaux' as any)} />
            <Row icon="🏆" label="Mes concours (suivis / à venir)" onPress={() => router.push('/(v2)/concours?tab=suivis' as any)} />
            <Row icon="🎫" label="Mes réservations & paiements" onPress={() => router.replace('/(v2)/agenda' as any)} />
            <Row icon="⭐" label="Mes avis déposés" onPress={() => {}} />
          </RowGroup>
        </Section>
      )}

      {caps.has('coach') && (
        <Section title="Coach">
          <RowGroup>
            <Row icon="🎓" label="Mes annonces de coaching" onPress={() => router.push('/(v2)/service/coach?face=propose' as any)} />
            <Row icon="👥" label="Mes élèves & demandes" onPress={() => router.push('/(v2)/service/coach?face=eleves' as any)} />
            <Row icon="💶" label="Mes revenus (commission 9 %)" onPress={() => {}} />
          </RowGroup>
        </Section>
      )}
      {caps.isPending('coach') && <Text style={s.pending}>Activité Coach : en attente (prototype)</Text>}

      {(caps.has('organisateur') || caps.isPending('organisateur')) && (
        <Section title="Organisateur">
          <RowGroup>
            <Row icon="🏟" label="Mes concours organisés" onPress={() => router.push('/(v2)/concours?tab=organises' as any)} />
            <Row icon="📊" label="Radar (agrégats RGPD)" onPress={() => router.push('/(tabs)/org-radar' as any)} />
            <Row icon="🏠" label="Mes box proposés" onPress={() => router.push('/(v2)/service/box?face=propose' as any)} />
            <Row icon="⏳" label="Statut" value={caps.isPending('organisateur') ? 'en attente' : 'validé'} />
          </RowGroup>
        </Section>
      )}

      <Section title="Compte">
        <RowGroup>
          <Row icon="🧩" label="Mes activités" value={String(caps.held.length)} onPress={() => router.push('/v2-dev' as any)} />
          <Row icon="⚙️" label="Paramètres" onPress={() => {}} />
          <Row icon="❓" label="Aide & contact" onPress={() => {}} />
        </RowGroup>
      </Section>

      <Placeholder note="fusion des 3 profils V1 + compteurs réels affinés en F9" v1Path="/(tabs)/profil" v1Label="profil actuel" />
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
