import { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { Colors } from '../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../constants/theme';
import { userStore } from '../data/store';
import { useMyCourseDemands } from '../hooks/useCourseDemands';
import { useCoursePayment } from '../hooks/useCoursePayment';
import { useMyStageReservations } from '../hooks/useStages';
import { useStagePayment } from '../hooks/useStagePayment';

export default function PendingPaymentsScreen() {
  const { demands } = useMyCourseDemands();
  const { reservations: stageReservations } = useMyStageReservations();
  const { payCourse } = useCoursePayment();
  const { payStage } = useStagePayment();

  // Loading par card (id de la résa en cours de paiement). Avant on partageait
  // `loading` entre toutes les cards → cliquer "Payer" sur 1 résa déclenchait
  // l'état loading sur les 2 autres résa visibles, donnant l'illusion d'un
  // paiement multi. Bug constaté en prod 2026-05-31 par user.
  const [payingId, setPayingId] = useState<string | null>(null);

  const validatedDemands = demands.filter(
    d => d.cavalierUserId === userStore.id && d.statut === 'accepted'
  );
  const validatedStages = stageReservations.filter(
    r => r.cavalierUserId === userStore.id && r.statut === 'accepted'
  );
  const totalToPay = validatedDemands.length + validatedStages.length;

  const handlePayCourse = async (demand: typeof validatedDemands[number]) => {
    if (payingId) return;
    setPayingId(demand.id);
    try { await payCourse(demand); } finally { setPayingId(null); }
  };
  const handlePayStage = async (reservation: typeof validatedStages[number]) => {
    if (payingId) return;
    setPayingId(reservation.id);
    try { await payStage(reservation); } finally { setPayingId(null); }
  };

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Demandes prêtes à payer</Text>
        {totalToPay > 0 && (
          <View style={s.badge}>
            <Text style={s.badgeText}>{totalToPay}</Text>
          </View>
        )}
      </View>

      {totalToPay === 0 ? (
        <View style={s.emptyState}>
          <Text style={s.emptyIcon}>💰</Text>
          <Text style={s.emptyTitle}>Pas de paiement en attente</Text>
          <Text style={s.emptyText}>Vos demandes validées apparaîtront ici</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.container}>
          {validatedDemands.map(demand => (
            <View
              key={demand.id}
              style={s.card}
            >
              <View style={s.cardHeader}>
                <View>
                  <Text style={s.coachName}>{demand.coachNom}</Text>
                  <Text style={s.annonceTitle}>{demand.annonceTitre}</Text>
                </View>
                <View style={s.priceBadge}>
                  <Text style={s.priceText}>{demand.prix}€</Text>
                </View>
              </View>

              <View style={s.detailsRow}>
                <Text style={s.label}>📅 Dates:</Text>
                <Text style={s.value}>
                  {demand.dateDebut.toLocaleDateString('fr-FR')} → {demand.dateFin.toLocaleDateString('fr-FR')}
                </Text>
              </View>

              <View style={s.detailsRow}>
                <Text style={s.label}>🐴 Cheval:</Text>
                <Text style={s.value}>{demand.cheval}</Text>
              </View>

              <View style={s.statusBadge}>
                <Text style={s.statusText}>✅ Validée par le coach</Text>
              </View>

              <TouchableOpacity
                style={[s.btn, s.payBtn]}
                onPress={() => handlePayCourse(demand)}
                disabled={!!payingId}
              >
                {payingId === demand.id ? (
                  <ActivityIndicator color={Colors.textInverse} />
                ) : (
                  <Text style={s.payBtnText}>💳 Payer maintenant</Text>
                )}
              </TouchableOpacity>
            </View>
          ))}

          {validatedStages.map(reservation => (
            <View key={reservation.id} style={s.card}>
              <View style={s.cardHeader}>
                <View>
                  <Text style={s.coachName}>{reservation.coachNom}</Text>
                  <Text style={s.annonceTitle}>🎓 {reservation.stageTitre}</Text>
                </View>
                <View style={s.priceBadge}>
                  <Text style={s.priceText}>{reservation.prixTotal}€</Text>
                </View>
              </View>

              <View style={s.detailsRow}>
                <Text style={s.label}>👥 Places:</Text>
                <Text style={s.value}>{reservation.nombreParticipants} participant{reservation.nombreParticipants > 1 ? 's' : ''}</Text>
              </View>

              <View style={s.statusBadge}>
                <Text style={s.statusText}>✅ Validée par le coach</Text>
              </View>

              <TouchableOpacity
                style={[s.btn, s.payBtn]}
                onPress={() => handlePayStage(reservation)}
                disabled={!!payingId}
              >
                {payingId === reservation.id ? (
                  <ActivityIndicator color={Colors.textInverse} />
                ) : (
                  <Text style={s.payBtnText}>💳 Payer maintenant</Text>
                )}
              </TouchableOpacity>
            </View>
          ))}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  headerTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  badge: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  badgeText: {
    color: Colors.textInverse,
    fontWeight: FontWeight.bold,
    fontSize: FontSize.xs,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
  },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  emptyText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  container: { padding: Spacing.lg, gap: Spacing.md },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.card,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  coachName: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  annonceTitle: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 4 },
  priceBadge: {
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  priceText: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.primary },
  detailsRow: {
    flexDirection: 'row',
    marginBottom: Spacing.sm,
  },
  label: { fontSize: FontSize.sm, color: Colors.textSecondary, minWidth: 80 },
  value: { fontSize: FontSize.sm, color: Colors.textPrimary, flex: 1 },
  statusBadge: {
    backgroundColor: '#ECFDF5',
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginVertical: Spacing.md,
  },
  statusText: { fontSize: FontSize.sm, color: '#10B981', fontWeight: FontWeight.bold },
  btn: {
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    alignItems: 'center',
  },
  payBtn: { backgroundColor: Colors.primary },
  payBtnText: { color: Colors.textInverse, fontWeight: FontWeight.bold, fontSize: FontSize.sm },
});
