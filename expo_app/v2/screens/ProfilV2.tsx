// ─────────────────────────────────────────────────────────────────────────────
// ProfilV2 — onglet 👤. UN SEUL profil = UNE personne.
// En-tête : identité + vérifié + note + « Activités : … » (libellés, pas des
// boutons) + compteurs d'activité RÉELS (F9). Puis un bloc par capacité détenue.
// Aucun profil-coach / profil-org séparé. Aucun « changer de compte ».
// ─────────────────────────────────────────────────────────────────────────────
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { BL } from '../ui/blush';
import { Spacing, FontSize, FontWeight } from '../../constants/theme';
import { Screen, Card, Row, RowGroup, Section, Placeholder } from '../ui/kit';
import { useCapabilities, CAPABILITY_LABEL } from '../capabilities';
import { useV2Session } from '../auth';
import { useV2ActivityCounts } from '../state/activityCounts';
import { Icon } from '../ui/Icon';
import { useAuth } from '../../hooks/useAuth';

export function ProfilV2() {
  const caps = useCapabilities();
  const { identity, kind, signOut: signOutSim } = useV2Session();
  const { logout } = useAuth();
  const a = useV2ActivityCounts();

  // Déconnexion — réutilise le mécanisme EXISTANT (V1 useAuth.logout / session V2
  // simulée). Aucune modification de Supabase Auth.
  const handleLogout = async () => {
    if (kind === 'real') {
      await logout();
      router.replace('/(auth)/login');
    } else {
      signOutSim();
      router.replace('/(v2)/accueil');
    }
  };

  const name = `${identity?.prenom ?? ''} ${identity?.nom ?? ''}`.trim() || 'Utilisateur EquiShow';
  const activities = caps.held.map((c) => CAPABILITY_LABEL[c] + (caps.isPending(c) ? ' (en attente)' : '')).join(' · ') || '—';

  const counters: { icon: string; n: number }[] = [
    { icon: 'horse', n: a.chevaux },
    { icon: 'trophy-outline', n: a.concoursSuivis },
    { icon: 'truck-outline', n: a.transports },
    { icon: 'home-variant-outline', n: a.box },
    { icon: 'school-outline', n: a.coachings },
  ].filter((c) => c.n > 0);

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
        <View style={s.counters}>
          {counters.length === 0
            ? <Text style={s.counterEmpty}>Aucune activité pour le moment</Text>
            : counters.map((c) => (
                <View key={c.icon} style={s.counterItem}>
                  <Icon name={c.icon} size={15} color={Colors.textSecondary} />
                  <Text style={s.counterN}>{c.n}</Text>
                </View>
              ))}
          {a.demo && counters.length > 0 ? <Text style={s.counterAperçu}>· aperçu</Text> : null}
        </View>
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
          <Row icon="puzzle-outline" label="Mes activités" value={String(caps.held.length)} onPress={() => router.push('/v2-dev' as any)} />
          <Row icon="cog-outline" label="Paramètres" onPress={() => {}} />
          <Row icon="help-circle-outline" label="Aide & contact" onPress={() => {}} />
        </RowGroup>
        <TouchableOpacity style={s.logout} onPress={handleLogout} activeOpacity={0.8}>
          <Icon name="logout" size={16} color={Colors.urgent} />
          <Text style={s.logoutTxt}>Se déconnecter</Text>
        </TouchableOpacity>
      </Section>

      <Placeholder note={a.demo
        ? 'compteurs = aperçu de démonstration (non connecté) — se remplissent avec vos vraies activités une fois connecté'
        : 'compteurs réels : activité V1 (lecture seule) + activité simulée V2'} v1Path="/(tabs)/profil" v1Label="profil actuel" />
    </Screen>
  );
}

const s = StyleSheet.create({
  headRow: { flexDirection: 'row', gap: Spacing.md, alignItems: 'center' },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: BL.accent, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { color: Colors.textInverse, fontWeight: FontWeight.extrabold, fontSize: FontSize.lg },
  name: { fontSize: FontSize.lg, fontWeight: FontWeight.extrabold, color: Colors.textPrimary },
  verif: { fontSize: FontSize.sm, color: Colors.textSecondary },
  activities: { fontSize: FontSize.sm, color: BL.accent, fontWeight: FontWeight.semibold, marginTop: 2 },
  counters: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flexWrap: 'wrap', marginTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.sm },
  counterItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  counterN: { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: FontWeight.bold },
  counterEmpty: { fontSize: FontSize.sm, color: Colors.textTertiary },
  counterAperçu: { fontSize: FontSize.xs, color: Colors.textTertiary, fontStyle: 'italic' },
  pending: { fontSize: FontSize.xs, color: Colors.warning, fontWeight: FontWeight.bold },
  logout: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: Spacing.sm, paddingVertical: Spacing.md, borderRadius: 12, borderWidth: 1, borderColor: Colors.urgentBorder, backgroundColor: Colors.urgentBg },
  logoutTxt: { color: Colors.urgent, fontWeight: FontWeight.bold, fontSize: FontSize.sm },
});
