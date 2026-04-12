import { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView,
  TextInput, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, CommonStyles, Shadow } from '../../constants/theme';

interface Comment {
  id: string;
  auteur: string;
  initiales: string;
  couleur: string;
  texte: string;
  date: string;
}

interface Post {
  id: string;
  auteur: string;
  initiales: string;
  couleur: string;
  contenu: string;
  date: Date;
  likes: number;
  liked: boolean;
  commentaires: Comment[];
}

const MOCK_POSTS: Post[] = [
  {
    id: '1',
    auteur: 'Marie Dupont',
    initiales: 'MD',
    couleur: '#7C3AED',
    contenu: 'Super week-end au concours de Lyon ! Éclipse a été parfaite sur le parcours 🏆',
    date: new Date(Date.now() - 2 * 3600000),
    likes: 14,
    liked: false,
    commentaires: [
      { id: 'c1', auteur: 'Thomas Renard', initiales: 'TR', couleur: '#0369A1', texte: 'Bravo ! Quel beau résultat 👏', date: 'Il y a 1h' },
      { id: 'c2', auteur: 'Sophie Martin', initiales: 'SM', couleur: '#16A34A', texte: 'Trop contente pour vous ! À bientôt au prochain concours', date: 'Il y a 45min' },
      { id: 'c3', auteur: 'Pierre Morel', initiales: 'PM', couleur: '#B45309', texte: 'Incroyable parcours !', date: 'Il y a 30min' },
    ],
  },
  {
    id: '2',
    auteur: 'Thomas Renard',
    initiales: 'TR',
    couleur: '#0369A1',
    contenu: "Quelqu'un a une recommandation pour un ostéopathe équin dans la région lyonnaise ?",
    date: new Date(Date.now() - 5 * 3600000),
    likes: 8,
    liked: true,
    commentaires: [
      { id: 'c1', auteur: 'Marie Dupont', initiales: 'MD', couleur: '#7C3AED', texte: 'Dr. Lefèvre à Grenoble, très bon !', date: 'Il y a 4h' },
      { id: 'c2', auteur: 'Lucie Bernard', initiales: 'LB', couleur: '#F97316', texte: 'Je te recommande Sophie Marchand, elle intervient sur tout le bassin lyonnais', date: 'Il y a 3h' },
    ],
  },
  {
    id: '3',
    auteur: 'Sophie Martin',
    initiales: 'SM',
    couleur: '#16A34A',
    contenu: 'Résultats du Championnat Régional de Dressage disponibles ! Bravo à tous les participants 🎉',
    date: new Date(Date.now() - 24 * 3600000),
    likes: 32,
    liked: false,
    commentaires: [
      { id: 'c1', auteur: 'Émilie Laurent', initiales: 'EL', couleur: '#7C3AED', texte: 'Quelle belle compétition, merci aux organisateurs !', date: 'hier' },
    ],
  },
];

function timeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return "À l'instant";
  if (h < 24) return `Il y a ${h}h`;
  return `Il y a ${Math.floor(h / 24)}j`;
}

