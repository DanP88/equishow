import { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image,
  StyleSheet, SafeAreaView, Alert, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, CommonStyles } from '../../constants/theme';
import { Cheval, getChevalAge, TypeChevalEmoji } from '../../types/cheval';
import { useMyChevaux } from '../../hooks/useChevaux';

export default function ChevauxScreen() {
  const { chevaux, isLoading, createCheval, deleteCheval } = useMyChevaux();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  async function handleAdd() {
    if (creating) return;
    setCreating(true);
    try {
      const { data, error } = await createCheval({ nom: 'Nouveau cheval', type: 'cheval' });
      if (error || !data) {
        Alert.alert('Erreur', error ?? "Impossible d'ajouter le cheval.");
        return;
      }
      router.push(`/cheval/${data.id}?new=true`);
    } finally {
      setCreating(false);
    }
  }

  function handleDelete(id: string) {
    Alert.alert(
      'Supprimer ce cheval ?',
      'Cette action est irréversible.',
      [
        { text: 'Annuler', style: 'cancel', onPress: () => setDeletingId(null) },
        {
          text: 'Supprimer', style: 'destructive', onPress: async () => {
            const { error } = await deleteCheval(id);
            if (error) Alert.alert('Erreur', error);
            setDeletingId(null);
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Mes Chevaux</Text>
          <Text style={styles.headerSub}>{chevaux.length} chevaux</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {isLoading && chevaux.length === 0 ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: Spacing.xl }} />
        ) : (
          chevaux.map((cheval) => (
            <View key={cheval.id}>
              <ChevalCard
                cheval={cheval}
                onPress={() => { setDeletingId(null); router.push(`/cheval/${cheval.id}`); }}
                onLongPress={() => setDeletingId(deletingId === cheval.id ? null : cheval.id)}
                dimmed={deletingId !== null && deletingId !== cheval.id}
              />
              {deletingId === cheval.id && (
                <View style={styles.deleteRow}>
                  <TouchableOpacity style={styles.deleteCancelBtn} onPress={() => setDeletingId(null)}>
                    <Text style={styles.deleteCancelText}>Annuler</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.deleteConfirmBtn} onPress={() => handleDelete(cheval.id)}>
                    <Text style={styles.deleteConfirmText}>🗑 Supprimer ce cheval</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))
        )}

        <TouchableOpacity
          style={[styles.addCard, creating && { opacity: 0.6 }]}
          onPress={handleAdd}
          disabled={creating}
          activeOpacity={0.8}
        >
          <Text style={styles.addIcon}>+</Text>
          <Text style={styles.addText}>{creating ? 'Création…' : 'Ajouter un cheval'}</Text>
        </TouchableOpacity>
      </ScrollView>

    </SafeAreaView>
  );
}

function ChevalCard({ cheval, onPress, onLongPress, dimmed }: {
  cheval: Cheval; onPress: () => void; onLongPress?: () => void; dimmed?: boolean;
}) {
  const age = getChevalAge(cheval.anneeNaissance);
  const emoji = TypeChevalEmoji[cheval.type];
  const subtitle = [cheval.race, cheval.robe, age].filter(Boolean).join(' · ');
  const nextConcours = cheval.concours[0];

  return (
    <View>
      <TouchableOpacity style={[styles.card, dimmed && { opacity: 0.4 }]} onPress={onPress} onLongPress={onLongPress} activeOpacity={0.85}>
        <View style={[styles.cardAvatar, { backgroundColor: cheval.photoColor ?? Colors.primaryLight, overflow: 'hidden' }]}>
          {cheval.photoUrl ? (
            <Image source={{ uri: cheval.photoUrl }} style={{ width: '100%', height: '100%' }} />
          ) : (
            <Text style={styles.cardAvatarEmoji}>{emoji}</Text>
          )}
        </View>

        <View style={styles.cardContent}>
          <View style={styles.cardTop}>
            <View style={[styles.typeBadge, { backgroundColor: Colors.primaryLight }]}>
              <Text style={styles.typeBadgeText}>{cheval.type === 'cheval' ? 'Cheval' : 'Poney'}</Text>
            </View>
          </View>
          <Text style={styles.cardName}>{cheval.nom}</Text>
          {subtitle ? <Text style={styles.cardSub}>{subtitle}</Text> : null}

          {cheval.disciplines.length > 0 && (
            <View style={styles.chips}>
              {cheval.disciplines.map((d) => (
                <View key={d} style={[styles.chip, { backgroundColor: Colors.successBg, borderColor: Colors.successBorder }]}>
                  <Text style={[styles.chipText, { color: Colors.success }]}>{d}</Text>
                </View>
              ))}
            </View>
          )}

          {nextConcours && (
            <View style={styles.nextConcours}>
              <Text style={styles.nextConcoursText}>
                🏆 {nextConcours.nom} · {nextConcours.date instanceof Date
                  ? nextConcours.date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
                  : new Date(nextConcours.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>

    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.extrabold, color: Colors.textPrimary },
  headerSub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  list: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 100 },
  card: {
    ...CommonStyles.card,
    padding: Spacing.lg,
    flexDirection: 'row',
    gap: Spacing.md,
  },
  cardAvatar: {
    width: 56,
    height: 56,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardAvatarEmoji: { fontSize: 28 },
  cardContent: { flex: 1 },
  cardTop: { flexDirection: 'row', marginBottom: Spacing.xs },
  typeBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.xs },
  typeBadgeText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.primary },
  cardName: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: 2 },
  cardSub: { fontSize: FontSize.sm, color: Colors.textSecondary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginTop: Spacing.sm },
  chip: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.xs, borderWidth: 1 },
  chipText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  nextConcours: { marginTop: Spacing.sm, backgroundColor: Colors.goldBg, borderRadius: Radius.sm, padding: Spacing.xs + 2 },
  nextConcoursText: { fontSize: FontSize.xs, color: Colors.gold, fontWeight: FontWeight.semibold },
  deleteRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: -Spacing.sm, marginBottom: Spacing.xs, paddingHorizontal: 2 },
  deleteCancelBtn: { flex: 1, borderWidth: 1, borderColor: Colors.borderMedium, borderRadius: Radius.md, paddingVertical: Spacing.sm, alignItems: 'center', backgroundColor: Colors.surface },
  deleteCancelText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.semibold },
  deleteConfirmBtn: { flex: 2, backgroundColor: Colors.urgent, borderRadius: Radius.md, paddingVertical: Spacing.sm, alignItems: 'center' },
  deleteConfirmText: { fontSize: FontSize.sm, color: Colors.textInverse, fontWeight: FontWeight.bold },
  addCard: {
    borderWidth: 1.5,
    borderColor: Colors.primaryBorder,
    borderStyle: 'dashed',
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primaryLight,
  },
  addIcon: { fontSize: 28, color: Colors.primary },
  addText: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.primary },
});
