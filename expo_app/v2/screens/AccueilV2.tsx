// ─────────────────────────────────────────────────────────────────────────────
// AccueilV2 — hiérarchie VALIDÉE (F2) :
//   1. Hero prochain concours  (dominant)
//   2. À traiter               (uniquement si count > 0)
//   3. Je cherche / Je propose (2 tuiles, 1 ligne)
//   4. Raccourcis              (1 ligne)
//   5. Aperçu Communauté       (2 lignes, secondaire)
//   6. Autres concours à venir (sous le pli)
// Fusionne les 4 sous-dashboards V1 (cavalier/coach/organisateur/admin) en un
// seul écran composé par capacités.
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Spacing, FontSize, FontWeight } from '../../constants/theme';
import { Screen, Section, Card, Row, RowGroup, Tile, PrimaryButton } from '../ui/kit';
import { useCapabilities } from '../capabilities';
import { useConcoursList } from '../../hooks/useConcours';
import { useConcoursLocal } from '../state/concoursLocal';
import { MOCK_ACTIONS, MOCK_COMMUNITY } from '../mocks/f2';

function isUpcoming(c: { date_fin: string | null; date_debut: string | null }) {
  const d = c.date_fin ?? c.date_debut;
  if (!d) return true;
  const t = new Date(`${d}T00:00:00`).getTime();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return t >= today.getTime();
}

export function AccueilV2() {
  const caps = useCapabilities();
  const { concours } = useConcoursList();
  const local = useConcoursLocal();

  const upcoming = useMemo(
    () => concours.filter(isUpcoming).slice(0, 6),
    [concours],
  );
  // Hero = 1er concours "suivi" localement, sinon 1er à venir.
  const hero = useMemo(() => {
    const followed = upcoming.find((c) => local.followingIds.includes(c.id) || local.goingIds.includes(c.id));
    return followed ?? upcoming[0] ?? null;
  }, [upcoming, local.followingIds, local.goingIds]);
  const heroEntry = useConcoursLocal(hero?.id);

  const actions = MOCK_ACTIONS.filter((a) => caps.has(a.cap));

  return (
    <Screen>
      {/* 1 — HERO PROCHAIN CONCOURS */}
      {hero ? (
        <Card hero onPress={() => router.push(`/(v2)/concours/${hero.id}` as any)}>
          <Text style={h.kicker}>{heroEntry.entry.going ? 'MON CONCOURS' : 'PROCHAIN CONCOURS'}</Text>
          <Text style={h.title}>🏆 {hero.nom}</Text>
          <Text style={h.meta}>{[hero.type_concours && hero.type_concours !== 'nan' ? hero.type_concours : null, hero.dateLabel, hero.lieu].filter(Boolean).join(' · ')}</Text>

          {(caps.has('coach') || caps.has('organisateur')) && (
            <View style={h.relRow}>
              {caps.has('cavalier') && <Text style={h.rel}>👤 Vous pouvez y participer</Text>}
              {caps.has('coach') && <Text style={h.rel}>🎓 Vous pouvez y coacher</Text>}
              {caps.has('organisateur') && <Text style={h.rel}>🏟 …ou l’organiser</Text>}
            </View>
          )}

          {heroEntry.entry.going ? (
            <>
              <Text style={h.prep}>Préparation ◕ {heroEntry.prepScore}/5</Text>
              <PrimaryButton label="Préparer mon concours" onPress={() => router.push(`/(v2)/concours/${hero.id}/preparer` as any)} />
            </>
          ) : (
            <PrimaryButton label="Voir la fiche du concours" onPress={() => router.push(`/(v2)/concours/${hero.id}` as any)} />
          )}
        </Card>
      ) : (
        <Card hero>
          <Text style={h.title}>🏆 Ton concours, au centre</Text>
          <Text style={h.meta}>Choisis un concours et Equishow t’aide à tout organiser : transport · box · coach · infos.</Text>
          <PrimaryButton label="Trouver mon concours →" onPress={() => router.replace('/(v2)/concours' as any)} />
        </Card>
      )}

      {/* 2 — À TRAITER (conditionnel) */}
      {actions.length > 0 && (
        <Section title={`À traiter · ${actions.length}`}>
          <RowGroup>
            {actions.map((a) => (
              <Row key={a.id} icon={a.icon} label={a.label} onPress={() => router.push(a.target as any)} />
            ))}
          </RowGroup>
        </Section>
      )}

      {/* 3 — JE CHERCHE / JE PROPOSE */}
      <Section title="Organiser un déplacement">
        <View style={{ flexDirection: 'row', gap: Spacing.md }}>
          <Tile icon="🔍" title="Je cherche" sub="transport · box · coach" onPress={() => router.push('/(v2)/cherche' as any)} />
          <Tile icon="📣" title="Je propose" sub="une place · un box · du coaching" onPress={() => router.push('/(v2)/propose' as any)} />
        </View>
      </Section>

      {/* 4 — RACCOURCIS */}
      <View style={h.shortcuts}>
        <Sc icon="🐴" label={caps.has('cavalier') ? 'Chevaux' : 'Chevaux'} onPress={() => router.replace('/(v2)/chevaux' as any)} />
        {caps.has('coach') && <Sc icon="🎓" label="Mes élèves" onPress={() => router.push('/(v2)/service/coach?face=eleves' as any)} />}
        {caps.has('organisateur') && <Sc icon="🏟" label="Mes concours" onPress={() => router.push('/(v2)/concours?tab=organises' as any)} />}
        <Sc icon="🎫" label="Réservations" onPress={() => router.replace('/(v2)/agenda' as any)} />
      </View>

      {/* 5 — APERÇU COMMUNAUTÉ (secondaire, 2 lignes) */}
      <Section title="Communauté" action="Tout voir" onAction={() => router.push('/(v2)/communaute' as any)}>
        <Card>
          {MOCK_COMMUNITY.slice(0, 2).map((p, i) => (
            <Text key={p.id} style={[h.post, i > 0 && { marginTop: 6 }]} numberOfLines={1}>
              <Text style={h.postAuthor}>{p.author} — </Text>{p.text}
            </Text>
          ))}
        </Card>
      </Section>

      {/* 6 — AUTRES CONCOURS À VENIR (sous le pli) */}
      {upcoming.length > 1 && (
        <Section title="Autres concours à venir" action="Tout voir" onAction={() => router.replace('/(v2)/concours' as any)}>
          <RowGroup>
            {upcoming.filter((c) => c.id !== hero?.id).slice(0, 3).map((c) => (
              <Row key={c.id} icon="🏆" label={c.nom} value={c.dateLabel} onPress={() => router.push(`/(v2)/concours/${c.id}` as any)} />
            ))}
          </RowGroup>
        </Section>
      )}
    </Screen>
  );
}

