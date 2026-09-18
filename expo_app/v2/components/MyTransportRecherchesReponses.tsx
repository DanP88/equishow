// ─────────────────────────────────────────────────────────────────────────────
// MyTransportRecherchesReponses — LOT 4 (lecture) + LOT 5 (acceptation) :
// réponses réelles reçues par le demandeur sur SES recherches Transport (111),
// affichées dans « Mes transports ».
//
// LOT 5 : sélection des chevaux NON COUVERTS de cette recherche (parmi ceux
// qui la composent, jamais tous les chevaux du compte) puis appel EXCLUSIF de
// accept_transport_recherche_response — aucun calcul de prix/commission/
// vendeur/capacité/statut ici, tout reste autoritaire côté 111. UI minimale
// (pas de refonte visuelle, pas d'affichage détaillé de couverture — lot
// suivant).
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/colors';
import { Spacing, FontSize, FontWeight } from '../../constants/theme';
import { Card, Section, PrimaryButton, GhostButton } from '../ui/kit';
import { BL } from '../ui/blush';
import { useUsersByIds } from '../../hooks/useUsersByIds';
import {
  useMyTransportRecherchesReponses, useAcceptTransportRechercheResponse,
  fetchAvailableChevauxForRecherche, RechercheChevalOption, ReceivedReponse, MyRechercheWithReponses,
} from '../adapters/transportRecherches';

function fmtDate(d?: string | null) {
  if (!d) return null;
  const dt = new Date(d.length >= 10 ? d : `${d}T00:00:00`);
  return isNaN(dt.getTime()) ? d : dt.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

export function MyTransportRecherchesReponses() {
  const { items, reload } = useMyTransportRecherchesReponses();
  const allOffreurIds = items.flatMap((i) => i.reponses.map((r) => r.offreurId));
  const usersById = useUsersByIds(allOffreurIds);
  const [acceptingFor, setAcceptingFor] = useState<string | null>(null);
  const [justAccepted, setJustAccepted] = useState<string | null>(null);

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
            const canAccept = recherche.status === 'open' && rep.status === 'pending';
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
                  {recherche.status !== 'open' ? '🔒 Recherche complète ou clôturée'
                    : rep.status === 'pending' ? '⏳ En attente de ta décision' : 'Déclinée'}
                </Text>

                {justAccepted === rep.id ? (
                  <Text style={s.sent}>✅ Acceptée — réservation créée</Text>
                ) : canAccept && acceptingFor === rep.id ? (
                  <AccepterPanel
                    recherche={recherche}
                    reponse={rep}
                    onCancel={() => setAcceptingFor(null)}
                    onDone={() => { setAcceptingFor(null); setJustAccepted(rep.id); reload(); }}
                  />
                ) : canAccept ? (
                  <View style={s.ctaRow}>
                    <GhostButton label="Sélectionner des chevaux & accepter" onPress={() => setAcceptingFor(rep.id)} />
                  </View>
                ) : null}
              </Card>
            );
          })}
        </View>
      ))}
    </Section>
  );
}

function AccepterPanel({
  recherche, reponse, onCancel, onDone,
}: {
  recherche: MyRechercheWithReponses['recherche'];
  reponse: ReceivedReponse;
  onCancel: () => void;
  onDone: () => void;
}) {
  const { accept } = useAcceptTransportRechercheResponse();
  const [chevaux, setChevaux] = useState<RechercheChevalOption[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchAvailableChevauxForRecherche(recherche.id).then(({ chevaux: c, error: err }) => {
      if (cancelled) return;
      setChevaux(c);
      if (err) setError(err);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [recherche.id]);

  const toggle = (id: string) => {
    setSelected((curr) => {
      const next = new Set(curr);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const confirm = async () => {
    setSending(true);
    setError(null);
    const { error: err } = await accept({ reponseId: reponse.id, chevalIds: Array.from(selected) });
    setSending(false);
    if (err) { setError(err); return; }
    onDone();
  };

  if (loading) return <Text style={s.pickerLabel}>Chargement des chevaux…</Text>;

  if (!chevaux || chevaux.length === 0) {
    return (
      <View style={s.picker}>
        <Text style={s.emptyTxt}>Aucun cheval restant à affecter pour cette recherche.</Text>
        <GhostButton label="Fermer" onPress={onCancel} />
      </View>
    );
  }

  return (
    <View style={s.picker}>
      <Text style={s.pickerLabel}>Quels chevaux acceptes-tu avec cette proposition ?</Text>
      {chevaux.map((c) => (
        <Text key={c.id} style={s.chevalOpt} onPress={() => toggle(c.id)}>
          {selected.has(c.id) ? '☑ ' : '☐ '}{c.nom}
        </Text>
      ))}
      {error ? <Text style={s.errorTxt}>{error}</Text> : null}
      <View style={s.ctaRow}>
        <PrimaryButton
          label={sending ? 'Envoi…' : `Confirmer l'acceptation (${selected.size})`}
          onPress={confirm}
          disabled={sending || selected.size === 0}
        />
        <GhostButton label="Annuler" onPress={onCancel} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  group: { gap: Spacing.xs, marginTop: Spacing.sm },
  rechercheHead: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textSecondary },
  itemTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  itemMeta: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  status: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: BL.accent, marginTop: Spacing.sm },
  sent: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.success, marginTop: Spacing.sm },
  ctaRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm, flexWrap: 'wrap' },
  picker: { marginTop: Spacing.sm, gap: 6 },
  pickerLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5 },
  chevalOpt: { fontSize: FontSize.sm, color: Colors.textPrimary, paddingVertical: 4 },
  emptyTxt: { fontSize: FontSize.sm, color: Colors.textSecondary },
  errorTxt: { fontSize: FontSize.xs, color: Colors.danger },
});
