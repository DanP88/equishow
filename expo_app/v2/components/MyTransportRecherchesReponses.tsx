// ─────────────────────────────────────────────────────────────────────────────
// MyTransportRecherchesReponses — LOT 4 : réponses réelles reçues par le
// demandeur sur SES recherches Transport (111), affichées dans « Mes
// transports ». LECTURE SEULE : aucun bouton d'acceptation fonctionnel,
// aucun appel RPC — lot suivant.
// ─────────────────────────────────────────────────────────────────────────────
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/colors';
import { Spacing, FontSize, FontWeight } from '../../constants/theme';
import { Card, Section } from '../ui/kit';
import { BL } from '../ui/blush';
import { useUsersByIds } from '../../hooks/useUsersByIds';
import { useMyTransportRecherchesReponses } from '../adapters/transportRecherches';

function fmtDate(d?: string | null) {
  if (!d) return null;
  const dt = new Date(d.length >= 10 ? d : `${d}T00:00:00`);
  return isNaN(dt.getTime()) ? d : dt.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

export function MyTransportRecherchesReponses() {
  const { items } = useMyTransportRecherchesReponses();
  const allOffreurIds = items.flatMap((i) => i.reponses.map((r) => r.offreurId));
  const usersById = useUsersByIds(allOffreurIds);

  const totalReponses = items.reduce((n, i) => n + i.reponses.length, 0);
  if (totalReponses === 0) return null;

  return (
    <Section title={`Réponses reçues · ${totalReponses}`}>
      {items.filter((i) => i.reponses.length > 0).map(({ recherche, reponses }) => (
        <View key={recherche.id} style={s.group}>
          <Text style={s.rechercheHead}>
            🔎 {recherche.depart || '—'} → {recherche.destination || '—'}
            {recherche.concoursNom ? ` · 🏆 ${recherche.concoursNom}` : ''}
          </Text>
          {reponses.map((rep) => {
            const u = usersById.get(rep.offreurId);
            const nom = u ? `${u.prenom} ${u.nom?.charAt(0) ?? ''}.`.trim() : 'Un transporteur';
            const a = rep.annonce;
            return (
              <Card key={rep.id} pad>
                <Text style={s.itemTitle}>👤 {nom}</Text>
                {a ? (
                  <>
                    <Text style={s.itemMeta}>🛣 {a.villeDepart} → {a.villeArrivee || '—'}</Text>
                    <Text style={s.itemMeta}>
                      {[fmtDate(a.dateTrajet), a.heureDepart].filter(Boolean).join(' · ')}
                      {a.nbPlacesDisponibles != null ? ` · ${a.nbPlacesDisponibles} place${a.nbPlacesDisponibles > 1 ? 's' : ''} disponible${a.nbPlacesDisponibles > 1 ? 's' : ''}` : ''}
                    </Text>
                    <Text style={s.itemMeta}>
                      {a.pricePerKm && a.pricePerKm > 0 ? `${a.pricePerKm.toFixed(2)} €/km` : a.prixHT != null ? `${a.prixHT} €` : 'Prix non précisé'}
                    </Text>
                  </>
                ) : (
                  <Text style={s.itemMeta}>Annonce indisponible.</Text>
                )}
                <Text style={s.status}>
                  {rep.status === 'pending' ? '⏳ En attente de ta décision' : 'Déclinée'}
                </Text>
              </Card>
            );
          })}
        </View>
      ))}
      <Text style={s.note}>L'acceptation d'une réponse sera disponible dans une prochaine mise à jour.</Text>
    </Section>
  );
}

const s = StyleSheet.create({
  group: { gap: Spacing.xs, marginTop: Spacing.sm },
  rechercheHead: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textSecondary },
  itemTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  itemMeta: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  status: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: BL.accent, marginTop: Spacing.sm },
  note: { fontSize: FontSize.xs, color: Colors.textTertiary, fontStyle: 'italic', marginTop: Spacing.sm },
});
