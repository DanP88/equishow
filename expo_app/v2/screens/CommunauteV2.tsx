// ─────────────────────────────────────────────────────────────────────────────
// CommunauteV2 — fils Communauté (LOT F10 + lot photos/communauté).
//
// Fils SELON LES CAPACITÉS détenues :
//   🐴 Cavaliers (toujours) · 🎓 Coachs (si capacité coach) · 🏟 Organisateurs
//   (si capacité organisateur).
//
// PUBLICATION RÉELLE (Supabase) : bouton « Partager » → texte + jusqu'à 10 photos
//   → hooks/useCommunautePosts.createPost + lib/communityPhotos (bucket
//   community-photos, colonne posts_*.image_urls mig 108). Comme la V1.
//   Uniquement session RÉELLE. Backend ownership : SHARED.
// Lecture : posts réels via useCommunautePosts (RLS DB). Repli démo si non
//   connecté / fil vide.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { View, Text, Image, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { Colors } from '../../constants/colors';
import { BL } from '../ui/blush';
import { Spacing, Radius, FontSize, FontWeight } from '../../constants/theme';
import { Screen, Segment, Card, Placeholder, EmptyState } from '../ui/kit';
import { useCapabilities } from '../capabilities';
import { PostScope, useCommunautePosts } from '../../hooks/useCommunautePosts';
import { useAuth } from '../../hooks/useAuth';
import { useV2Community, filMeta } from '../adapters/community';
import { pickPostPhotos, uploadPostPhotos, MAX_POST_PHOTOS, type PickedPhoto } from '../../lib/communityPhotos';

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
      <View style={s.head}><Text style={s.h1}>Communauté</Text></View>

      {fils.length > 1 && (
        <Segment options={fils.map((f) => ({ key: f.key, label: f.label }))} value={active} onChange={(k) => setFil(k as PostScope)} />
      )}

      <Composer scope={active} />
      <Fil scope={active} />

      <View style={s.sepNote}>
        <Text style={s.sepTitle}>Où poster quoi ?</Text>
        <Text style={s.sepLine}>• <Text style={s.b}>Communauté</Text> = questions générales, entraide, infos pratiques.</Text>
        <Text style={s.sepLine}>• <Text style={s.b}>Discussion du concours</Text> = échanges autour d’un concours précis (dans sa fiche).</Text>
        <Text style={s.sepLine}>• <Text style={s.b}>Messagerie</Text> = conversations privées 1:1.</Text>
      </View>
    </Screen>
  );
}

// ── Composer (publication réelle) ───────────────────────────────────────────
function Composer({ scope }: { scope: PostScope }) {
  const { profile } = useAuth();
  const { createPost, reload } = useCommunautePosts(scope);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!profile?.id) {
    return (
      <Card>
        <Text style={s.gate}>🔒 Connecte-toi pour publier dans la communauté.</Text>
      </Card>
    );
  }

  const reset = () => { setText(''); setPhotos([]); setErr(null); setOpen(false); };

  const addPhotos = async () => {
    setErr(null);
    const r = await pickPostPhotos(MAX_POST_PHOTOS - photos.length);
    if ('error' in r) { setErr(r.error); return; }
    if ('canceled' in r) return;
    setPhotos((p) => [...p, ...r.photos].slice(0, MAX_POST_PHOTOS));
  };

  const publish = async () => {
    if (busy) return;
    const contenu = text.trim();
    if (!contenu && photos.length === 0) { setErr('Écris un message ou ajoute une photo.'); return; }
    setBusy(true); setErr(null);
    try {
      let paths: string[] = [];
      if (photos.length) {
        const up = await uploadPostPhotos({ userId: profile.id, photos });
        if (up.error) { setErr(up.error); return; }
        paths = up.paths;
      }
      const { error } = await createPost(contenu, paths);
      if (error) { setErr(error); return; }
      reset();
      reload();
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <TouchableOpacity onPress={() => setOpen(true)} activeOpacity={0.8}>
        <Card><Text style={s.composerPrompt}>✏️  Partager quelque chose…</Text></Card>
      </TouchableOpacity>
    );
  }

  return (
    <Card>
      <TextInput
        style={s.composerInput}
        value={text}
        onChangeText={setText}
        placeholder="Ton message pour ce fil…"
        placeholderTextColor={Colors.textTertiary}
        multiline
      />
      {photos.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.thumbs}>
          {photos.map((p, i) => (
            <View key={i} style={s.thumbWrap}>
              <Image source={{ uri: p.uri }} style={s.thumb} />
              <TouchableOpacity style={s.thumbX} onPress={() => setPhotos((cur) => cur.filter((_, j) => j !== i))}>
                <Text style={s.thumbXTxt}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}
      <View style={s.composerRow}>
        <TouchableOpacity onPress={addPhotos} disabled={photos.length >= MAX_POST_PHOTOS || busy} style={s.addPhoto}>
          <Text style={[s.addPhotoTxt, photos.length >= MAX_POST_PHOTOS && { opacity: 0.4 }]}>
            📷 {photos.length}/{MAX_POST_PHOTOS}
          </Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <TouchableOpacity onPress={reset} disabled={busy} style={s.btnGhost}><Text style={s.btnGhostTxt}>Annuler</Text></TouchableOpacity>
        <TouchableOpacity onPress={publish} disabled={busy} style={s.btnPub}>
          {busy ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.btnPubTxt}>Publier</Text>}
        </TouchableOpacity>
      </View>
      {err && <Text style={s.err}>⚠ {err}</Text>}
    </Card>
  );
}

