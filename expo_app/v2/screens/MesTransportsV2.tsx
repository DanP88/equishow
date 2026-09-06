// ─────────────────────────────────────────────────────────────────────────────
// MesTransportsV2 — retrouver toute son activité Transport V2 (F5, local).
//   Réservations · Mes propositions · Mes recherches
// Chaque item peut être vu / modifié (léger) / retiré — tout LOCAL (v2:transport).
// ─────────────────────────────────────────────────────────────────────────────
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Spacing, FontSize, FontWeight } from '../../constants/theme';
import { Screen, Card, Section, EmptyState, Placeholder } from '../ui/kit';
import { getConcoursEntry, setConcoursEntry } from '../state/concoursLocal';
import { useTransportLocal } from '../state/transportLocal';

function fmtDate(d?: string) {
  if (!d) return '—';
  const dt = new Date(d.length >= 10 ? d : `${d}T00:00:00`);
  return isNaN(dt.getTime()) ? d : dt.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

export function MesTransportsV2() {
  const tl = useTransportLocal();

  const removeSearch = (id: string) => {
    const sr = tl.searches.find((x) => x.id === id);
    tl.removeSearch(id);
    // Resync « Mon concours » : si cette recherche était la raison du « je
    // cherche » et qu'il ne reste ni réservation ni autre recherche ouverte
    // ni proposition pour ce concours → l'état redevient « à organiser ».
    if (sr?.concoursId) {
      const cid = sr.concoursId;
      const stillSearching = tl.searches.some((x) => x.id !== id && x.concoursId === cid && x.status === 'open');
      const hasBooking = tl.bookings.some((x) => x.concoursId === cid);
      const hasOffer = tl.offers.some((x) => x.concoursId === cid);
      if (!stillSearching && !hasBooking && !hasOffer && getConcoursEntry(cid).needTransport === 'searching') {
        setConcoursEntry(cid, { needTransport: 'unset' });
      }
    }
  };

  const empty = tl.bookings.length === 0 && tl.offers.length === 0 && tl.searches.length === 0;

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
          {tl.bookings.map((b) => (
            <Card key={b.id}>
              <Text style={s.itemTitle}>✅ {b.trajet}</Text>
              <Text style={s.itemMeta}>📅 {fmtDate(b.date)}{b.heure ? ` · ${b.heure}` : ''} · 👤 {b.conducteur} · {b.prix} €</Text>
              {b.concoursNom ? <Text style={s.itemMeta}>🏆 {b.concoursNom}</Text> : null}
              <TouchableOpacity onPress={() => tl.cancelBooking(b.id)}><Text style={s.remove}>Annuler (simulé)</Text></TouchableOpacity>
            </Card>
          ))}
        </Section>
      )}

      {tl.offers.length > 0 && (
        <Section title={`Mes propositions · ${tl.offers.length}`}>
          {tl.offers.map((o) => (
            <Card key={o.id}>
              <Text style={s.itemTitle}>📣 {o.depart} → {o.destination}</Text>
              <Text style={s.itemMeta}>📅 {fmtDate(o.date)}{o.heure ? ` · ${o.heure}` : ''} · {o.places} place(s) · {o.prix} €/place</Text>
              {o.concoursNom ? <Text style={s.itemMeta}>🏆 {o.concoursNom}</Text> : null}
              <View style={s.itemBtns}>
                <TouchableOpacity onPress={() => tl.updateOffer(o.id, { places: o.places + 1 })}><Text style={s.action}>+1 place</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => tl.removeOffer(o.id)}><Text style={s.remove}>Retirer</Text></TouchableOpacity>
              </View>
            </Card>
          ))}
        </Section>
      )}

      {tl.searches.length > 0 && (
        <Section title={`Mes recherches · ${tl.searches.length}`}>
          {tl.searches.map((r) => (
            <Card key={r.id}>
              <Text style={s.itemTitle}>{r.status === 'open' ? '🔎' : '✔️'} {r.depart || '?'} → {r.destination}</Text>
              <Text style={s.itemMeta}>📅 {fmtDate(r.dateAller)} · {r.nbChevaux} cheval(aux){r.avecCavalier ? ' · avec cavalier' : ''}</Text>
              {r.concoursNom ? <Text style={s.itemMeta}>🏆 {r.concoursNom}</Text> : null}
              <Text style={s.itemStatus}>{r.status === 'open' ? 'Recherche en cours' : 'Clôturée (transport trouvé)'}</Text>
              {r.status === 'open' && (
                <TouchableOpacity onPress={() => removeSearch(r.id)}><Text style={s.remove}>Retirer ma recherche</Text></TouchableOpacity>
              )}
            </Card>
          ))}
        </Section>
      )}

      <Placeholder note="tout est stocké localement (v2:transport) — aucune donnée Supabase" />
    </Screen>
  );
}

const s = StyleSheet.create({
  back: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.bold },
  h1: { fontSize: 22, fontWeight: FontWeight.extrabold, color: Colors.textPrimary },
  itemTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  itemMeta: { fontSize: FontSize.sm, color: Colors.textSecondary },
  itemStatus: { fontSize: FontSize.xs, color: Colors.textTertiary, fontWeight: FontWeight.semibold, marginTop: 2 },
  itemBtns: { flexDirection: 'row', gap: Spacing.lg, marginTop: 4 },
  action: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.bold },
  remove: { fontSize: FontSize.sm, color: Colors.urgent, fontWeight: FontWeight.bold, marginTop: 4 },
});
