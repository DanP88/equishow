// ─────────────────────────────────────────────────────────────────────────────
// OpenBoxRecherches — BOX-2 : liste temps réel des recherches Box 'open'
// (migration 114, realtime déjà actif depuis 114 elle-même).
//
// LECTURE SEULE. Aucun bouton « Répondre », aucune réponse, aucune
// acceptation — Box-2 s'arrête à l'affichage (contrairement à Transport où
// OpenTransportRecherches bundle déjà Lot 2 lecture + Lot 3 réponse). Ce
// composant sera étendu (ou son équivalent réponse créé séparément) dans un
// lot Box futur, jamais avant un GO explicite.
// ─────────────────────────────────────────────────────────────────────────────
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/colors';
import { Spacing, FontSize, FontWeight } from '../../constants/theme';
import { Card } from '../ui/kit';
import { useUsersByIds } from '../../hooks/useUsersByIds';
import { useOpenBoxRecherches } from '../adapters/boxRecherches';

function fmtDate(d?: string | null) {
  if (!d) return null;
  const dt = new Date(`${d}T00:00:00`);
  return isNaN(dt.getTime()) ? d : dt.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

export function OpenBoxRecherches() {
  const { recherches, isLoading } = useOpenBoxRecherches();
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
            <Text style={s.lieu}>{r.lieu || '—'}</Text>
            <Text style={s.meta}>
              {nom} · {r.nbBox} box{r.nbBox > 1 ? 's' : ''}{dates ? ` · ${dates}` : ''}{r.litiereIncluse ? ' · litière souhaitée' : ''}
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
  lieu: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  meta: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
});
