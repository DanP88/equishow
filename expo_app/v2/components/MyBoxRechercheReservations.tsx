// ─────────────────────────────────────────────────────────────────────────────
// MyBoxRechercheReservations — BOX-5B : paiement réel d'une réservation Box
// issue du parcours recherche (recherche_id NOT NULL), depuis « Mes box ».
//
// Réutilise EXCLUSIVEMENT le backend Stripe existant (create-checkout-
// session, webhook-stripe, escrow) via v2/adapters/boxPayments.ts — aucune
// logique de paiement ici, aucun calcul de prix, aucune écriture `paid`.
// `paid` n'apparaît QUE lorsque la base le retourne après traitement du
// webhook (realtime déjà actif sur box_reservations, cf. adapter).
//
// 1 cheval = 1 box_reservation = 1 paiement — AUCUN panier, AUCUN
// regroupement (règle explicite Box-5B). Chaque réservation a son propre
// bouton Payer, son propre appel Checkout.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/colors';
import { Spacing, FontSize, FontWeight } from '../../constants/theme';
import { Card, Section, PrimaryButton } from '../ui/kit';
import {
  useMyBoxRechercheReservations, createBoxCheckoutSession,
  markBoxReservationAwaitingPayment, openCheckoutUrl,
  MyBoxRechercheReservation, BoxRechercheReservationStatus,
} from '../adapters/boxPayments';

function fmtDate(d?: string | null) {
  if (!d) return '—';
  const dt = new Date(d.length >= 10 ? d : `${d}T00:00:00`);
  return isNaN(dt.getTime()) ? d : dt.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}
function fmtPeriode(a: string, b: string) {
  return `${fmtDate(a)} → ${fmtDate(b)}`;
}

const STATUS_LABEL: Record<BoxRechercheReservationStatus, string> = {
  pending: 'En attente',
  accepted: 'Paiement à effectuer',
  awaiting_payment: 'Paiement en attente',
  paid: 'Paiement confirmé',
  completed: 'Prestation terminée',
  payment_expired: 'Délai de paiement expiré',
  cancelled: 'Réservation annulée',
  rejected: 'Réservation refusée',
};

export function MyBoxRechercheReservations() {
  const { reservations, reload } = useMyBoxRechercheReservations();
  const [payingId, setPayingId] = useState<string | null>(null);
  const [error, setError] = useState<{ id: string; message: string } | null>(null);

  if (reservations.length === 0) return null;

  const pay = async (r: MyBoxRechercheReservation) => {
    if (payingId) return; // anti-double-clic : un paiement déjà en préparation
    setPayingId(r.id);
    setError(null);
    const { checkoutUrl, error: err } = await createBoxCheckoutSession(
      r.id,
      `Box à ${r.lieu ?? '—'} du ${fmtDate(r.dateDebut)} au ${fmtDate(r.dateFin)}`,
    );
    if (err || !checkoutUrl) {
      setPayingId(null);
      setError({ id: r.id, message: err ?? 'Impossible de préparer le paiement.' });
      return;
    }
    // Best-effort, non bloquant — même mécanisme que pending-box-payments.tsx
    // (V1). Le webhook reste seul maître de la transition vers 'paid'.
    await markBoxReservationAwaitingPayment(r.id);
    await openCheckoutUrl(checkoutUrl);
    // PAY-RETURN-1 (natif) : openCheckoutUrl ne se résout qu'au retour dans
    // l'app. On recharge l'état réel — jamais un statut posé localement, le
    // realtime déjà actif sur box_reservations couvre aussi ce cas mais ce
    // reload explicite évite d'attendre le prochain focus/event.
    await reload();
    setPayingId(null);
  };

  return (
    <Section title={`Mes paiements Box · ${reservations.length}`}>
      {reservations.map((r) => {
        const canPay = r.status === 'accepted';
        const isPaying = payingId === r.id;
        return (
          <Card key={r.id} pad>
            <Text style={s.itemTitle}>🐴 {r.chevalNom ?? 'Cheval'}</Text>
            <Text style={s.itemMeta}>🏠 {r.lieu ?? '—'}</Text>
            <Text style={s.itemMeta}>📅 {fmtPeriode(r.dateDebut, r.dateFin)} · {r.nbNuits} nuit{r.nbNuits > 1 ? 's' : ''}</Text>
            <View style={s.priceBlock}>
              <Text style={s.priceLine}>{r.prixTotalHT.toFixed(2)} € HT</Text>
              <Text style={s.priceLine}>+ {r.platformCommission.toFixed(2)} € commission</Text>
              <Text style={s.priceTotal}>{r.prixTotalTTC.toFixed(2)} € TTC</Text>
            </View>
            <Text style={s.status}>{STATUS_LABEL[r.status] ?? r.status}</Text>

            {canPay && (
              <View style={s.ctaRow}>
                <PrimaryButton
                  label={isPaying ? 'Préparation du paiement…' : 'Payer'}
                  onPress={() => pay(r)}
                  disabled={isPaying}
                />
              </View>
            )}
            {error?.id === r.id && <Text style={s.errorTxt}>{error.message}</Text>}
          </Card>
        );
      })}
    </Section>
  );
}

const s = StyleSheet.create({
  itemTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  itemMeta: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  priceBlock: { marginTop: Spacing.sm, gap: 1 },
  priceLine: { fontSize: FontSize.xs, color: Colors.textSecondary },
  priceTotal: { fontSize: FontSize.base, fontWeight: FontWeight.extrabold, color: Colors.textPrimary, marginTop: 2 },
  status: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.textTertiary, marginTop: Spacing.sm },
  ctaRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm, flexWrap: 'wrap' },
  errorTxt: { fontSize: FontSize.xs, color: Colors.danger, marginTop: 4 },
});
