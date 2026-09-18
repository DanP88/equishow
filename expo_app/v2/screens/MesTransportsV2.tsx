// ─────────────────────────────────────────────────────────────────────────────
// MesTransportsV2 — retrouver toute son activité Transport V2.
//   Réservations (démo, local v2:transport) · Mes propositions (réel,
//   transport_annonces) · réponses/couverture/réservations réelles issues
//   des recherches ouvertes (Lots 4/6/7, v2/components/MyTransport*).
//
// « Mes recherches » (local v2:transport) retiré (audit de nettoyage
// 2026-09-18, Lot B) : plus aucune écriture ne l'alimentait depuis le Lot 1
// (les vraies recherches sont créées dans transport_recherches et déjà
// affichées par MyTransportRecherchesReponses ci-dessous).
// ─────────────────────────────────────────────────────────────────────────────
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { BL } from '../ui/blush';
import { Spacing, FontSize, FontWeight } from '../../constants/theme';
import { Screen, Card, Section, EmptyState, Placeholder } from '../ui/kit';
import { markDemandConfirmed, clearDemand } from '../state/concoursLocal';
import { useTransportLocal } from '../state/transportLocal';
import { useMyTransportAnnonces } from '../../hooks/useTransports';
import { MyTransportRecherchesReponses } from '../components/MyTransportRecherchesReponses';
import { MyTransportRechercheReservations } from '../components/MyTransportRechercheReservations';

function fmtDate(d?: string) {
  if (!d) return '—';
  const dt = new Date(d.length >= 10 ? d : `${d}T00:00:00`);
  return isNaN(dt.getTime()) ? d : dt.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

export function MesTransportsV2() {
  const tl = useTransportLocal();
  // Phase 2 (pilote Transport) — mes annonces publiées = réelles (transport_annonces).
  const { annonces: myAnnonces, updateAnnonce, deleteAnnonce } = useMyTransportAnnonces();

  const empty = tl.bookings.length === 0 && myAnnonces.length === 0;

  return (
    <Screen>
      <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/(v2)/transport' as any))} hitSlop={8}>
        <Text style={s.back}>← Retour</Text>
      </TouchableOpacity>
      <Text style={s.h1}>🚚 Mes transports</Text>

      {empty && (
        <EmptyState icon="🚚" title="Aucune activité transport"
          body="Tes réservations, propositions et recherches apparaîtront ici."
          ctaLabel="Chercher ou proposer un transport" onCta={() => router.replace('/(v2)/transport' as any)} />
      )}

      {tl.bookings.length > 0 && (
        <Section title={`Réservations · ${tl.bookings.length}`}>
          {tl.bookings.map((b) => {
            const pending = b.status === 'pending';
            return (
              <Card key={b.id}>
                <Text style={s.itemTitle}>{pending ? '⏳' : '✅'} {b.trajet}</Text>
                <Text style={s.itemMeta}>📅 {fmtDate(b.date)}{b.heure ? ` · ${b.heure}` : ''} · 👤 {b.conducteur} · {b.prix} €</Text>
                {b.concoursNom ? <Text style={s.itemMeta}>🏆 {b.concoursNom}</Text> : null}
                <Text style={s.itemMeta}>{pending ? 'En attente : validation du transporteur + paiement' : 'Confirmé — organisé'}</Text>
                <View style={s.itemBtns}>
                  {pending && (
                    <TouchableOpacity onPress={() => {
                      tl.updateBooking(b.id, { status: 'confirmed' });
                      if (b.concoursId) markDemandConfirmed(b.concoursId, 'transport', b.chevalIds ?? (b.chevalId ? [b.chevalId] : []));
                    }}>
                      <Text style={s.action}>▸ Simuler : validé + payé</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={() => {
                    tl.cancelBooking(b.id);
                    if (pending && b.concoursId) clearDemand(b.concoursId, 'transport', b.chevalIds ?? (b.chevalId ? [b.chevalId] : []));
                  }}><Text style={s.remove}>Annuler (simulé)</Text></TouchableOpacity>
                </View>
              </Card>
            );
          })}
        </Section>
      )}

      {myAnnonces.length > 0 && (
        <Section title={`Mes propositions · ${myAnnonces.length}`}>
          {myAnnonces.map((o) => (
            <Card key={o.id}>
              <Text style={s.itemTitle}>📣 {o.villeDepart} → {o.villeArrivee}</Text>
              <Text style={s.itemMeta}>
                📅 {fmtDate(o.dateTrajet?.toISOString())}{o.heureDepart ? ` · ${o.heureDepart}` : ''} · {o.nbPlacesDisponibles} place(s) disponible(s)
                {o.pricePerKm ? ` · ${o.pricePerKm.toFixed(2)} €/km` : ` · ${o.prixHT} €`}
              </Text>
              {o.concours ? <Text style={s.itemMeta}>🏆 {o.concours}</Text> : null}
              <View style={s.itemBtns}>
                <TouchableOpacity onPress={() => updateAnnonce(o.id, { nbPlacesTotal: o.nbPlacesTotal + 1, nbPlacesDisponibles: o.nbPlacesDisponibles + 1 })}><Text style={s.action}>+1 place</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => deleteAnnonce(o.id)}><Text style={s.remove}>Retirer</Text></TouchableOpacity>
              </View>
            </Card>
          ))}
        </Section>
      )}

      {/* LOT 4 — réponses réelles (111+112) reçues sur mes recherches réelles (111, Lot 1). Lecture seule. */}
      <MyTransportRecherchesReponses />

      {/* LOT 7 — mes réservations réelles issues d'une recherche (buyer OU seller), annulation via RPC 113. */}
      <MyTransportRechercheReservations />

      <Placeholder note="propositions réelles (transport_annonces) ; réservations et recherches encore simulées — paiement à venir" />
    </Screen>
  );
}

const s = StyleSheet.create({
  back: { fontSize: FontSize.sm, color: BL.accent, fontWeight: FontWeight.bold },
  h1: { fontSize: 22, fontWeight: FontWeight.extrabold, color: Colors.textPrimary },
  itemTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  itemMeta: { fontSize: FontSize.sm, color: Colors.textSecondary },
  itemStatus: { fontSize: FontSize.xs, color: Colors.textTertiary, fontWeight: FontWeight.semibold, marginTop: 2 },
  itemBtns: { flexDirection: 'row', gap: Spacing.lg, marginTop: 4 },
  action: { fontSize: FontSize.sm, color: BL.accent, fontWeight: FontWeight.bold },
  remove: { fontSize: FontSize.sm, color: Colors.urgent, fontWeight: FontWeight.bold, marginTop: 4 },
});
