// ─────────────────────────────────────────────────────────────────────────────
// AccueilV2 — récap personnel (F13).
//   0. Bonjour {Prénom}
//   1. « Votre prochain concours » — 0 / 1 / plusieurs concours PERTINENTS
//      (= suivis ou « J'y serai »). AUCUN concours n'est jamais auto-sélectionné :
//      sans présence pertinente → invite à en trouver un.
//   2. À traiter (si count > 0)
//   3. Je cherche / Je propose
//   4. Raccourcis (Cavalier → Coach → Organisateur)
//   5. Aperçu Communauté
//   6. Concours à venir (découverte — clairement une liste, pas une sélection)
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Spacing, FontSize, FontWeight } from '../../constants/theme';
import { Screen, Section, Card, Row, RowGroup, Tile, PrimaryButton, GhostButton } from '../ui/kit';
import { useV2Session } from '../auth';
import { useConcoursList } from '../../hooks/useConcours';
import { useConcoursLocal } from '../state/concoursLocal';
import { useV2Todo } from '../adapters/todo';
import { useV2Community } from '../adapters/community';

function isUpcoming(c: { date_fin: string | null; date_debut: string | null }) {
  const d = c.date_fin ?? c.date_debut;
  if (!d) return true;
  const t = new Date(`${d}T00:00:00`).getTime();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return t >= today.getTime();
}

export function AccueilV2() {
  const { identity } = useV2Session();
  const { concours } = useConcoursList();
  const local = useConcoursLocal();

  // Liste réelle triée par date (useConcoursList = statut='publie', ascendant).
  const upcoming = useMemo(() => concours.filter(isUpcoming), [concours]);

  // Concours PERTINENTS = ceux que la personne suit / où elle a dit « J'y serai ».
  // Rien d'autre n'est présenté comme « son » concours.
  const pertinents = useMemo(
    () => upcoming.filter((c) => local.followingIds.includes(c.id) || local.goingIds.includes(c.id)),
    [upcoming, local.followingIds, local.goingIds],
  );
  const next = pertinents[0] ?? null;
  const nextEntry = useConcoursLocal(next?.id);
  const others = pertinents.length - 1;

  const { items: actions } = useV2Todo();
  const communityPreview = useV2Community('community').posts.slice(0, 2);

  const prenom = identity?.prenom?.trim();

  return (
    <Screen>
      {/* 0 — SALUTATION */}
      <View style={h.hello}>
        <Text style={h.helloTitle}>{prenom ? `Bonjour ${prenom},` : 'Bonjour,'}</Text>
        <Text style={h.helloSub}>Voici le récap du moment.</Text>
      </View>

      {/* 1 — VOTRE PROCHAIN CONCOURS */}
      {!next ? (
        <Card>
          <Text style={h.kicker}>Votre prochain concours</Text>
          <Text style={h.emptyTitle}>Vous n'avez pas encore de concours prévu.</Text>
          <Text style={h.meta}>Sur EquiShow, tout part d'un concours : transport, box, coach, infos, discussions.</Text>
          <PrimaryButton label="Trouver un concours" onPress={() => router.replace('/(v2)/concours' as any)} />
        </Card>
      ) : (
        <Card hero onPress={() => router.push(`/(v2)/concours/${next.id}` as any)}>
          <Text style={h.kicker}>
            Votre prochain concours{nextEntry.entry.going ? '  ·  vous y participez' : nextEntry.entry.following ? '  ·  suivi' : ''}
          </Text>
          <Text style={h.title}>{next.nom}</Text>
          <Text style={h.meta}>
            {[next.type_concours && next.type_concours !== 'nan' ? next.type_concours : null, next.dateLabel, next.lieu].filter(Boolean).join(' · ')}
          </Text>

          {nextEntry.entry.going ? (
            <>
              <Text style={h.prep}>Préparation {nextEntry.prepScore}/5</Text>
              <PrimaryButton label="Préparer mon concours" onPress={() => router.push(`/(v2)/concours/${next.id}/preparer` as any)} />
            </>
          ) : (
            <PrimaryButton label="Voir la fiche du concours" onPress={() => router.push(`/(v2)/concours/${next.id}` as any)} />
          )}

          {others > 0 && (
            <GhostButton label={`+ ${others} autre${others > 1 ? 's' : ''} concours à venir — Voir mes concours`} onPress={() => router.replace('/(v2)/concours?tab=suivis' as any)} />
          )}
        </Card>
      )}

      {/* 2 — À TRAITER */}
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
          <Tile icon="magnify" title="Je cherche" sub="transport · box · coach" onPress={() => router.push('/(v2)/cherche' as any)} />
          <Tile icon="bullhorn-outline" title="Je propose" sub="une place · un box · du coaching" onPress={() => router.push('/(v2)/propose' as any)} />
        </View>
      </Section>

      {/* 4 — APERÇU COMMUNAUTÉ */}
      {communityPreview.length > 0 && (
        <Section title="Communauté" action="Tout voir" onAction={() => router.replace('/(v2)/communaute' as any)}>
          <Card>
            {communityPreview.map((p, i) => (
              <Text key={p.id} style={[h.post, i > 0 && { marginTop: 6 }]} numberOfLines={1}>
                <Text style={h.postAuthor}>{p.auteur} — </Text>{p.contenu}
              </Text>
            ))}
          </Card>
        </Section>
      )}

      {/* 6 — CONCOURS À VENIR (découverte) */}
      {upcoming.length > 0 && (
        <Section title="Concours à venir" action="Tout voir" onAction={() => router.replace('/(v2)/concours' as any)}>
          <RowGroup>
            {upcoming.filter((c) => c.id !== next?.id).slice(0, 3).map((c) => (
              <Row key={c.id} icon="trophy-outline" label={c.nom} value={c.dateLabel} onPress={() => router.push(`/(v2)/concours/${c.id}` as any)} />
            ))}
          </RowGroup>
        </Section>
      )}
    </Screen>
  );
}

const h = StyleSheet.create({
  hello: { marginBottom: 2 },
  helloTitle: { fontSize: 20, fontWeight: FontWeight.extrabold, color: Colors.textPrimary, letterSpacing: -0.3 },
  helloSub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 1 },

  kicker: { fontSize: 11, fontWeight: FontWeight.extrabold, color: Colors.primaryDark, letterSpacing: 0.6, textTransform: 'uppercase' },
  title: { fontSize: 20, fontWeight: FontWeight.extrabold, color: Colors.textPrimary, letterSpacing: -0.3, marginTop: 3 },
  emptyTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginTop: 3 },
  meta: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 19 },

  prep: { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: FontWeight.bold, marginTop: 6 },

  post: { fontSize: FontSize.sm, color: Colors.textSecondary },
  postAuthor: { fontWeight: FontWeight.bold, color: Colors.textPrimary },
});
