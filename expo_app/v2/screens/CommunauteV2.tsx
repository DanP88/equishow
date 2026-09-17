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
import { router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { BL } from '../ui/blush';
import { Spacing, Radius, FontSize, FontWeight } from '../../constants/theme';
import { Screen, Segment, Card, Placeholder, EmptyState } from '../ui/kit';
import { useCapabilities } from '../capabilities';
import { PostScope } from '../../hooks/useCommunautePosts';
import { useAuth } from '../../hooks/useAuth';
import { useV2Community, filMeta, type V2Community } from '../adapters/community';
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
  // UNE SEULE instance de useV2Community(active) pour tout l'écran (Composer +
  // Fil) : sinon chaque appel séparé du hook a son propre état local, et une
  // mise à jour optimiste (like/commentaire/publication) dans l'un ne se
  // reflète jamais dans l'autre avant le round-trip realtime → ressenti « pas
  // instantané ».
  const community = useV2Community(active);

  return (
    <Screen>
      <View style={s.head}><Text style={s.h1}>Communauté</Text></View>

      {fils.length > 1 && (
        <Segment options={fils.map((f) => ({ key: f.key, label: f.label }))} value={active} onChange={(k) => setFil(k as PostScope)} />
      )}

      <Composer community={community} />
      <Fil community={community} />

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
function Composer({ community }: { community: V2Community }) {
  const { profile } = useAuth();
  const { createPost } = community;
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
const MAX_COMMENT_PHOTOS = 5;

function Fil({ community }: { community: V2Community }) {
  const { profile } = useAuth();
  const { posts, demo, toggleLike, addComment, deletePost } = community;
  const [openComments, setOpenComments] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [commentPhotos, setCommentPhotos] = useState<Record<string, PickedPhoto[]>>({});
  const [sending, setSending] = useState<string | null>(null);
  const [photoErr, setPhotoErr] = useState<string | null>(null);

  const canInteract = !demo && !!profile?.id;

  const onDelete = async (id: string) => {
    await deletePost(id);
  };

  const onLike = async (id: string) => {
    if (!canInteract) return;
    await toggleLike(id);
  };

  const onAddCommentPhotos = async (postId: string) => {
    const current = commentPhotos[postId] ?? [];
    setPhotoErr(null);
    const r = await pickPostPhotos(MAX_COMMENT_PHOTOS - current.length);
    if ('error' in r) { setPhotoErr(r.error); return; }
    if ('canceled' in r) return;
    setCommentPhotos((m) => ({ ...m, [postId]: [...current, ...r.photos].slice(0, MAX_COMMENT_PHOTOS) }));
  };

  const onSendComment = async (postId: string) => {
    const texte = (drafts[postId] ?? '').trim();
    const photos = commentPhotos[postId] ?? [];
    if ((!texte && photos.length === 0) || !canInteract || sending) return;
    setSending(postId);
    setPhotoErr(null);
    try {
      let paths: string[] = [];
      if (photos.length) {
        const up = await uploadPostPhotos({ userId: profile!.id, photos });
        if (up.error) { setPhotoErr(up.error); return; }
        paths = up.paths;
      }
      const { error } = await addComment(postId, texte, paths);
      if (!error) {
        setDrafts((d) => ({ ...d, [postId]: '' }));
        setCommentPhotos((m) => ({ ...m, [postId]: [] }));
      }
    } finally {
      setSending(null);
    }
  };

  return (
    <View style={{ gap: Spacing.sm, marginTop: Spacing.sm }}>
      {posts.length === 0 ? (
        <EmptyState icon="💬" title="Aucune publication pour le moment"
          body="Ce fil est calme. Sois le premier à publier." />
      ) : posts.map((p) => {
        const commentsOpen = openComments === p.id;
        return (
          <Card key={p.id}>
            <View style={s.postHead}>
              <TouchableOpacity
                style={s.postHeadIdentity}
                disabled={!p.auteurId}
                onPress={() => router.push(`/user-profile/${p.auteurId}` as any)}
                hitSlop={4}
              >
                <View style={[s.avatar, { backgroundColor: p.couleur }]}><Text style={s.avatarTxt}>{p.initiales}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.author}>{p.auteur}</Text>
                  <Text style={s.when}>{p.quand}</Text>
                </View>
              </TouchableOpacity>
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

            <View style={s.actionsRow}>
              <TouchableOpacity style={s.actionBtn} onPress={() => onLike(p.id)} disabled={!canInteract} hitSlop={6}>
                <Text style={[s.actionTxt, p.likedByMe && s.actionTxtOn]}>{p.likedByMe ? '♥' : '♡'} {p.likes}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.actionBtn} onPress={() => setOpenComments(commentsOpen ? null : p.id)} hitSlop={6}>
                <Text style={s.actionTxt}>💬 {p.commentaires.length}</Text>
              </TouchableOpacity>
              {p.photos > 0 && <Text style={s.actionTxt}>📷 {p.photos}</Text>}
            </View>

            {commentsOpen && (
              <View style={s.commentsBox}>
                {p.commentaires.length === 0 ? (
                  <Text style={s.noComment}>Aucun commentaire — sois le premier.</Text>
                ) : p.commentaires.map((c) => (
                  <View key={c.id} style={s.commentRow}>
                    <View style={[s.avatarSm, { backgroundColor: c.couleur }]}><Text style={s.avatarSmTxt}>{c.initiales}</Text></View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.commentAuthor}>{c.auteur} <Text style={s.commentWhen}>· {c.quand}</Text></Text>
                      {!!c.texte && <Text style={s.commentTxt}>{c.texte}</Text>}
                      {c.photoUrls.length > 0 && (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.commentPhotos}>
                          {c.photoUrls.map((u, i) => <Image key={i} source={{ uri: u }} style={s.commentPhoto} />)}
                        </ScrollView>
                      )}
                    </View>
                  </View>
                ))}
                {canInteract && (
                  <View style={{ gap: 6 }}>
                    {(commentPhotos[p.id]?.length ?? 0) > 0 && (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.thumbs}>
                        {commentPhotos[p.id].map((ph, i) => (
                          <View key={i} style={s.thumbWrap}>
                            <Image source={{ uri: ph.uri }} style={s.commentThumb} />
                            <TouchableOpacity
                              style={s.thumbX}
                              onPress={() => setCommentPhotos((m) => ({ ...m, [p.id]: m[p.id].filter((_, j) => j !== i) }))}
                            >
                              <Text style={s.thumbXTxt}>✕</Text>
                            </TouchableOpacity>
                          </View>
                        ))}
                      </ScrollView>
                    )}
                    <View style={s.commentInputRow}>
                      <TouchableOpacity
                        onPress={() => onAddCommentPhotos(p.id)}
                        disabled={(commentPhotos[p.id]?.length ?? 0) >= MAX_COMMENT_PHOTOS || sending === p.id}
                        style={s.commentPhotoBtn}
                      >
                        <Text style={s.commentPhotoBtnTxt}>📷 {commentPhotos[p.id]?.length ?? 0}/{MAX_COMMENT_PHOTOS}</Text>
                      </TouchableOpacity>
                      <TextInput
                        style={s.commentInput}
                        value={drafts[p.id] ?? ''}
                        onChangeText={(t) => setDrafts((d) => ({ ...d, [p.id]: t }))}
                        placeholder="Écrire un commentaire…"
                        placeholderTextColor={Colors.textTertiary}
                        returnKeyType="send"
                        onSubmitEditing={() => onSendComment(p.id)}
                      />
                      <TouchableOpacity
                        onPress={() => onSendComment(p.id)}
                        disabled={sending === p.id || (!(drafts[p.id] ?? '').trim() && (commentPhotos[p.id]?.length ?? 0) === 0)}
                        style={s.commentSend}
                      >
                        {sending === p.id ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.commentSendTxt}>Envoyer</Text>}
                      </TouchableOpacity>
                    </View>
                    {!!photoErr && <Text style={s.err}>⚠ {photoErr}</Text>}
                  </View>
                )}
              </View>
            )}
          </Card>
        );
      })}

      <Placeholder note={demo
        ? 'aperçu de démonstration — connecte-toi pour liker, commenter et publier'
        : 'publications, likes et commentaires réels (Supabase, partagés avec l’app actuelle)'}
        v1Path="/(tabs)/communaute" v1Label="Communauté" />
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
  postHeadIdentity: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 },
  avatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { color: '#fff', fontWeight: FontWeight.bold, fontSize: FontSize.xs },
  author: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  when: { fontSize: FontSize.xs, color: Colors.textTertiary },
  del: { fontSize: FontSize.xs, color: Colors.urgent, fontWeight: FontWeight.bold },
  text: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 19, marginTop: 4 },
  postPhotos: { gap: 8, paddingVertical: 8 },
  postPhoto: { width: 160, height: 160, borderRadius: 12, backgroundColor: BL.neutralSoft },
  actions: { fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: 4 },

  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg, marginTop: 6 },
  actionBtn: { flexDirection: 'row', alignItems: 'center' },
  actionTxt: { fontSize: FontSize.xs, color: Colors.textTertiary, fontWeight: FontWeight.semibold },
  actionTxtOn: { color: BL.berry },

  commentsBox: { marginTop: Spacing.sm, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: BL.line, gap: Spacing.sm },
  noComment: { fontSize: FontSize.xs, color: Colors.textTertiary, fontStyle: 'italic' },
  commentRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start' },
  avatarSm: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  avatarSmTxt: { color: '#fff', fontWeight: FontWeight.bold, fontSize: 9 },
  commentAuthor: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  commentWhen: { fontWeight: FontWeight.regular, color: Colors.textTertiary },
  commentTxt: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 1 },
  commentPhotos: { gap: 6, paddingVertical: 6 },
  commentPhoto: { width: 72, height: 72, borderRadius: 8, backgroundColor: BL.neutralSoft },
  commentThumb: { width: 48, height: 48, borderRadius: 8, backgroundColor: BL.neutralSoft },
  commentInputRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: 2 },
  commentPhotoBtn: { paddingVertical: 8, paddingHorizontal: 8, borderRadius: 999, borderWidth: 1, borderColor: BL.accentLine },
  commentPhotoBtnTxt: { fontSize: 10, color: BL.accent, fontWeight: FontWeight.bold },
  commentInput: { flex: 1, fontSize: FontSize.sm, color: Colors.textPrimary, borderWidth: 1, borderColor: BL.line, borderRadius: 999, paddingHorizontal: Spacing.md, paddingVertical: 8, backgroundColor: BL.bg },
  commentSend: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, backgroundColor: BL.accent, minWidth: 66, alignItems: 'center' },
  commentSendTxt: { color: '#fff', fontSize: FontSize.xs, fontWeight: FontWeight.bold },

  sepNote: { backgroundColor: Colors.surfaceVariant, borderRadius: Radius.md, padding: Spacing.md, gap: 4, marginTop: Spacing.lg },
  sepTitle: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5 },
  sepLine: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 19 },
  b: { fontWeight: FontWeight.bold, color: Colors.textPrimary },
});