// ── Fil ─────────────────────────────────────────────────────────────────────
function Fil({ scope }: { scope: PostScope }) {
  const { posts, demo } = useV2Community(scope);
  const { deletePost, reload } = useCommunautePosts(scope);

  const onDelete = async (id: string) => {
    const { error } = await deletePost(id);
    if (!error) reload();
  };

  return (
    <View style={{ gap: Spacing.sm, marginTop: Spacing.sm }}>
      {posts.length === 0 ? (
        <EmptyState icon="💬" title="Aucune publication pour le moment"
          body="Ce fil est calme. Sois le premier à publier." />
      ) : posts.map((p) => (
        <Card key={p.id}>
          <View style={s.postHead}>
            <View style={[s.avatar, { backgroundColor: p.couleur }]}><Text style={s.avatarTxt}>{p.initiales}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={s.author}>{p.auteur}</Text>
              <Text style={s.when}>{p.quand}</Text>
            </View>
            {p.mine && (
              <TouchableOpacity onPress={() => onDelete(p.id)} hitSlop={8}><Text style={s.del}>Supprimer</Text></TouchableOpacity>
            )}
          </View>
          {!!p.contenu && <Text style={s.text}>{p.contenu}</Text>}
          {p.photoUrls.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.postPhotos}>
              {p.photoUrls.map((u, i) => <Image key={i} source={{ uri: u }} style={s.postPhoto} />)}
            </ScrollView>
          )}
          <Text style={s.actions}>♥ {p.likes}   💬 {p.commentaires}{p.photos ? `   📷 ${p.photos}` : ''}</Text>
        </Card>
      ))}

      <Placeholder note={demo
        ? 'aperçu de démonstration — connecte-toi pour voir et publier les publications réelles'
        : 'publications réelles (Supabase, partagées avec l’app actuelle) — les likes / commentaires arrivent ensuite'}
        v1Path="/(tabs)/communaute" v1Label="Communauté (V1)" />
    </View>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  h1: { fontSize: FontSize.xxl, fontWeight: FontWeight.extrabold, color: Colors.textPrimary },

  gate: { fontSize: FontSize.sm, color: Colors.textSecondary },
  composerPrompt: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.semibold },
  composerInput: { fontSize: FontSize.sm, color: Colors.textPrimary, minHeight: 60, textAlignVertical: 'top', padding: 0 },
  composerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.sm },
  addPhoto: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1, borderColor: BL.accentLine },
  addPhotoTxt: { fontSize: FontSize.xs, color: BL.accent, fontWeight: FontWeight.bold },
  btnGhost: { paddingVertical: 8, paddingHorizontal: 12 },
  btnGhostTxt: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.semibold },
  btnPub: { paddingVertical: 8, paddingHorizontal: 18, borderRadius: 999, backgroundColor: BL.accent, minWidth: 78, alignItems: 'center' },
  btnPubTxt: { color: '#fff', fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  err: { fontSize: FontSize.xs, color: Colors.urgent, marginTop: 6 },

  thumbs: { gap: 8, paddingVertical: 8 },
  thumbWrap: { position: 'relative' },
  thumb: { width: 72, height: 72, borderRadius: 10, backgroundColor: BL.neutralSoft },
  thumbX: { position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center' },
  thumbXTxt: { color: '#fff', fontSize: 10, fontWeight: '700' },

  postHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  avatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { color: '#fff', fontWeight: FontWeight.bold, fontSize: FontSize.xs },
  author: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  when: { fontSize: FontSize.xs, color: Colors.textTertiary },
  del: { fontSize: FontSize.xs, color: Colors.urgent, fontWeight: FontWeight.bold },
  text: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 19, marginTop: 4 },
  postPhotos: { gap: 8, paddingVertical: 8 },
  postPhoto: { width: 160, height: 160, borderRadius: 12, backgroundColor: BL.neutralSoft },
  actions: { fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: 4 },

  sepNote: { backgroundColor: Colors.surfaceVariant, borderRadius: Radius.md, padding: Spacing.md, gap: 4, marginTop: Spacing.lg },
  sepTitle: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5 },
  sepLine: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 19 },
  b: { fontWeight: FontWeight.bold, color: Colors.textPrimary },
});
