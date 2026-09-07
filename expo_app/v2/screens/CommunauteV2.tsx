// ─────────────────────────────────────────────────────────────────────────────
// CommunauteV2 — fils Communauté (LOT F10). PAS dans la bottom bar : atteint
// depuis l'aperçu Accueil.
//
// Fils SELON LES CAPACITÉS détenues (jamais selon un « mode ») :
//   🐴 Cavaliers (toujours) · 🎓 Coachs (si capacité coach) · 🏟 Organisateurs
//   (si capacité organisateur). Activités simultanées, aucun sélecteur de rôle.
//
// LECTURE SEULE : posts réels via useCommunautePosts (RLS DB). Publier / liker /
// commenter = flux Supabase → Phase 2. Repli démo si non connecté / fil vide.
//
// Séparation : Communauté (public) ≠ Discussion concours (contextuelle) ≠
// Messagerie (privée).
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, FontWeight } from '../../constants/theme';
import { Screen, Segment, Card, Placeholder, EmptyState } from '../ui/kit';
import { useCapabilities } from '../capabilities';
import { PostScope } from '../../hooks/useCommunautePosts';
import { useV2Community, filMeta } from '../adapters/community';

export function CommunauteV2() {
  const caps = useCapabilities();

  const fils: { key: PostScope; label: string }[] = [
    { key: 'community', label: `${filMeta('community').icon} Cavaliers` },
    ...(caps.has('coach') ? [{ key: 'coach' as PostScope, label: `${filMeta('coach').icon} Coachs` }] : []),
    ...(caps.has('organisateur') ? [{ key: 'organisateur' as PostScope, label: `${filMeta('organisateur').icon} Organisateurs` }] : []),
  ];
  const [fil, setFil] = useState<PostScope>('community');
  const active: PostScope = fils.some((f) => f.key === fil) ? fil : 'community';

  return (
    <Screen>
      <View style={s.head}>
        <Text style={s.h1}>Communauté</Text>
      </View>

      {fils.length > 1 && (
        <Segment options={fils.map((f) => ({ key: f.key, label: f.label }))} value={active} onChange={(k) => setFil(k as PostScope)} />
      )}

      <Fil scope={active} />

      <View style={s.sepNote}>
        <Text style={s.sepTitle}>Où poster quoi ?</Text>
        <Text style={s.sepLine}>• <Text style={s.b}>Communauté</Text> = questions générales, entraide, infos pratiques (fil selon vos activités).</Text>
        <Text style={s.sepLine}>• <Text style={s.b}>Discussion du concours</Text> = échanges autour d’un concours précis (dans sa fiche).</Text>
        <Text style={s.sepLine}>• <Text style={s.b}>Messagerie</Text> = conversations privées 1:1.</Text>
      </View>
    </Screen>
  );
}

function Fil({ scope }: { scope: PostScope }) {
  const { posts, demo } = useV2Community(scope);

  return (
    <View style={{ gap: Spacing.sm, marginTop: Spacing.sm }}>
      {posts.length === 0 ? (
        <EmptyState icon="💬" title="Aucune publication pour le moment"
          body="Ce fil est calme. Les publications de ce groupe apparaîtront ici." />
      ) : posts.map((p) => (
        <Card key={p.id}>
          <View style={s.postHead}>
            <View style={[s.avatar, { backgroundColor: p.couleur }]}><Text style={s.avatarTxt}>{p.initiales}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={s.author}>{p.auteur}</Text>
              <Text style={s.when}>{p.quand}</Text>
            </View>
          </View>
          {!!p.contenu && <Text style={s.text}>{p.contenu}</Text>}
          <Text style={s.actions}>
            ♥ {p.likes}   💬 {p.commentaires}{p.photos ? `   📷 ${p.photos}` : ''}
          </Text>
        </Card>
      ))}

      <Placeholder note={demo
        ? 'aperçu de démonstration — connectez-vous pour voir les publications réelles de ce groupe'
        : 'publications réelles (lecture seule en V2) — publier / liker / commenter = Phase 2'}
        v1Path="/(tabs)/communaute" v1Label="Communauté (V1)" />
    </View>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  h1: { fontSize: FontSize.xxl, fontWeight: FontWeight.extrabold, color: Colors.textPrimary },

  postHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  avatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { color: '#fff', fontWeight: FontWeight.bold, fontSize: FontSize.xs },
  author: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  when: { fontSize: FontSize.xs, color: Colors.textTertiary },
  text: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 19 },
  actions: { fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: 2 },

  sepNote: { backgroundColor: Colors.surfaceVariant, borderRadius: Radius.md, padding: Spacing.md, gap: 4, marginTop: Spacing.lg },
  sepTitle: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5 },
  sepLine: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 19 },
  b: { fontWeight: FontWeight.bold, color: Colors.textPrimary },
});
