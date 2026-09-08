// ─────────────────────────────────────────────────────────────────────────────
// MesCoachingsV2 — toute l'activité Coach V2 (F7, local).
//   Mes séances (réservées) · Mes annonces · Mes demandes
// Tout LOCAL (v2:coach). Miroir de MesTransportsV2 / MesBoxV2 (F5/F6).
// ─────────────────────────────────────────────────────────────────────────────
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { BL } from '../ui/blush';
import { Spacing, FontSize, FontWeight } from '../../constants/theme';
import { Screen, Card, Section, EmptyState, Placeholder } from '../ui/kit';
import { getConcoursEntry, setConcoursEntry, markDemandConfirmed, clearDemand } from '../state/concoursLocal';
import { useCoachLocal } from '../state/coachLocal';

export function MesCoachingsV2() {
  const kl = useCoachLocal();

  const removeSearch = (id: string) => {
    const sr = kl.searches.find((x) => x.id === id);
    kl.removeSearch(id);
    if (sr?.concoursId) {
      const cid = sr.concoursId;
      const stillSearching = kl.searches.some((x) => x.id !== id && x.concoursId === cid && x.status === 'open');
      const hasBooking = kl.bookings.some((x) => x.concoursId === cid);
      const hasOffer = kl.offers.some((x) => x.concoursId === cid);
      if (!stillSearching && !hasBooking && !hasOffer && getConcoursEntry(cid).needCoach === 'searching') {
        setConcoursEntry(cid, { needCoach: 'unset' });
      }
    }
  };

  const empty = kl.bookings.length === 0 && kl.offers.length === 0 && kl.searches.length === 0;

  return (
    <Screen>
      <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/(v2)/coach' as any))} hitSlop={8}>
        <Text style={s.back}>← Retour</Text>
      </TouchableOpacity>
      <Text style={s.h1}>🎓 Mes coachings</Text>

      {empty && (
        <EmptyState icon="🎓" title="Aucune activité coaching"
          body="Tes séances, annonces et demandes apparaîtront ici."
          ctaLabel="Chercher ou proposer du coaching" onCta={() => router.replace('/(v2)/coach' as any)} />
      )}

      {kl.bookings.length > 0 && (
        <Section title={`Mes séances · ${kl.bookings.length}`}>
          {kl.bookings.map((b) => {
            const pending = b.status === 'pending';
            return (
              <Card key={b.id}>
                <Text style={s.itemTitle}>{pending ? '⏳' : '✅'} {b.coach}</Text>
                <Text style={s.itemMeta}>{b.discipline} · {b.niveau} · {b.nbSeances} séance(s) · {b.prix} €</Text>
                {b.concoursNom ? <Text style={s.itemMeta}>🏆 {b.concoursNom}</Text> : null}
                <Text style={s.itemMeta}>{pending ? 'En attente : acceptation du coach + paiement' : 'Confirmé — coach prévu'}</Text>
                <View style={s.itemBtns}>
                  {pending && (
                    <TouchableOpacity onPress={() => {
                      kl.updateBooking(b.id, { status: 'confirmed' });
                      if (b.concoursId) markDemandConfirmed(b.concoursId, 'coach', b.chevalIds ?? (b.chevalId ? [b.chevalId] : []));
                    }}>
                      <Text style={s.action}>▸ Simuler : accepté + payé</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={() => {
                    kl.cancelBooking(b.id);
                    if (pending && b.concoursId) clearDemand(b.concoursId, 'coach', b.chevalIds ?? (b.chevalId ? [b.chevalId] : []));
                  }}><Text style={s.remove}>Annuler (simulé)</Text></TouchableOpacity>
                </View>
              </Card>
            );
          })}
        </Section>
      )}

      {kl.offers.length > 0 && (
        <Section title={`Mes annonces · ${kl.offers.length}`}>
          {kl.offers.map((o) => (
            <Card key={o.id}>
              <Text style={s.itemTitle}>📣 {o.discipline} · {o.type === 'concours' ? 'sur concours' : 'régulier'}</Text>
              <Text style={s.itemMeta}>{o.niveaux.join(', ')} · {o.prixSeance} €/séance · {o.places} créneau(x)</Text>
              {o.concoursNom ? <Text style={s.itemMeta}>🏆 {o.concoursNom}</Text> : null}
              <View style={s.itemBtns}>
                <TouchableOpacity onPress={() => kl.updateOffer(o.id, { places: o.places + 1 })}><Text style={s.action}>+1 créneau</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => kl.removeOffer(o.id)}><Text style={s.remove}>Retirer</Text></TouchableOpacity>
              </View>
            </Card>
          ))}
        </Section>
      )}

      {kl.searches.length > 0 && (
        <Section title={`Mes demandes · ${kl.searches.length}`}>
          {kl.searches.map((r) => (
            <Card key={r.id}>
              <Text style={s.itemTitle}>{r.status === 'open' ? '🔎' : '✔️'} {r.discipline} · {r.niveau}</Text>
              <Text style={s.itemMeta}>{r.nbSeances} séance(s){r.type === 'regulier' ? ' · régulier' : ''}</Text>
              {r.concoursNom ? <Text style={s.itemMeta}>🏆 {r.concoursNom}</Text> : null}
              <Text style={s.itemStatus}>{r.status === 'open' ? 'Demande en cours' : 'Clôturée (coach trouvé)'}</Text>
              {r.status === 'open' && (
                <TouchableOpacity onPress={() => removeSearch(r.id)}><Text style={s.remove}>Retirer ma demande</Text></TouchableOpacity>
              )}
            </Card>
          ))}
        </Section>
      )}

      <Placeholder note="tout est stocké localement (v2:coach) — aucune donnée Supabase" />
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
