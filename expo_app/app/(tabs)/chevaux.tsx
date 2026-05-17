import { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image,
  StyleSheet, SafeAreaView, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, CommonStyles } from '../../constants/theme';
import { Cheval, getChevalAge, TypeChevalEmoji } from '../../types/cheval';
import { useMyChevaux } from '../../hooks/useChevaux';
import { useAuth } from '../../hooks/useAuth';
import { useScreenTracking } from '../../hooks/useScreenTracking';
import { trackCta } from '../../lib/analytics';
import { ConfirmModal } from '../../components/ConfirmModal';
import { AlertModal } from '../../components/AlertModal';
import { userStore } from '../../data/store';
import { getPlanLimits } from '../../lib/planLimits';

export default function ChevauxScreen() {
  useScreenTracking('chevaux');
  const { profile } = useAuth();
  const { chevaux, isLoading, createCheval, deleteCheval } = useMyChevaux();
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; nom: string } | null>(null);
  const [errorAlert, setErrorAlert] = useState<string | null>(null);
  const [upgradeAlert, setUpgradeAlert] = useState<{ title: string; message: string } | null>(null);

  function showErr(msg: string) {
    setErrorAlert(msg);
  }

  async function handleAdd() {
    if (creating) return;
    trackCta('chevaux', 'ajouter_cheval');
    if (!profile?.id) {
      showErr('Session non chargée. Reconnectez-vous.');
      return;
    }
    // Gating plan Découverte : 1 cheval maximum
    // Lit `profile.plan` (DB, source de vérité) avec fallback userStore.
    const planSource = (profile as any)?.plan ?? userStore.plan;
    const limits = getPlanLimits(planSource);
    if (chevaux.length >= limits.maxChevaux) {
      setUpgradeAlert({
        title: 'Limite atteinte',
        message: `Le plan ${limits.label} permet ${limits.maxChevaux === 1 ? '1 seul cheval' : `jusqu'à ${limits.maxChevaux} chevaux`}. Passez à un forfait supérieur pour ajouter des chevaux supplémentaires.`,
      });
      return;
    }
    setCreating(true);
    try {
      const { data, error } = await createCheval({ nom: 'Nouveau cheval', type: 'cheval' });
      if (error || !data) {
        console.error('[chevaux] createCheval failed:', error);
        showErr(error ?? "Impossible d'ajouter le cheval.");
        return;
      }
      router.push(`/cheval/${data.id}?new=true`);
    } catch (e) {
      console.error('[chevaux] handleAdd exception:', e);
      showErr(e instanceof Error ? e.message : "Erreur inattendue.");
    } finally {
      setCreating(false);
    }
  }

  function handleDelete(id: string, nom: string) {
    if (deletingId) return;
    trackCta('chevaux', 'supprimer_cheval');
    setPendingDelete({ id, nom });
  }

  function confirmDeletion() {
    if (!pendingDelete) return;
    const id = pendingDelete.id;
    setPendingDelete(null);
    doDelete(id);
  }

  async function doDelete(id: string) {
    setDeletingId(id);
    try {
      const { error } = await deleteCheval(id);
      if (error) {
        console.error('[chevaux] deleteCheval failed:', error);
        showErr(error);
      }
    } finally {
      setDeletingId(null);
    }
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
            <ChevalCard
              key={cheval.id}
              cheval={cheval}
              onPress={() => router.push(`/cheval/${cheval.id}`)}
              onDelete={() => handleDelete(cheval.id, cheval.nom)}
              deleting={deletingId === cheval.id}
            />
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


      <ConfirmModal
        visible={!!pendingDelete}
        title={pendingDelete ? `Supprimer ${pendingDelete.nom} ?` : ''}
        message="Cette action est irréversible. Toutes les données de ce cheval seront perdues."
        cancelLabel="Annuler"
        confirmLabel="Supprimer"
        destructive
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmDeletion}
      />

      <AlertModal
        visible={!!errorAlert}
        title="Erreur"
        message={errorAlert ?? ''}
        variant="error"
        onClose={() => setErrorAlert(null)}
      />

      <ConfirmModal
        visible={!!upgradeAlert}
        title={upgradeAlert?.title ?? ''}
        message={upgradeAlert?.message}
        cancelLabel="Annuler"
        confirmLabel="Voir les forfaits"
        onCancel={() => setUpgradeAlert(null)}
        onConfirm={() => {
          setUpgradeAlert(null);
          router.push('/tarification' as any);
        }}
      />
    </SafeAreaView>
  );
}

function ChevalCard({ cheval, onPress, onDelete, deleting }: {
  cheval: Cheval; onPress: () => void; onDelete: () => void; deleting?: boolean;
}) {
  const age = getChevalAge(cheval.anneeNaissance);
  const emoji = TypeChevalEmoji[cheval.type];
  const subtitle = [cheval.race, cheval.robe, age].filter(Boolean).join(' · ');
  const nextConcours = cheval.concours[0];

  return (
    <View style={styles.cardWrap}>
      <TouchableOpacity style={[styles.card, deleting && { opacity: 0.4 }]} onPress={onPress} activeOpacity={0.85} disabled={deleting}>
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

      <TouchableOpacity
        style={styles.closeBtn}
        onPress={onDelete}
        disabled={deleting}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityLabel={`Supprimer ${cheval.nom}`}
      >
        {deleting ? <ActivityIndicator color={Colors.textInverse} size="small" /> : <Text style={styles.closeBtnText}>×</Text>}
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
  cardWrap: { position: 'relative' },
  closeBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  closeBtnText: { color: Colors.textTertiary, fontSize: 16, fontWeight: FontWeight.semibold, lineHeight: 18 },
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