export default function CommunauteScreen() {
  const [posts, setPosts] = useState<Post[]>(MOCK_POSTS);
  const [showNew, setShowNew] = useState(false);
  const [newText, setNewText] = useState('');
  const [openComments, setOpenComments] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');

  function toggleLike(id: string) {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, liked: !p.liked, likes: p.liked ? p.likes - 1 : p.likes + 1 } : p,
      ),
    );
  }

  function handlePost() {
    if (!newText.trim()) return;
    const post: Post = {
      id: Date.now().toString(),
      auteur: 'Sarah Lefebvre',
      initiales: 'SL',
      couleur: Colors.primary,
      contenu: newText.trim(),
      date: new Date(),
      likes: 0,
      liked: false,
      commentaires: [],
    };
    setPosts((prev) => [post, ...prev]);
    setNewText('');
    setShowNew(false);
  }

  function addComment(postId: string) {
    if (!commentText.trim()) return;
    const c: Comment = {
      id: Date.now().toString(),
      auteur: 'Sarah Lefebvre',
      initiales: 'SL',
      couleur: Colors.primary,
      texte: commentText.trim(),
      date: "À l'instant",
    };
    setPosts((prev) =>
      prev.map((p) => p.id === postId ? { ...p, commentaires: [...p.commentaires, c] } : p),
    );
    setCommentText('');
  }

  const activePost = posts.find((p) => p.id === openComments);

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Communauté</Text>
        <Text style={styles.headerSub}>Échangez avec la communauté équestre</Text>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {posts.map((post) => (
          <View key={post.id} style={styles.card}>
            <TouchableOpacity
              style={styles.postHeader}
              onPress={() => router.push(`/user-profile/${post.auteur}`)}
              activeOpacity={0.7}
            >
              <View style={[styles.avatar, { backgroundColor: post.couleur }]}>
                <Text style={styles.avatarText}>{post.initiales}</Text>
              </View>
              <View style={styles.postMeta}>
                <Text style={styles.auteur}>{post.auteur}</Text>
                <Text style={styles.date}>{timeAgo(post.date)}</Text>
              </View>
            </TouchableOpacity>
            <Text style={styles.contenu}>{post.contenu}</Text>
            <View style={styles.actions}>
              <TouchableOpacity style={styles.actionBtn} onPress={() => toggleLike(post.id)}>
                <Text style={[styles.actionIcon, post.liked && { color: Colors.urgent }]}>
                  {post.liked ? '❤️' : '🤍'}
                </Text>
                <Text style={[styles.actionText, post.liked && { color: Colors.urgent }]}>{post.likes}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={() => { setOpenComments(post.id); setCommentText(''); }}>
                <Text style={styles.actionIcon}>💬</Text>
                <Text style={styles.actionText}>{post.commentaires.length}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* FAB nouveau post */}
      <TouchableOpacity style={styles.fab} onPress={() => setShowNew(true)} activeOpacity={0.85}>
        <Text style={styles.fabText}>+ Publier</Text>
      </TouchableOpacity>

      {/* Modal nouveau post */}
      <Modal visible={showNew} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.newPostModal}>
            <Text style={styles.modalTitle}>Nouveau post</Text>
            <TextInput
              style={styles.modalInput}
              value={newText}
              onChangeText={setNewText}
              placeholder="Partagez quelque chose..."
              placeholderTextColor={Colors.textTertiary}
              multiline
              numberOfLines={4}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowNew(false)}>
                <Text style={styles.modalCancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirm} onPress={handlePost}>
                <Text style={styles.modalConfirmText}>Publier</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal commentaires */}
      <Modal visible={!!openComments} transparent animationType="slide">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <TouchableOpacity style={styles.commentsBackdrop} activeOpacity={1} onPress={() => setOpenComments(null)}>
            <TouchableOpacity activeOpacity={1} style={styles.commentsSheet}>
              <View style={styles.commentsHandle} />
              <Text style={styles.commentsTitle}>
                Commentaires{activePost ? ` (${activePost.commentaires.length})` : ''}
              </Text>
              <ScrollView style={styles.commentsList}>
                {activePost?.commentaires.map((c) => (
                  <View key={c.id} style={styles.commentRow}>
                    <TouchableOpacity
                      onPress={() => {
                        setOpenComments(null);
                        router.push(`/user-profile/${c.auteur}`);
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.commentAvatar, { backgroundColor: c.couleur }]}>
                        <Text style={styles.commentAvatarText}>{c.initiales}</Text>
                      </View>
                    </TouchableOpacity>
                    <View style={styles.commentBubble}>
                      <View style={styles.commentBubbleTop}>
                        <Text style={styles.commentAuteur}>{c.auteur}</Text>
                        <Text style={styles.commentDate}>{c.date}</Text>
                      </View>
                      <Text style={styles.commentTexte}>{c.texte}</Text>
                    </View>
                  </View>
                ))}
                {activePost?.commentaires.length === 0 && (
                  <Text style={styles.noComments}>Soyez le premier à commenter ✨</Text>
                )}
              </ScrollView>
              <View style={styles.commentInputRow}>
                <View style={[styles.commentAvatar, { backgroundColor: Colors.primary }]}>
                  <Text style={styles.commentAvatarText}>SL</Text>
                </View>
                <TextInput
                  style={styles.commentInput}
                  value={commentText}
                  onChangeText={setCommentText}
                  placeholder="Ajouter un commentaire..."
                  placeholderTextColor={Colors.textTertiary}
                  multiline
                />
                <TouchableOpacity
                  style={[styles.commentSendBtn, !commentText.trim() && styles.commentSendBtnDisabled]}
                  onPress={() => openComments && addComment(openComments)}
                  disabled={!commentText.trim()}
                >
                  <Text style={styles.commentSendIcon}>➤</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.extrabold, color: Colors.textPrimary },
  headerSub: { fontSize: FontSize.sm, color: Colors.textTertiary, marginTop: 2 },
  list: { padding: Spacing.lg, gap: Spacing.md },
  card: { ...CommonStyles.card, padding: Spacing.lg },
  postHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.md },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: Colors.textInverse, fontWeight: FontWeight.bold, fontSize: FontSize.sm },
  postMeta: {},
  auteur: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  date: { fontSize: FontSize.xs, color: Colors.textTertiary },
  contenu: { fontSize: FontSize.base, color: Colors.textPrimary, lineHeight: 22, marginBottom: Spacing.md },
  actions: { flexDirection: 'row', gap: Spacing.lg, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.sm },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingVertical: Spacing.xs },
  actionIcon: { fontSize: 18 },
  actionText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.semibold },
  fab: { position: 'absolute', bottom: 100, right: Spacing.lg, backgroundColor: Colors.primary, borderRadius: 28, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, ...Shadow.fab },
  fabText: { color: Colors.textInverse, fontWeight: FontWeight.bold, fontSize: FontSize.base },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  newPostModal: { backgroundColor: Colors.surface, borderRadius: Radius.xxl, padding: Spacing.xl, width: '100%', ...Shadow.modal },
  modalTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.lg },
  modalInput: { borderWidth: 1, borderColor: Colors.borderMedium, borderRadius: Radius.md, padding: Spacing.md, fontSize: FontSize.base, color: Colors.textPrimary, minHeight: 100, textAlignVertical: 'top', marginBottom: Spacing.lg },
  modalActions: { flexDirection: 'row', gap: Spacing.sm },
  modalCancel: { flex: 1, borderWidth: 1, borderColor: Colors.borderMedium, borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center' },
  modalCancelText: { color: Colors.textSecondary, fontWeight: FontWeight.semibold },
  modalConfirm: { flex: 1, backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center' },
  modalConfirmText: { color: Colors.textInverse, fontWeight: FontWeight.bold },

  commentsBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  commentsSheet: { backgroundColor: Colors.surface, borderTopLeftRadius: Radius.xxl, borderTopRightRadius: Radius.xxl, paddingTop: Spacing.md, maxHeight: '80%' },
  commentsHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.borderMedium, alignSelf: 'center', marginBottom: Spacing.md },
  commentsTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary, paddingHorizontal: Spacing.xl, marginBottom: Spacing.md },
  commentsList: { maxHeight: 320, paddingHorizontal: Spacing.lg },
  commentRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md, alignItems: 'flex-start' },
  commentAvatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  commentAvatarText: { color: Colors.textInverse, fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  commentBubble: { flex: 1, backgroundColor: Colors.surfaceVariant, borderRadius: Radius.lg, padding: Spacing.sm + 2, borderWidth: 1, borderColor: Colors.border },
  commentBubbleTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  commentAuteur: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  commentDate: { fontSize: 10, color: Colors.textTertiary },
  commentTexte: { fontSize: FontSize.sm, color: Colors.textPrimary, lineHeight: 18 },
  noComments: { textAlign: 'center', color: Colors.textTertiary, fontSize: FontSize.sm, paddingVertical: Spacing.xl },
  commentInputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm, padding: Spacing.lg, borderTopWidth: 1, borderTopColor: Colors.border },
  commentInput: { flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.xl, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, fontSize: FontSize.base, color: Colors.textPrimary, backgroundColor: Colors.surfaceVariant, maxHeight: 80 },
  commentSendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  commentSendBtnDisabled: { backgroundColor: Colors.borderMedium },
  commentSendIcon: { color: Colors.textInverse, fontSize: 16 },
});
