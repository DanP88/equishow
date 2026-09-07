// ─────────────────────────────────────────────────────────────────────────────
// AvisV2 — « Mes avis » (F9). Avis REÇUS contextualisés par service + avis
// DÉPOSÉS. LECTURE SEULE (le dépôt d'avis = flux « réservation completed »,
// Phase 2). Repli démo si non connecté.
// ─────────────────────────────────────────────────────────────────────────────
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Spacing, FontSize, FontWeight } from '../../constants/theme';
import { Screen, Card, Section, RowGroup, Row, EmptyState, Placeholder } from '../ui/kit';
import { useV2Avis } from '../adapters/avis';

function stars(n: number) { return '★★★★★'.slice(0, Math.round(n)) + '☆☆☆☆☆'.slice(0, 5 - Math.round(n)); }
function when(iso: string) {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function AvisV2() {
  const a = useV2Avis();

  return (
    <Screen>
      <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/(v2)/profil' as any))} hitSlop={8}>
        <Text style={s.back}>← Profil</Text>
      </TouchableOpacity>
      <Text style={s.h1}>⭐ Mes avis</Text>

      <Card>
        <Text style={s.big}>{a.note ? a.note.toFixed(1) : '—'} <Text style={s.starTxt}>{a.note ? stars(a.note) : ''}</Text></Text>
        <Text style={s.sub}>{a.count} avis reçu{a.count > 1 ? 's' : ''}{a.demo ? ' · démonstration' : ''}</Text>
      </Card>

      {a.buckets.length > 0 ? (
        <Section title="Par contexte">
          {a.buckets.map((b) => (
            <Card key={b.type}>
              <View style={s.bucketHead}>
                <Text style={s.bucketTitle}>{b.icon}  {b.label}</Text>
                <Text style={s.bucketNote}>★ {b.average}  ·  {b.count}</Text>
              </View>
              {b.derniers.map((av) => (
                <View key={av.id} style={s.avis}>
                  <Text style={s.avisHead}>{av.auteur_nom || av.auteur_pseudo || 'Anonyme'} · {stars(av.note)} · {when(av.created_at)}</Text>
                  {av.commentaire ? <Text style={s.avisTxt}>{av.commentaire}</Text> : null}
                </View>
              ))}
            </Card>
          ))}
        </Section>
      ) : (
        <EmptyState icon="⭐" title="Aucun avis reçu pour le moment"
          body="Les avis apparaissent après une prestation terminée (transport, box, coaching, stage)." />
      )}

      <Section title="Avis que j'ai déposés">
        <RowGroup>
          <Row icon="✍️" label="Avis déposés" value={String(a.deposesCount)} />
        </RowGroup>
        <Placeholder note="déposer un avis se fait depuis une réservation terminée (statut « completed ») — flux réel = Phase 2" v1Path="/(tabs)/profil" v1Label="avis (V1)" />
      </Section>
    </Screen>
  );
}

const s = StyleSheet.create({
  back: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.bold, marginBottom: 4 },
  h1: { fontSize: 22, fontWeight: FontWeight.extrabold, color: Colors.textPrimary, letterSpacing: -0.3 },
  big: { fontSize: 30, fontWeight: FontWeight.extrabold, color: Colors.textPrimary },
  starTxt: { fontSize: FontSize.base, color: Colors.warning },
  sub: { fontSize: FontSize.sm, color: Colors.textSecondary },
  bucketHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bucketTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  bucketNote: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.primaryDark },
  avis: { borderTopWidth: 1, borderTopColor: '#F1F0EC', paddingTop: Spacing.sm, marginTop: Spacing.sm, gap: 2 },
  avisHead: { fontSize: FontSize.xs, color: Colors.textTertiary, fontWeight: FontWeight.semibold },
  avisTxt: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 19 },
});
