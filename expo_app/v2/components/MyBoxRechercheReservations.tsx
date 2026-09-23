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
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, FontWeight } from '../../constants/theme';
import { Card, Section, PrimaryButton, GhostButton } from '../ui/kit';
import {
  useMyBoxRechercheReservations, createBoxCheckoutSession,
  markBoxReservationAwaitingPayment, openCheckoutUrl, useCancelBoxRechercheReservation,
  MyBoxRechercheReservation, BoxRechercheReservationStatus,
} from '../adapters/boxPayments';

function fmtDateTime(iso: string | null) {
  if (!iso) return null;
  const dt = new Date(iso);
  return isNaN(dt.getTime()) ? null : dt.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) + ' à ' + dt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

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

  if (reservations.length === 0) return null;

  return (
    <Section title={`Mes paiements Box · ${reservations.length}`}>
      {reservations.map((r) => (
        <BoxReservationCard key={r.id} r={r} onChanged={reload} />
      ))}
    </Section>
  );
}

/**
 * Carte réservation (prix, statut, Payer/Annuler) — extraite pour être
 * réutilisée telle quelle dans `BoxAcceptedRecapModal` (popup post-
 * acceptation) sans dupliquer la logique de paiement/annulation.
 */
export function BoxReservationCard({ r, onChanged }: { r: MyBoxRechercheReservation; onChanged: () => void }) {
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canceling, setCanceling] = useState(false);
  const canPay = r.status === 'accepted';

  const pay = async () => {
    if (paying) return; // anti-double-clic : un paiement déjà en préparation
    setPaying(true);
    setError(null);
    const { checkoutUrl, error: err } = await createBoxCheckoutSession(
      r.id,
      `Box à ${r.lieu ?? '—'} du ${fmtDate(r.dateDebut)} au ${fmtDate(r.dateFin)}`,
    );
    if (err || !checkoutUrl) {
      setPaying(false);
      setError(err ?? 'Impossible de préparer le paiement.');
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
    await onChanged();
    setPaying(false);
  };

  return (
    <Card pad>
      <Text style={s.itemTitle}>🐴 {r.chevalNom ?? 'Cheval'}</Text>
      <Text style={s.itemMeta}>🏠 {r.lieu ?? '—'}</Text>
      <Text style={s.itemMeta}>📅 {fmtPeriode(r.dateDebut, r.dateFin)} · {r.nbNuits} nuit{r.nbNuits > 1 ? 's' : ''}</Text>
      <View style={s.priceBlock}>
        <Text style={s.priceLine}>{r.prixTotalHT.toFixed(2)} € HT</Text>
        <Text style={s.priceLine}>+ {r.platformCommission.toFixed(2)} € commission</Text>
        <Text style={s.priceTotal}>{r.prixTotalTTC.toFixed(2)} € TTC</Text>
      </View>
      <Text style={s.status}>{STATUS_LABEL[r.status] ?? r.status}</Text>

      {r.status === 'cancelled' ? (
        <View style={s.cancelledBox}>
          <Text style={s.cancelledTxt}>❌ Annulée</Text>
          {fmtDateTime(r.cancelledAt) ? <Text style={s.itemMeta}>{fmtDateTime(r.cancelledAt)}</Text> : null}
          {r.cancellationReason ? <Text style={s.itemMeta}>« {r.cancellationReason} »</Text> : null}
        </View>
      ) : canceling ? (
        <CancelPanel
          reservationId={r.id}
          onCancel={() => setCanceling(false)}
          onDone={() => { setCanceling(false); onChanged(); }}
        />
      ) : (
        <>
          {canPay && (
            <View style={s.ctaRow}>
              <PrimaryButton
                label={paying ? 'Préparation du paiement…' : 'Payer'}
                onPress={pay}
                disabled={paying}
              />
              <GhostButton label="Annuler" onPress={() => setCanceling(true)} />
            </View>
          )}
          {error && <Text style={s.errorTxt}>{error}</Text>}
        </>
      )}
    </Card>
  );
}

function CancelPanel({
  reservationId, onCancel, onDone,
}: { reservationId: string; onCancel: () => void; onDone: () => void }) {
  const { cancel } = useCancelBoxRechercheReservation();
  const [reason, setReason] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    setSending(true);
    setError(null);
    const { error: err } = await cancel(reservationId, reason);
    setSending(false);
    if (err) { setError(err); return; }
    onDone();
  };

  return (
    <View style={s.panel}>
      <Text style={s.warningTxt}>
        Êtes-vous sûr de vouloir annuler cette réservation ? Le box redeviendra disponible pour d'autres cavaliers.
      </Text>
      <TextInput
        style={s.input}
        value={reason}
        onChangeText={setReason}
        placeholder="Raison (facultatif)"
        placeholderTextColor={Colors.textTertiary}
      />
      {error ? <Text style={s.errorTxt}>{error}</Text> : null}
      <View style={s.ctaRow}>
        <PrimaryButton label={sending ? 'Annulation…' : "Confirmer l'annulation"} onPress={confirm} disabled={sending} />
        <GhostButton label="Retour" onPress={onCancel} />
      </View>
    </View>
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
  cancelledBox: { marginTop: Spacing.sm, gap: 2 },
  cancelledTxt: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.danger },
  panel: { marginTop: Spacing.sm, gap: 6 },
  warningTxt: { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: FontWeight.semibold },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, fontSize: FontSize.base, color: Colors.textPrimary, backgroundColor: Colors.surface },
});
