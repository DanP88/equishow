// ─────────────────────────────────────────────────────────────────────────────
// MySoldBoxReservations — « Mes ventes » : réservations Box issues du
// parcours recherche (recherche_id NOT NULL) où le compte connecté est
// VENDEUR. Miroir lecture seule de MyBoxRechercheReservations (acheteur) —
// AUCUN bouton Payer/Annuler ici, c'est l'acheteur qui paie/annule.
//
// Présentationnel — les données (hook + realtime) sont possédées par
// MesBoxV2 (nécessaire pour savoir si l'onglet « Mes ventes » a du contenu
// avant de l'afficher, et pour lui transmettre `highlightId` en provenance
// d'un deep-link notification, cf. resolveHref dans adapters/notifications).
// ─────────────────────────────────────────────────────────────────────────────
import { Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/colors';
import { Spacing, FontSize, FontWeight } from '../../constants/theme';
import { Card, EmptyState } from '../ui/kit';
import { useUsersByIds } from '../../hooks/useUsersByIds';
import { MySoldBoxReservation, BoxRechercheReservationStatus } from '../adapters/boxPayments';

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
  accepted: "En attente du paiement de l'acheteur",
  awaiting_payment: 'Paiement en cours',
  paid: 'Payé · en séquestre, versé après la prestation',
  completed: 'Prestation terminée',
  payment_expired: "Délai de paiement expiré (acheteur)",
  cancelled: 'Réservation annulée',
  rejected: 'Réservation refusée',
};

export function MySoldBoxReservations({
  reservations, highlightId,
}: { reservations: MySoldBoxReservation[]; highlightId?: string }) {
  const buyersById = useUsersByIds(reservations.map((r) => r.buyerId));

  if (reservations.length === 0) {
    return <EmptyState icon="💶" title="Aucune vente pour le moment" body="Les réservations issues de tes propositions apparaîtront ici." />;
  }

  // Réservation ciblée par un deep-link notification (« paiement reçu »,
  // « réponse acceptée ») remontée en tête de liste, pour être visible sans
  // avoir à faire défiler — au lieu d'ouvrir sur la liste entière.
  const ordered = highlightId
    ? [...reservations].sort((a, b) => (a.id === highlightId ? -1 : b.id === highlightId ? 1 : 0))
    : reservations;

  return (
    <>
      {ordered.map((r) => (
        <SoldReservationCard key={r.id} r={r} buyerName={buyerLabel(r.buyerId, buyersById)} highlighted={r.id === highlightId} />
      ))}
    </>
  );
}

function buyerLabel(buyerId: string | null, byId: ReturnType<typeof useUsersByIds>): string {
  const u = buyerId ? byId.get(buyerId) : undefined;
  if (!u) return 'Cavalier';
  return u.pseudo || `${u.prenom} ${u.nom}`.trim() || 'Cavalier';
}

function SoldReservationCard({ r, buyerName, highlighted }: { r: MySoldBoxReservation; buyerName: string; highlighted?: boolean }) {
  return (
    <Card pad hero={highlighted}>
      <Text style={s.itemTitle}>🐴 {r.chevalNom ?? 'Cheval'} — {buyerName}</Text>
      <Text style={s.itemMeta}>🏠 {r.lieu ?? '—'}</Text>
      <Text style={s.itemMeta}>📅 {fmtPeriode(r.dateDebut, r.dateFin)} · {r.nbNuits} nuit{r.nbNuits > 1 ? 's' : ''}</Text>
      <Text style={s.priceTotal}>{r.prixTotalHT.toFixed(2)} € HT reçus</Text>
      <Text style={s.status}>{STATUS_LABEL[r.status] ?? r.status}</Text>
      {r.status === 'cancelled' && r.cancellationReason ? (
        <Text style={s.itemMeta}>« {r.cancellationReason} »</Text>
      ) : null}
    </Card>
  );
}

const s = StyleSheet.create({
  itemTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  itemMeta: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  priceTotal: { fontSize: FontSize.base, fontWeight: FontWeight.extrabold, color: Colors.textPrimary, marginTop: Spacing.sm },
  status: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.textTertiary, marginTop: Spacing.sm },
});
