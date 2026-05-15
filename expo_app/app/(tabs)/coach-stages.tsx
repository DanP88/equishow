import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView,
  Alert, Platform, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../../constants/theme';
import { useMyStages } from '../../hooks/useStages';
import { CoachStage } from '../../types/service';

export default function CoachStagesScreen() {
  const { stages: myStages, isLoading, deleteStage } = useMyStages();

  function showErr(msg: string) {
    if (typeof window !== 'undefined' && typeof window.alert === 'function') window.alert(msg);
    else Alert.alert('Erreur', msg);
  }

  async function doDelete(id: string) {
    const { error } = await deleteStage(id);
    if (error) showErr(error);
  }

  function handleCancelStage(id: string) {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm('Retirer ce stage ?\nCette action est irréversible.')) doDelete(id);
      return;
    }
    Alert.alert('Retirer le stage', 'Êtes-vous sûr(e) de vouloir retirer ce stage ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Retirer', style: 'destructive', onPress: () => doDelete(id) },
    ]);
  }

  return (
    <SafeAreaView style={s.root}>
      <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={s.header}>
          <Text style={s.headerTitle}>Mes Stages</Text>
          <TouchableOpacity
            style={s.newBtn}
            onPress={() => router.push('/proposer-stage')}
          >
            <Text style={s.newBtnText}>+ Nouveau</Text>
          </TouchableOpacity>
        </View>

        {/* Stages List */}
        {myStages.length === 0 ? (
          <View style={s.emptyState}>
            <Text style={s.emptyIcon}>📚</Text>
            <Text style={s.emptyTitle}>Aucun stage proposé</Text>
            <Text style={s.emptyText}>Proposez votre premier stage de formation</Text>
            <TouchableOpacity
              style={s.emptyBtn}
              onPress={() => router.push('/proposer-stage')}
            >
              <Text style={s.emptyBtnText}>Proposer un stage</Text>
            </TouchableOpacity>
          </View>
        ) : (
          myStages.map((stage) => (
            <StageCard
              key={stage.id}
              stage={stage}
              onCancel={() => handleCancelStage(stage.id)}
            />
          ))
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

interface StageCardProps {
  stage: CoachStage;
  onCancel: () => void;
}

function StageCard({ stage, onCancel }: StageCardProps) {
  return (
    <View style={s.stageCard}>
      <View style={s.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={s.stageTitle}>{stage.titre}</Text>
          <Text style={s.stageDates}>
            {stage.dateDebut.toLocaleDateString('fr-FR')} → {stage.dateFin.toLocaleDateString('fr-FR')}
          </Text>
        </View>
        <View style={s.stageBadge}>
          <Text style={s.stageBadgeText}>{stage.nbJours}j</Text>
        </View>
      </View>

      <View style={s.infoRow}>
        <Text style={s.infoLabel}>🎯 Disciplines</Text>
        <Text style={s.infoValue}>{stage.disciplines.join(', ')}</Text>
      </View>

      <View style={s.infoRow}>
        <Text style={s.infoLabel}>📊 Niveaux</Text>
        <Text style={s.infoValue}>{stage.niveaux.join(', ')}</Text>
      </View>

      <View style={s.infoRow}>
        <Text style={s.infoLabel}>👥 Places</Text>
        <Text style={s.infoValue}>{stage.placesDisponibles}/{stage.places}</Text>
      </View>

      <View style={s.infoRow}>
        <Text style={s.infoLabel}>💳 Tarif</Text>
        <Text style={s.priceValue}>{stage.prixTTC}€ TTC</Text>
      </View>

      {stage.description && (
        <View style={s.descriptionContainer}>
          <Text style={s.descriptionText}>{stage.description}</Text>
        </View>
      )}

      <View style={s.actions}>
        <TouchableOpacity style={s.actionBtn}>
          <Text style={s.actionBtnText}>Modifier</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.actionBtn, s.actionBtnDelete]}
          onPress={onCancel}
        >
          <Text style={s.actionBtnDeleteText}>Retirer</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  container: { padding: Spacing.lg, gap: Spacing.lg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  headerTitle: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  newBtn: { backgroundColor: Colors.primary, borderRadius: Radius.lg, paddingVertical: Spacing.sm + 2, paddingHorizontal: Spacing.md },
  newBtnText: { color: Colors.textInverse, fontWeight: FontWeight.bold, fontSize: FontSize.sm },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.xl },
  emptyIcon: { fontSize: 64, marginBottom: Spacing.lg },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.sm },
  emptyText: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.lg },
  emptyBtn: { backgroundColor: Colors.primary, borderRadius: Radius.lg, paddingVertical: Spacing.md + 4, paddingHorizontal: Spacing.lg },
  emptyBtnText: { color: Colors.textInverse, fontWeight: FontWeight.bold, fontSize: FontSize.base },
  stageCard: { backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, ...Shadow.card, gap: Spacing.md },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: Spacing.md },
  stageTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary, flex: 1 },
  stageDates: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: Spacing.xs },
  stageBadge: { backgroundColor: Colors.primaryLight, borderRadius: Radius.md, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderWidth: 1, borderColor: Colors.primaryBorder },
  stageBadgeText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.primary },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border },
  infoLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  infoValue: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textPrimary, textAlign: 'right', flex: 1, marginLeft: Spacing.md },
  priceValue: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.primary, textAlign: 'right', flex: 1, marginLeft: Spacing.md },
  descriptionContainer: { backgroundColor: Colors.background, borderRadius: Radius.md, padding: Spacing.md, marginTop: Spacing.sm },
  descriptionText: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  actions: { flexDirection: 'row', gap: Spacing.md },
  actionBtn: { flex: 1, backgroundColor: Colors.primaryLight, borderRadius: Radius.md, paddingVertical: Spacing.sm + 2, alignItems: 'center' },
  actionBtnText: { fontWeight: FontWeight.bold, fontSize: FontSize.sm, color: Colors.primary },
  actionBtnDelete: { backgroundColor: Colors.urgentBg },
  actionBtnDeleteText: { fontWeight: FontWeight.bold, fontSize: FontSize.sm, color: Colors.danger },
});
