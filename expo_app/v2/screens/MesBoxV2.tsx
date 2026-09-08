// ─────────────────────────────────────────────────────────────────────────────
// MesBoxV2 — retrouver toute son activité Box V2 (F6, local).
//   Réservations · Mes propositions · Mes recherches
// Chaque item peut être vu / modifié (léger) / retiré — tout LOCAL (v2:box).
// Miroir strict de v2/screens/MesTransportsV2 (F5).
// ─────────────────────────────────────────────────────────────────────────────
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { BL } from '../ui/blush';
import { Spacing, FontSize, FontWeight } from '../../constants/theme';
import { Screen, Card, Section, EmptyState, Placeholder } from '../ui/kit';
import { getConcoursEntry, setConcoursEntry, markDemandConfirmed, clearDemand } from '../state/concoursLocal';
import { useBoxLocal } from '../state/boxLocal';

function fmtDate(d?: string) {
  if (!d) return '—';
  const dt = new Date(d.length >= 10 ? d : `${d}T00:00:00`);
  return isNaN(dt.getTime()) ? d : dt.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}
function fmtPeriode(a?: string, b?: string) {
  if (!a && !b) return '—';
  return `${fmtDate(a)} → ${fmtDate(b)}`;
}

export function MesBoxV2() {
  const bl = useBoxLocal();

  const removeSearch = (id: string) => {
    const sr = bl.searches.find((x) => x.id === id);
    bl.removeSearch(id);
    // Resync « Mon concours » : si cette recherche était la raison du « je
    // cherche » et qu'il ne reste ni réservation ni autre recherche ouverte
    // ni proposition pour ce concours → l'état redevient « à organiser ».
    if (sr?.concoursId) {
      const cid = sr.concoursId;
      const stillSearching = bl.searches.some((x) => x.id !== id && x.concoursId === cid && x.status === 'open');
      const hasBooking = bl.bookings.some((x) => x.concoursId === cid);
      const hasOffer = bl.offers.some((x) => x.concoursId === cid);
      if (!stillSearching && !hasBooking && !hasOffer && getConcoursEntry(cid).needBox === 'searching') {
        setConcoursEntry(cid, { needBox: 'unset' });
      }
    }
  };

  const empty = bl.bookings.length === 0 && bl.offers.length === 0 && bl.searches.length === 0;

  return (
    <Screen>
      <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/(v2)/box' as any))} hitSlop={8}>
        <Text style={s.back}>← Retour</Text>
      </TouchableOpacity>
      <Text style={s.h1}>🏠 Mes box</Text>

      {empty && (
        <EmptyState icon="🏠" title="Aucune activité box"
          body="Tes réservations, propositions et recherches apparaîtront ici."
          ctaLabel="Chercher ou proposer un box" onCta={() => router.replace('/(v2)/box' as any)} />
      )}

      {bl.bookings.length > 0 && (
        <Section title={`Réservations · ${bl.bookings.length}`}>
          {bl.bookings.map((b) => {
            const pending = b.status === 'pending';
            return (
              <Card key={b.id}>
                <Text style={s.itemTitle}>{pending ? '⏳' : '✅'} {b.lieu}</Text>
                <Text style={s.itemMeta}>📅 {fmtPeriode(b.dateDebut, b.dateFin)} · {b.nbNuits} nuit(s) · {b.prix} €</Text>
                {b.concoursNom ? <Text style={s.itemMeta}>🏆 {b.concoursNom}</Text> : null}
                <Text style={s.itemMeta}>{pending ? 'En attente : validation du loueur + paiement' : 'Confirmé — organisé'}</Text>
                <View style={s.itemBtns}>
                  {pending && (
                    <TouchableOpacity onPress={() => {
                      bl.updateBooking(b.id, { status: 'confirmed' });
                      if (b.concoursId) markDemandConfirmed(b.concoursId, 'box', b.chevalIds ?? (b.chevalId ? [b.chevalId] : []));
                    }}>
                      <Text style={s.action}>▸ Simuler : validé + payé</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={() => {
                    bl.cancelBooking(b.id);
                    if (pending && b.concoursId) clearDemand(b.concoursId, 'box', b.chevalIds ?? (b.chevalId ? [b.chevalId] : []));
                  }}><Text style={s.remove}>Annuler (simulé)</Text></TouchableOpacity>
                </View>
              </Card>
            );
          })}
        </Section>
      )}

      {bl.offers.length > 0 && (
        <Section title={`Mes propositions · ${bl.offers.length}`}>
          {bl.offers.map((o) => (
            <Card key={o.id}>
              <Text style={s.itemTitle}>📣 {o.lieu}</Text>
              <Text style={s.itemMeta}>📅 {fmtPeriode(o.dateDebut, o.dateFin)} · {o.nbBox} box · {o.prixNuit} €/nuit{o.litiereIncluse ? ' · litière incl.' : ''}</Text>
              {o.concoursNom ? <Text style={s.itemMeta}>🏆 {o.concoursNom}</Text> : null}
              <View style={s.itemBtns}>
                <TouchableOpacity onPress={() => bl.updateOffer(o.id, { nbBox: o.nbBox + 1 })}><Text style={s.action}>+1 box</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => bl.removeOffer(o.id)}><Text style={s.remove}>Retirer</Text></TouchableOpacity>
              </View>
            </Card>
          ))}
        </Section>
      )}

      {bl.searches.length > 0 && (
        <Section title={`Mes recherches · ${bl.searches.length}`}>
          {bl.searches.map((r) => (
            <Card key={r.id}>
              <Text style={s.itemTitle}>{r.status === 'open' ? '🔎' : '✔️'} Box · {r.lieu}</Text>
              <Text style={s.itemMeta}>📅 {fmtPeriode(r.dateDebut, r.dateFin)} · {r.nbBox} box{r.litiereIncluse ? ' · litière souhaitée' : ''}</Text>
              {r.concoursNom ? <Text style={s.itemMeta}>🏆 {r.concoursNom}</Text> : null}
              <Text style={s.itemStatus}>{r.status === 'open' ? 'Recherche en cours' : 'Clôturée (box trouvé)'}</Text>
              {r.status === 'open' && (
                <TouchableOpacity onPress={() => removeSearch(r.id)}><Text style={s.remove}>Retirer ma recherche</Text></TouchableOpacity>
              )}
            </Card>
          ))}
        </Section>
      )}

      <Placeholder note="tout est stocké localement (v2:box) — aucune donnée Supabase" />
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
