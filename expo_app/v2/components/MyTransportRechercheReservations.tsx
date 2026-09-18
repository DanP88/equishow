// ─────────────────────────────────────────────────────────────────────────────
// MyTransportRechercheReservations — LOT 7 (front) : annulation d'une
// réservation Transport 'accepted' issue d'une recherche ouverte (111),
// côté cavalier (buyer) OU transporteur (seller).
//
// Appelle EXCLUSIVEMENT cancel_transport_recherche_reservation (mig 113) —
// aucun UPDATE direct de transport_reservations. Bouton visible seulement
// si : recherche_id != null (filtré par le hook), statut='accepted', et
// l'utilisateur est buyer ou seller (filtré par le hook) — ces contrôles
// front sont de l'UX, la RPC reste seule autoritaire. Aucun bouton pour
// awaiting_payment/paid/completed/V1 direct (hors périmètre de ce lot,
// ces lignes ne sont même pas chargées par le hook).
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, FontWeight } from '../../constants/theme';
import { Card, Section, PrimaryButton, GhostButton } from '../ui/kit';
import { useAuth } from '../../hooks/useAuth';
import { useUsersByIds } from '../../hooks/useUsersByIds';
import {
  useMyTransportRechercheReservations, useCancelTransportRechercheReservation,
  MyRechercheReservation,
} from '../adapters/transportRecherches';

function fmtDateTime(iso: string | null) {
  if (!iso) return null;
  const dt = new Date(iso);
  return isNaN(dt.getTime()) ? null : dt.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) + ' à ' + dt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

export function MyTransportRechercheReservations() {
  const { profile } = useAuth();
  const { items, reload } = useMyTransportRechercheReservations();
  const counterpartIds = items.map((r) => (r.buyerId === profile?.id ? r.sellerId : r.buyerId));
  const usersById = useUsersByIds(counterpartIds);
  const [cancelingFor, setCancelingFor] = useState<string | null>(null);
  const [justCancelled, setJustCancelled] = useState<string | null>(null);

  if (items.length === 0) return null;

  return (
    <Section title={`Mes réservations (recherches) · ${items.length}`}>
      {items.map((r) => {
        const iAmBuyer = r.buyerId === profile?.id;
        const counterpartId = iAmBuyer ? r.sellerId : r.buyerId;
        const u = usersById.get(counterpartId);
        const nom = u ? `${u.prenom} ${u.nom?.charAt(0) ?? ''}.`.trim() : (iAmBuyer ? 'Un transporteur' : 'Un cavalier');
        return (
          <Card key={r.id} pad>
            <Text style={s.trajet}>{r.rechercheDepart || '—'} → {r.rechercheDestination || '—'}</Text>
            <Text style={s.meta}>
              {iAmBuyer ? '🚚 Transporteur : ' : '🐴 Cavalier : '}{nom} · {r.nbPlaces ?? 1} place{(r.nbPlaces ?? 1) > 1 ? 's' : ''}
            </Text>

            {r.statut === 'cancelled' ? (
              <View style={s.cancelledBox}>
                <Text style={s.cancelledTxt}>❌ Annulée</Text>
                {fmtDateTime(r.cancelledAt) ? <Text style={s.meta}>{fmtDateTime(r.cancelledAt)}</Text> : null}
                {r.cancellationReason ? <Text style={s.meta}>« {r.cancellationReason} »</Text> : null}
              </View>
            ) : justCancelled === r.id ? (
              <Text style={s.confirmTxt}>✅ Réservation annulée</Text>
            ) : cancelingFor === r.id ? (
              <CancelPanel
                reservationId={r.id}
                onCancel={() => setCancelingFor(null)}
                onDone={() => { setCancelingFor(null); setJustCancelled(r.id); reload(); }}
              />
            ) : (
              <View style={s.ctaRow}>
                <GhostButton label="Annuler la réservation" onPress={() => setCancelingFor(r.id)} />
              </View>
            )}
          </Card>
        );
      })}
    </Section>
  );
}

function CancelPanel({
  reservationId, onCancel, onDone,
}: { reservationId: MyRechercheReservation['id']; onCancel: () => void; onDone: () => void }) {
  const { cancel } = useCancelTransportRechercheReservation();
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
        Êtes-vous sûr de vouloir annuler cette réservation ? Les chevaux concernés seront de nouveau recherchés.
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
  trajet: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  meta: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  ctaRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm, flexWrap: 'wrap' },
  panel: { marginTop: Spacing.sm, gap: 6 },
  warningTxt: { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: FontWeight.semibold },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, fontSize: FontSize.base, color: Colors.textPrimary, backgroundColor: Colors.surface },
  errorTxt: { fontSize: FontSize.xs, color: Colors.danger },
  confirmTxt: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.success, marginTop: Spacing.sm },
  cancelledBox: { marginTop: Spacing.sm, gap: 2 },
  cancelledTxt: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.danger },
});
