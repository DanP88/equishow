import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
} from 'react-native';
import { Post, Comment } from '../hooks/usePosts';
import { usePostMutations } from '../hooks/usePosts';
import { useAuth } from '../hooks/useAuth';
import { Colors } from '../constants/colors';
import { Spacing, Radius, FontSize, FontWeight } from '../constants/theme';

type PostType = 'community' | 'coach' | 'organisateur';

interface PostCardProps {
  post: Post;
  type: PostType;
  onRefresh: () => Promise<void>;
}

export default function PostCard({ post, type, onRefresh }: PostCardProps) {
  const { profile } = useAuth();
  const { deletePost, updatePost, isDeleting, isUpdating } = usePostMutations(type);
  const [showComments, setShowComments] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editTitre, setEditTitre] = useState(post.titre);
  const [editContenu, setEditContenu] = useState(post.contenu);

  const isAuthor = profile?.id === post.auteur_id;
  const formattedDate = new Date(post.created_at).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const handleUpdate = async () => {
    if (!editTitre.trim() || !editContenu.trim()) {
      Alert.alert('Erreur', 'Veuillez remplir le titre et le contenu');
      return;
    }

    const { error } = await updatePost(post.id, {
      titre: editTitre.trim(),
      contenu: editContenu.trim(),
    });

    if (error) {
      Alert.alert('Erreur', error);
    } else {
      Alert.alert('Succès', 'Post modifié avec succès!');
      setShowEditModal(false);
      await onRefresh();
    }
  };

  const handleDelete = async () => {
    Alert.alert(
      'Supprimer le post',
      'Êtes-vous sûr de vouloir supprimer ce post?',
      [
        { text: 'Annuler', onPress: () => {} },
        {
          text: 'Supprimer',
          onPress: async () => {
            const { error } = await deletePost(post.id);
            if (error) {
              Alert.alert('Erreur', error);
            } else {
              Alert.alert('Succès', 'Post supprimé');
              await onRefresh();
            }
          },
        },
      ]
    );
  };

  return (
    <View style={s.card}>
      {/* Header */}
      <View style={s.header}>
        <View style={s.authorInfo}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>
              {post.auteur_nom.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={s.authorMeta}>
            <Text style={s.authorName}>{post.auteur_nom}</Text>
            <Text style={s.date}>{formattedDate}</Text>
          </View>
        </View>

        {isAuthor && (
          <View style={s.authorActions}>
            <TouchableOpacity
              style={s.editBtn}
              onPress={() => setShowEditModal(true)}
            >
              <Text style={s.editBtnText}>✎</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.deleteBtn}
              onPress={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <ActivityIndicator size="small" color={Colors.danger} />
              ) : (
                <Text style={s.deleteBtnText}>✕</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Title */}
      <Text style={s.title}>{post.titre}</Text>

      {/* Content */}
      <Text style={s.contenu}>{post.contenu}</Text>

      {/* Footer */}
      <View style={s.footer}>
        <View style={s.stats}>
          <View style={s.stat}>
            <Text style={s.statIcon}>❤️</Text>
            <Text style={s.statText}>{post.nb_likes}</Text>
          </View>
          <View style={s.stat}>
            <Text style={s.statIcon}>💬</Text>
            <Text style={s.statText}>{post.nb_commentaires}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={s.commentsBtn}
          onPress={() => setShowComments(!showComments)}
        >
          <Text style={s.commentsBtnText}>
            {showComments ? 'Masquer' : 'Voir'} commentaires
          </Text>
        </TouchableOpacity>
      </View>

      {/* Comments Section */}
      {showComments && (
        <CommentSection postId={post.id} type={type} />
      )}

      {/* Edit Modal */}
      <Modal
        visible={showEditModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEditModal(false)}
      >
        <TouchableOpacity
          style={s.backdrop}
          activeOpacity={1}
          onPress={() => setShowEditModal(false)}
        >
          <TouchableOpacity activeOpacity={1} style={s.editModal}>
            <Text style={s.editModalTitle}>Modifier l'article</Text>

            <TextInput
              style={s.editInput}
              placeholder="Titre"
              value={editTitre}
              onChangeText={setEditTitre}
              editable={!isUpdating}
            />

            <TextInput
              style={[s.editInput, s.editTextArea]}
              placeholder="Contenu"
              value={editContenu}
              onChangeText={setEditContenu}
              multiline
              editable={!isUpdating}
            />

            <View style={s.editButtons}>
              <TouchableOpacity
                style={[s.editCancelBtn]}
                onPress={() => setShowEditModal(false)}
              >
                <Text style={s.editCancelBtnText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.editSaveBtn, isUpdating && s.editSaveBtnDisabled]}
                onPress={handleUpdate}
                disabled={isUpdating}
              >
                {isUpdating ? (
                  <ActivityIndicator color={Colors.textInverse} size="small" />
                ) : (
                  <Text style={s.editSaveBtnText}>Enregistrer</Text>
                )}
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

// Comment Section Component
function CommentSection({ postId, type }: { postId: string; type: PostType }) {
  const { useComments, useCommentMutations } = require('../hooks/usePosts');
  const { comments, isLoading } = useComments(postId, type);
  const { createComment, deleteComment } = useCommentMutations(type);
  const { profile } = useAuth();
  const [commentText, setCommentText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddComment = async () => {
    if (!commentText.trim()) {
      Alert.alert('Erreur', 'Veuillez écrire un commentaire');
      return;
    }

    setIsSubmitting(true);
    const { error } = await createComment(postId, { contenu: commentText.trim() });
    setIsSubmitting(false);

    if (error) {
      Alert.alert('Erreur', error);
    } else {
      setCommentText('');
    }
  };

  if (isLoading) {
    return (
      <View style={s.commentsContainer}>
        <ActivityIndicator size="small" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={s.commentsContainer}>
      {/* Comments List */}
      {comments.length > 0 && (
        <View style={s.commentsList}>
          {comments.map((comment: Comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              isAuthor={profile?.id === comment.auteur_id}
              onDelete={deleteComment}
              type={type}
            />
          ))}
        </View>
      )}

      {/* Add Comment */}
      <View style={s.addCommentContainer}>
        <Text style={s.addCommentLabel}>Ajouter un commentaire</Text>
        <View style={s.commentInputContainer}>
          <View style={s.input}>
            <Text style={s.avatarSmall}>
              {profile?.prenom?.charAt(0) || '?'}
            </Text>
            <TextInput
              style={s.commentInput}
              placeholder="Écrivez votre commentaire..."
              value={commentText}
              onChangeText={setCommentText}
              multiline
              editable={!isSubmitting}
            />
          </View>
          <TouchableOpacity
            style={[s.submitCommentBtn, isSubmitting && s.submitCommentBtnDisabled]}
            onPress={handleAddComment}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color={Colors.textInverse} />
            ) : (
              <Text style={s.submitCommentBtnText}>✓</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// Comment Item Component
function CommentItem({
  comment,
  isAuthor,
  onDelete,
  type,
}: {
  comment: any;
  isAuthor: boolean;
  onDelete: (commentId: string) => Promise<{ error: string | null }>;
  type: PostType;
}) {
  const [isDeleting, setIsDeleting] = useState(false);

  const formattedDate = new Date(comment.created_at).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const handleDelete = async () => {
    Alert.alert(
      'Supprimer le commentaire',
      'Êtes-vous sûr?',
      [
        { text: 'Annuler', onPress: () => {} },
        {
          text: 'Supprimer',
          onPress: async () => {
            setIsDeleting(true);
            const { error } = await onDelete(comment.id);
            setIsDeleting(false);
            if (error) Alert.alert('Erreur', error);
          },
        },
      ]
    );
  };

  return (
    <View style={s.commentItem}>
      <View style={s.commentHeader}>
        <View style={s.commentAuthor}>
          <Text style={s.avatarSmall}>{comment.auteur_nom.charAt(0)}</Text>
          <View>
            <Text style={s.commentAuthorName}>{comment.auteur_nom}</Text>
            <Text style={s.commentDate}>{formattedDate}</Text>
          </View>
        </View>
        {isAuthor && (
          <TouchableOpacity onPress={handleDelete} disabled={isDeleting}>
            {isDeleting ? (
              <ActivityIndicator size="small" color={Colors.danger} />
            ) : (
              <Text style={s.deleteCommentBtn}>✕</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
      <Text style={s.commentText}>{comment.contenu}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  authorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  avatarText: {
    color: Colors.textInverse,
    fontWeight: FontWeight.bold,
    fontSize: FontSize.base,
  },
  authorMeta: {
    flex: 1,
  },
  authorName: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  date: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  authorActions: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  editBtn: {
    padding: Spacing.sm,
  },
  editBtnText: {
    fontSize: 18,
    color: Colors.primary,
  },
  deleteBtn: {
    padding: Spacing.sm,
  },
  deleteBtnText: {
    fontSize: 18,
    color: Colors.danger,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
  },
  editModal: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    width: '100%',
    gap: Spacing.md,
  },
  editModalTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  editInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    backgroundColor: Colors.background,
  },
  editTextArea: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  editButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  editCancelBtn: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.border,
    alignItems: 'center',
  },
  editCancelBtnText: {
    color: Colors.textPrimary,
    fontWeight: FontWeight.bold,
    fontSize: FontSize.sm,
  },
  editSaveBtn: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
  editSaveBtnDisabled: {
    opacity: 0.6,
  },
  editSaveBtnText: {
    color: Colors.textInverse,
    fontWeight: FontWeight.bold,
    fontSize: FontSize.sm,
  },
  title: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  contenu: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  stats: {
    flexDirection: 'row',
    gap: Spacing.lg,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  statIcon: {
    fontSize: 14,
  },
  statText: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
  },
  commentsBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.md,
    backgroundColor: Colors.primaryLight,
  },
  commentsBtnText: {
    fontSize: FontSize.xs,
    color: Colors.primary,
    fontWeight: FontWeight.bold,
  },
  commentsContainer: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  commentsList: {
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  commentItem: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  commentAuthor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  avatarSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    color: Colors.textInverse,
    justifyContent: 'center',
    alignItems: 'center',
    textAlign: 'center',
    lineHeight: 28,
    fontWeight: FontWeight.bold,
  },
  commentAuthorName: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  commentDate: {
    fontSize: 10,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  deleteCommentBtn: {
    fontSize: 16,
    color: Colors.danger,
  },
  commentText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  addCommentContainer: {
    gap: Spacing.sm,
  },
  addCommentLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
  },
  commentInputContainer: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  commentInput: {
    flex: 1,
    paddingVertical: Spacing.sm,
    fontSize: FontSize.xs,
    color: Colors.textPrimary,
    maxHeight: 60,
  },
  submitCommentBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitCommentBtnDisabled: {
    opacity: 0.6,
  },
  submitCommentBtnText: {
    fontSize: 16,
    color: Colors.textInverse,
    fontWeight: FontWeight.bold,
  },
});