function Sc({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={h.sc} onPress={onPress} activeOpacity={0.7}>
      <Text style={h.scIcon}>{icon}</Text>
      <Text style={h.scLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const h = StyleSheet.create({
  kicker: { fontSize: 11, fontWeight: FontWeight.extrabold, color: Colors.primaryDark, letterSpacing: 0.8, textTransform: 'uppercase' },
  title: { fontSize: 21, fontWeight: FontWeight.extrabold, color: Colors.textPrimary, letterSpacing: -0.3, marginTop: 2 },
  meta: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 19 },
  relRow: { gap: 3, marginTop: 6, paddingTop: 8, borderTopWidth: 1, borderTopColor: Colors.primaryBorder },
  rel: { fontSize: FontSize.sm, color: Colors.primaryDark, fontWeight: FontWeight.semibold },
  prep: { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: FontWeight.bold, marginTop: 4 },
  shortcuts: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: Colors.surface, borderRadius: 16, borderWidth: 1, borderColor: '#ECEBE7', paddingVertical: Spacing.md + 2, marginTop: Spacing.xl },
  sc: { alignItems: 'center', gap: 4, flex: 1 },
  scIcon: { fontSize: 19 },
  scLabel: { fontSize: 11, color: Colors.textSecondary, fontWeight: FontWeight.semibold },
  post: { fontSize: FontSize.sm, color: Colors.textSecondary },
  postAuthor: { fontWeight: FontWeight.bold, color: Colors.textPrimary },
});
