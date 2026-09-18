// ─────────────────────────────────────────────────────────────────────────────
// OpenTransportRecherches — LOT 2 : liste temps réel des recherches Transport
// 'open' (migration 111 + realtime 112). LECTURE SEULE.
//
// Aucun bouton « Répondre »/« Accepter » — c'est le lot suivant. Rôle unique
// ici : prouver qu'un compte B voit réellement la recherche publiée par un
// compte A (adapters/transportRecherches.ts useOpenTransportRecherches),
// sans recharger l'écran (postgres_changes).
// ─────────────────────────────────────────────────────────────────────────────
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, FontWeight } from '../../constants/theme';
import { Card } from '../ui/kit';
import { BL } from '../ui/blush';
import { useUsersByIds } from '../../hooks/useUsersByIds';
import { useOpenTransportRecherches } from '../adapters/transportRecherches';

function fmtDate(d?: string | null) {
  if (!d) return null;
  const dt = new Date(`${d}T00:00:00`);
  return isNaN(dt.getTime()) ? d : dt.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

export function OpenTransportRecherches() {
  const { recherches, isLoading } = useOpenTransportRecherches();
  const usersById = useUsersByIds(recherches.map((r) => r.demandeurId));

  if (!isLoading && recherches.length === 0) return null;

  return (
    <View style={s.wrap}>
      <Text style={s.title}>🔎 Recherches en cours{recherches.length > 0 ? ` (${recherches.length})` : ''}</Text>
      {recherches.map((r) => {
        const u = usersById.get(r.demandeurId);
        const nom = u ? `${u.prenom} ${u.nom?.charAt(0) ?? ''}.`.trim() : 'Un cavalier';
        const dates = [fmtDate(r.dateDebut), fmtDate(r.dateFin)].filter(Boolean).join(' → ');
        return (
          <Card key={r.id} pad>
            <Text style={s.trajet}>{r.depart || '—'} → {r.destination || '—'}</Text>
            <Text style={s.meta}>
              {nom} · {r.nbPlaces} cheval{r.nbPlaces > 1 ? 'aux' : ''}{dates ? ` · ${dates}` : ''}
            </Text>
            {r.concoursNom ? <Text style={s.meta}>🏆 {r.concoursNom}</Text> : null}
          </Card>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: Spacing.sm, marginTop: Spacing.md },
  title: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textSecondary },
  trajet: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  meta: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
});
