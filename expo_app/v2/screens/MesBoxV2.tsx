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
import { useMyBoxAnnonces } from '../../hooks/useBoxes';
import { useAuth } from '../../hooks/useAuth';
import { useMyBoxRecherches } from '../adapters/boxRecherches';

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
  const { isSignedIn } = useAuth();
  const bl = useBoxLocal();
  // Phase 2 (pilote Box) — mes annonces publiées = réelles (box_annonces).
  const { annonces: myAnnonces, updateAnnonce, deleteAnnonce } = useMyBoxAnnonces();
  // BOX-1 — mes recherches RÉELLES (box_recherches), compte connecté
  // uniquement. Démo/non connecté : conserve bl.searches (local, inchangé).
  const { recherches: myRecherchesReal, removeRecherche: removeRechercheReal } = useMyBoxRecherches();

  const removeSearchLocal = (id: string) => {
    const sr = bl.searches.find((x) => x.id === id);
    bl.removeSearch(id);
    // Resync « Mon concours » : si cette recherche était la raison du « je
    // cherche » et qu'il ne reste ni réservation ni autre recherche ouverte
    // ni proposition pour ce concours → l'état redevient « à organiser ».
    if (sr?.concoursId) {
      const cid = sr.concoursId;
      const stillSearching = bl.searches.some((x) => x.id !== id && x.concoursId === cid && x.status === 'open');
      const hasBooking = bl.bookings.some((x) => x.concoursId === cid);
      const hasOffer = myAnnonces.some((x) => x.concoursId === cid);
      if (!stillSearching && !hasBooking && !hasOffer && getConcoursEntry(cid).needBox === 'searching') {
        setConcoursEntry(cid, { needBox: 'unset' });
      }
    }
  };

  const removeSearchReal = async (id: string) => {
    const sr = myRecherchesReal.find((x) => x.id === id);
    await removeRechercheReal(id);
    if (sr?.concoursId) {
      const cid = sr.concoursId;
      const stillSearching = myRecherchesReal.some((x) => x.id !== id && x.concoursId === cid && x.status === 'open');
      const hasBooking = bl.bookings.some((x) => x.concoursId === cid);
      const hasOffer = myAnnonces.some((x) => x.concoursId === cid);
      if (!stillSearching && !hasBooking && !hasOffer && getConcoursEntry(cid).needBox === 'searching') {
        setConcoursEntry(cid, { needBox: 'unset' });
      }
    }
  };

  // Une seule source affichée à la fois (jamais les deux mélangées) : réelle
  // pour un compte connecté, locale/démo sinon — même bascule que BoxChercheV2.
  const searchesCount = isSignedIn ? myRecherchesReal.length : bl.searches.length;
  const empty = bl.bookings.length === 0 && myAnnonces.length === 0 && searchesCount === 0;

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

      {myAnnonces.length > 0 && (
        <Section title={`Mes propositions · ${myAnnonces.length}`}>
          {myAnnonces.map((o) => (
            <Card key={o.id}>
              <Text style={s.itemTitle}>📣 {o.lieu}</Text>
              <Text style={s.itemMeta}>📅 {fmtPeriode(o.dateDebut.toISOString(), o.dateFin.toISOString())} · {o.nbBoxesDisponibles} box disponible(s) · {o.prixNuitHT} €/nuit</Text>
              {o.concours ? <Text style={s.itemMeta}>🏆 {o.concours}</Text> : null}
              <View style={s.itemBtns}>
                <TouchableOpacity onPress={() => updateAnnonce(o.id, { nbBoxes: o.nbBoxes + 1, nbBoxesDisponibles: o.nbBoxesDisponibles + 1 })}><Text style={s.action}>+1 box</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => deleteAnnonce(o.id)}><Text style={s.remove}>Retirer</Text></TouchableOpacity>
              </View>
            </Card>
          ))}
        </Section>
      )}

      {isSignedIn ? (
        myRecherchesReal.length > 0 && (
          <Section title={`Mes recherches · ${myRecherchesReal.length}`}>
            {myRecherchesReal.map((r) => (
              <Card key={r.id}>
                <Text style={s.itemTitle}>{r.status === 'open' ? '🔎' : '✔️'} Box · {r.lieu ?? '—'}</Text>
                <Text style={s.itemMeta}>📅 {fmtPeriode(r.dateDebut ?? undefined, r.dateFin ?? undefined)} · {r.nbBox} box{r.litiereIncluse ? ' · litière souhaitée' : ''}</Text>
                {r.concoursNom ? <Text style={s.itemMeta}>🏆 {r.concoursNom}</Text> : null}
                <Text style={s.itemStatus}>{r.status === 'open' ? 'Recherche en cours' : r.status === 'matched' ? 'Box trouvé' : 'Annulée'}</Text>
                {r.status === 'open' && (
                  <TouchableOpacity onPress={() => removeSearchReal(r.id)}><Text style={s.remove}>Retirer ma recherche</Text></TouchableOpacity>
                )}
              </Card>
            ))}
          </Section>
        )
      ) : (
        bl.searches.length > 0 && (
          <Section title={`Mes recherches · ${bl.searches.length}`}>
            {bl.searches.map((r) => (
              <Card key={r.id}>
                <Text style={s.itemTitle}>{r.status === 'open' ? '🔎' : '✔️'} Box · {r.lieu}</Text>
                <Text style={s.itemMeta}>📅 {fmtPeriode(r.dateDebut, r.dateFin)} · {r.nbBox} box{r.litiereIncluse ? ' · litière souhaitée' : ''}</Text>
                {r.concoursNom ? <Text style={s.itemMeta}>🏆 {r.concoursNom}</Text> : null}
                <Text style={s.itemStatus}>{r.status === 'open' ? 'Recherche en cours' : 'Clôturée (box trouvé)'}</Text>
                {r.status === 'open' && (
                  <TouchableOpacity onPress={() => removeSearchLocal(r.id)}><Text style={s.remove}>Retirer ma recherche</Text></TouchableOpacity>
                )}
              </Card>
            ))}
          </Section>
        )
      )}

      <Placeholder note="propositions réelles (box_annonces) ; recherches réelles si connecté (box_recherches) ; réservations encore simulées — paiement à venir" />
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
