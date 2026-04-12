import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { Colors } from '../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, CommonStyles } from '../constants/theme';
import { useAvis, Avis } from '../hooks/useAvis';
import { useAuth } from '../hooks/useAuth';

interface AvisSectionProps {
  userId: string;
}

export function AvisSection({ userId }: AvisSectionProps) {
  const { profile } = useAuth();
  const { avis, isLoading, averageRating, totalReviews, createAvis, deleteAvis } = useAvis(userId);
  const [showForm, setShowForm] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!profile) return;

    setIsSubmitting(true);
    try {
      const { error } = await createAvis(userId, rating, comment);
      if (!error) {
        setRating(5);
        setComment('');
        setShowForm(false);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const canCreateReview = profile?.id !== userId;
  const userReview = avis.find((a) => a.auteur_id === profile?.id);

  return (
    <>
      <View style={styles.section}>
        <View style={styles.header}>
          <Text style={styles.title}>Avis</Text>
          <View style={styles.ratingBadge}>
            <Text style={styles.ratingText}>⭐ {averageRating}</Text>
            <Text style={styles.countText}>({totalReviews})</Text>
          </View>
        </View>

        {canCreateReview && !userReview && (
          <TouchableOpacity
            style={styles.addReviewBtn}
            onPress={() => setShowForm(!showForm)}
          >
            <Text style={styles.addReviewText}>+ Ajouter un avis</Text>
          </TouchableOpacity>
        )}

        {isLoading ? (
          <ActivityIndicator size="large" color={Colors.primary} style={styles.loader} />
        ) : avis.length === 0 ? (
          <Text style={styles.emptyText}>Aucun avis pour le moment</Text>
        ) : (
          <FlatList
            data={avis}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <AvisCard
                avis={item}
                canDelete={profile?.id === item.auteur_id}
                onDelete={() => deleteAvis(item.id)}
              />
            )}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        )}
      </View>

      {/* Review Form Modal */}
      <Modal visible={showForm} transparent animationType="slide">
        <View style={styles.backdrop}>
          <View style={styles.formSheet}>
            <Text style={styles.formTitle}>Laisser un avis</Text>

            <Text style={styles.label}>Note</Text>
            <View style={styles.ratingSelector}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  onPress={() => setRating(star)}
                  style={styles.starBtn}
                >
                  <Text style={styles.starIcon}>
                    {star <= rating ? '⭐' : '☆'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Commentaire (optionnel)</Text>
            <TextInput
              style={styles.commentInput}
              placeholder="Partagez votre expérience..."
              placeholderTextColor={Colors.textTertiary}
              value={comment}
              onChangeText={setComment}
              multiline
              numberOfLines={4}
            />

            <View style={styles.formActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setShowForm(false)}
                disabled={isSubmitting}
              >
                <Text style={styles.cancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]}
                onPress={handleSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color={Colors.textInverse} />
                ) : (
                  <Text style={styles.submitText}>Envoyer</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

interface AvisCardProps {
  avis: Avis;
  canDelete: boolean;
  onDelete: () => void;
}

function AvisCard({ avis, canDelete, onDelete }: AvisCardProps) {
  return (
    <View style={styles.avisCard}>
      <View style={styles.avisHeader}>
        <View>
          <Text style={styles.avisAuthor}>{avis.auteur_nom}</Text>
          <Text style={styles.avisDate}>
            {new Date(avis.created_at).toLocaleDateString('fr-FR')}
          </Text>
        </View>
        <View style={styles.avisRating}>
          <Text style={styles.avisStars}>{'⭐'.repeat(avis.note)}</Text>
          <Text style={styles.avisNote}>{avis.note}/5</Text>
        </View>
      </View>

      {avis.commentaire && (
        <Text style={styles.avisComment}>{avis.commentaire}</Text>
      )}

      {canDelete && (
        <TouchableOpacity style={styles.deleteBtn} onPress={onDelete}>
          <Text style={styles.deleteText}>Supprimer</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { ...CommonStyles.card, marginBottom: Spacing.lg, overflow: 'hidden' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.goldBg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.md,
  },
  ratingText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.gold,
  },
  countText: {
    fontSize: FontSize.xs,
    color: Colors.gold,
  },
  addReviewBtn: {
    margin: Spacing.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: Radius.md,
    alignItems: 'center',
  },
  addReviewText: {
    color: Colors.primary,
    fontWeight: FontWeight.semibold,
  },
  loader: {
    paddingVertical: Spacing.xl,
  },
  emptyText: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
    textAlign: 'center',
    paddingVertical: Spacing.lg,
  },
  separator: {
    height: 1,
    backgroundColor: Colors.border,
  },

  // Avis Card
  avisCard: {
    padding: Spacing.lg,
    backgroundColor: Colors.background,
    marginHorizontal: Spacing.lg,
    marginVertical: Spacing.sm,
    borderRadius: Radius.md,
  },
  avisHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  avisAuthor: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  avisDate: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    marginTop: Spacing.xs,
  },
  avisRating: {
    alignItems: 'flex-end',
  },
  avisStars: {
    fontSize: 14,
    marginBottom: Spacing.xs,
  },
  avisNote: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.gold,
  },
  avisComment: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  deleteBtn: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.sm,
    backgroundColor: Colors.urgentBg,
  },
  deleteText: {
    fontSize: FontSize.xs,
    color: Colors.urgent,
    fontWeight: FontWeight.semibold,
  },

  // Form Modal
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  formSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.xl,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  formTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.extrabold,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  label: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
  },
  ratingSelector: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  starBtn: {
    padding: Spacing.md,
  },
  starIcon: {
    fontSize: 28,
  },
  commentInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
    backgroundColor: Colors.surfaceVariant,
    height: 100,
    textAlignVertical: 'top',
    marginBottom: Spacing.lg,
  },
  formActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.borderMedium,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  cancelText: {
    color: Colors.textSecondary,
    fontWeight: FontWeight.semibold,
  },
  submitBtn: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitText: {
    color: Colors.textInverse,
    fontWeight: FontWeight.bold,
  },
});
