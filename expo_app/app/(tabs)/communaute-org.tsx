import { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView,
  TextInput, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, CommonStyles, Shadow } from '../../constants/theme';
import { userStore } from '../../data/store';
import { createNotification } from '../../hooks/useNotifications';
import { useCommunautePosts } from '../../hooks/useCommunautePosts';
import { useScreenTracking } from '../../hooks/useScreenTracking';

function timeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return "À l'instant";
  if (h < 24) return `Il y a ${h}h`;
  return `Il y a ${Math.floor(h / 24)}j`;
}

function getUserInitiales(): string {
  return (userStore.prenom.charAt(0) + userStore.nom.charAt(0)).toUpperCase();
}

export default function CommunauteOrgScreen() {
  useScreenTracking('communaute-org');
  const { posts, createPost, toggleLike: hookToggleLike, addComment: hookAddComment, toggleCommentLike: hookToggleCommentLike } = useCommunautePosts('organisateur');
  const [showNew, setShowNew] = useState(false);
  const [newText, setNewText] = useState('');
  const [openComments, setOpenComments] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');

  async function toggleLike(postId: string) {
    const post = posts.find(p => p.id === postId);
    if (!post) return;
    const already = post.likedBy.includes(userStore.id);
    await hookToggleLike(postId);
    if (!already && post.auteurId !== userStore.id) {
      await createNotification({
        destinataireId: post.auteurId,
        type: 'like',
        titre: `❤️ @${userStore.pseudo} a aimé votre post`,
        message: post.contenu.length > 60 ? post.contenu.slice(0, 60) + '…' : post.contenu,
        donnees: { postId, scope: 'organisateur' },
      });
    }
  }

  async function handlePost() {
    if (!newText.trim()) return;
    await createPost(newText.trim());
    setNewText('');
    setShowNew(false);
  }

  async function addComment(postId: string) {
    if (!commentText.trim()) return;
    const trimmed = commentText.trim();
    const post = posts.find(p => p.id === postId);
    await hookAddComment(postId, trimmed);
    setCommentText('');
    if (post && post.auteurId !== userStore.id) {
      await createNotification({
        destinataireId: post.auteurId,
        type: 'comment',
        titre: `💬 @${userStore.pseudo} a commenté votre post`,
        message: trimmed.length > 60 ? trimmed.slice(0, 60) + '…' : trimmed,
        donnees: { postId, scope: 'organisateur' },
      });
    }
  }

  async function toggleCommentLike(postId: string, commentId: string) {
    await hookToggleCommentLike(postId, commentId);
  }

  const activePost = openComments ? posts.find((p) => p.id === openComments) ?? null : null;

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>👥 Communauté Organisateurs</Text>
        <Text style={styles.headerSub}>Partages et bonnes pratiques d'organisation</Text>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {posts.length === 0 && (
          <Text style={styles.empty}>Aucun post pour le moment. Soyez le premier ✨</Text>
        )}
        {posts.map((post) => {
          const liked = post.likedBy.includes(userStore.id);
          return (
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
                  <Text style={[styles.actionIcon, liked && { color: Colors.urgent }]}>
                    {liked ? '❤️' : '🤍'}
                  </Text>
                  <Text style={[styles.actionText, liked && { color: Colors.urgent }]}>{post.likes}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn} onPress={() => { setOpenComments(post.id); setCommentText(''); }}>
                  <Text style={styles.actionIcon}>💬</Text>
                  <Text style={styles.actionText}>{post.commentaires.length}</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
        <View style={{ height: 100 }} />
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={() => setShowNew(true)} activeOpacity={0.85}>
        <Text style={styles.fabText}>+ Publier</Text>
      </TouchableOpacity>

      <Modal visible={showNew} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.newPostModal}>
            <Text style={styles.modalTitle}>Nouveau post (Organisateurs)</Text>
            <TextInput
              style={styles.modalInput}
              value={newText}
              onChangeText={setNewText}
              placeholder="Partagez quelque chose entre organisateurs..."
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

      <Modal visible={!!openComments} transparent animationType="slide">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <TouchableOpacity style={styles.commentsBackdrop} activeOpacity={1} onPress={() => setOpenComments(null)}>
            <TouchableOpacity activeOpacity={1} style={styles.commentsSheet}>
              <View style={styles.commentsHandle} />
              <Text style={styles.commentsTitle}>
                Commentaires{activePost ? ` (${activePost.commentaires.length})` : ''}
              </Text>
              <ScrollView style={styles.commentsList}>
                {activePost?.commentaires.map((c) => {
                  const cmtLiked = c.likedBy.includes(userStore.id);
                  return (
                    <View key={c.id} style={styles.commentRow}>
                      <TouchableOpacity
                        onPress={() => { setOpenComments(null); router.push(`/user-profile/${c.auteur}`); }}
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
                        <TouchableOpacity
                          style={styles.commentLikeBtn}
                          onPress={() => openComments && toggleCommentLike(openComments, c.id)}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.commentLikeIcon, cmtLiked && { color: Colors.urgent }]}>
                            {cmtLiked ? '❤️' : '🤍'}
                          </Text>
                          {c.likes > 0 && (
                            <Text style={[styles.commentLikeCount, cmtLiked && { color: Colors.urgent }]}>
                              {c.likes}
                            </Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
                {activePost?.commentaires.length === 0 && (
                  <Text style={styles.noComments}>Soyez le premier à commenter ✨</Text>
                )}
              </ScrollView>
              <View style={styles.commentInputRow}>
                <View style={[styles.commentAvatar, { backgroundColor: userStore.avatarColor }]}>
                  <Text style={styles.commentAvatarText}>{getUserInitiales()}</Text>
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
  empty: { textAlign: 'center', color: Colors.textTertiary, fontSize: FontSize.sm, paddingVertical: Spacing.xxl },
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
  commentLikeBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4, alignSelf: 'flex-start' },
  commentLikeIcon: { fontSize: 13 },
  commentLikeCount: { fontSize: 11, color: Colors.textTertiary, fontWeight: FontWeight.semibold },
  noComments: { textAlign: 'center', color: Colors.textTertiary, fontSize: FontSize.sm, paddingVertical: Spacing.xl },
  commentInputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm, padding: Spacing.lg, borderTopWidth: 1, borderTopColor: Colors.border },
  commentInput: { flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.xl, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, fontSize: FontSize.base, color: Colors.textPrimary, backgroundColor: Colors.surfaceVariant, maxHeight: 80 },
  commentSendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  commentSendBtnDisabled: { backgroundColor: Colors.borderMedium },
  commentSendIcon: { color: Colors.textInverse, fontSize: 16 },
});
