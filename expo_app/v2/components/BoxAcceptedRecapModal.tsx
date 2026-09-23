// ─────────────────────────────────────────────────────────────────────────────
// BoxAcceptedRecapModal — popup affichée juste après l'acceptation d'une
// réponse (au lieu de laisser l'utilisateur scroller jusqu'à « Mes paiements
// Box » tout en bas). Retour direct de Dan après test réel.
//
// AUCUNE nouvelle logique de paiement/données : réutilise exactement
// `useMyBoxRechercheReservations` (déjà réel, déjà realtime) filtré aux
// réservations qui viennent d'être créées, et `BoxReservationCard` (même
// carte Payer/Annuler que « Mes box »). Ce popup n'est qu'un raccourci
// visuel vers des données/actions qui existaient déjà.
// ─────────────────────────────────────────────────────────────────────────────
import { Modal, View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, FontWeight } from '../../constants/theme';
import { GhostButton } from '../ui/kit';
import { useMyBoxRechercheReservations } from '../adapters/boxPayments';
import { BoxReservationCard } from './MyBoxRechercheReservations';

export function BoxAcceptedRecapModal({
  reservationIds, onClose,
}: { reservationIds: string[]; onClose: () => void }) {
  const { reservations, reload } = useMyBoxRechercheReservations();
  const items = reservations.filter((r) => reservationIds.includes(r.id));

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={s.card}>
          <Text style={s.title}>✅ Réponse acceptée</Text>
          <Text style={s.sub}>
            {items.length > 1 ? 'Réservations créées — il ne reste plus qu\'à payer.' : 'Réservation créée — il ne reste plus qu\'à payer.'}
          </Text>

          {items.length === 0 ? (
            <Text style={s.loading}>Chargement…</Text>
          ) : (
            items.map((r) => <BoxReservationCard key={r.id} r={r} onChanged={reload} />)
          )}

          <View style={s.closeRow}>
            <GhostButton label="Fermer" onPress={onClose} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: Spacing.lg },
  card: { backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.lg, gap: Spacing.sm, maxHeight: '85%' },
  title: { fontSize: FontSize.lg, fontWeight: FontWeight.extrabold, color: Colors.textPrimary },
  sub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.xs },
  loading: { fontSize: FontSize.sm, color: Colors.textTertiary },
  closeRow: { alignItems: 'center', marginTop: Spacing.sm },
});
