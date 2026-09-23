// ─────────────────────────────────────────────────────────────────────────────
// MyBoxRecherchesReponses — BOX-4B : réponses réelles reçues sur TOUTES les
// recherches Box du demandeur, avec sélection des chevaux non couverts +
// acceptation réelle (RPC accept_box_recherche_response, 114), affichées
// dans « Mes box ».
//
// Aucun calcul de prix/commission/vendeur ici — tout reste autoritaire côté
// serveur (051/104). `box_recherche_reponses.status` ne possède PAS de
// valeur 'accepted' : la couverture affichée (« X/Y chevaux couverts »,
// « acceptés via cette réponse ») est TOUJOURS dérivée de box_reservations,
// recalculée à chaque chargement — jamais un état inventé côté front.
// Miroir de v2/components/MyTransportRecherchesReponses.tsx (Lot 4+5+6) —
// PAS une copie : pas de table de jonction chevaux×réservation côté Box.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/colors';
import { Spacing, FontSize, FontWeight } from '../../constants/theme';
import { Card, Section, PrimaryButton, GhostButton } from '../ui/kit';
import { BL } from '../ui/blush';
import { useUsersByIds } from '../../hooks/useUsersByIds';
import {
  useMyBoxRecherchesReponses, useAcceptBoxRechercheResponse, removeBoxRecherche,
  fetchAvailableChevauxForBoxRecherche, BoxRechercheChevalOption, ReceivedBoxReponse,
  MyBoxRechercheEntry, BoxRechercheCoverageCheval,
} from '../adapters/boxRecherches';
import { BoxAcceptedRecapModal } from './BoxAcceptedRecapModal';

function fmtDate(d?: string | null) {
  if (!d) return null;
  const dt = new Date(d && d.length >= 10 ? d : `${d}T00:00:00`);
  return isNaN(dt.getTime()) ? d : dt.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}
function fmtPeriode(a?: string | null, b?: string | null) {
  if (!a && !b) return null;
  return `${fmtDate(a) ?? '—'} → ${fmtDate(b) ?? '—'}`;
}
const RECHERCHE_STATUS_LABEL: Record<MyBoxRechercheEntry['status'], string> = {
  open: 'Recherche en cours',
  matched: 'Box trouvé',
  cancelled: 'Annulée',
};

export function MyBoxRecherchesReponses({
  onRemoveRecherche,
}: {
  /**
   * Optionnel — l'appelant (MesBoxV2.tsx) passe ici sa propre fonction de
   * retrait quand elle porte un effet de bord à préserver (resynchro « Mon
   * concours »). Sans prop, retombe sur `removeBoxRecherche` (DELETE simple).
   */
  onRemoveRecherche?: (id: string) => Promise<void> | void;
} = {}) {
  const { items, reload } = useMyBoxRecherchesReponses();
  const allOffreurIds = items.flatMap((i) => i.reponses.map((r) => r.offreurId));
  const usersById = useUsersByIds(allOffreurIds);
  const [acceptingFor, setAcceptingFor] = useState<string | null>(null);
  // Popup récap (Dan, retour test réel) : remplace le texte inline "Acceptée"
  // — mêmes données/actions que « Mes box », juste montrées immédiatement
  // au lieu de forcer à scroller jusqu'en bas de l'écran.
  const [recapIds, setRecapIds] = useState<string[] | null>(null);
  // Vue fusionnée (Dan, retour test réel) : avant, « Mes recherches » (liste
  // basique) et « Mes recherches Box » (couverture + réponses) affichaient
  // LES MÊMES recherches en double, à deux niveaux de détail différents —
  // confus. Une seule section maintenant, avec le retrait de recherche
  // rapatrié ici (ex-MesBoxV2.tsx, RLS box_recherches inchangée).
  const [removingId, setRemovingId] = useState<string | null>(null);
  const removeRecherche = async (id: string) => {
    if (removingId) return;
    setRemovingId(id);
    await (onRemoveRecherche ? onRemoveRecherche(id) : removeBoxRecherche(id));
    setRemovingId(null);
    reload();
  };

  if (items.length === 0) return null;

  return (
    <Section title={`Mes recherches · ${items.length}`}>
      {recapIds && <BoxAcceptedRecapModal reservationIds={recapIds} onClose={() => setRecapIds(null)} />}
      {items.map(({ recherche, chevaux, reponses }) => (
        <View key={recherche.id} style={s.group}>
          <Text style={s.rechercheHead}>
            🔎 {recherche.lieu || '—'}
            {recherche.concoursNom ? ` · 🏆 ${recherche.concoursNom}` : ''}
          </Text>
          <Text style={s.rechercheMeta}>
            {fmtPeriode(recherche.dateDebut, recherche.dateFin) ?? '—'} · {recherche.nbBox} box
            {recherche.litiereIncluse ? ' · litière souhaitée' : ''}
          </Text>
          <Text style={s.rechercheStatus}>{RECHERCHE_STATUS_LABEL[recherche.status]}</Text>
          {recherche.status === 'open' && (
            <Text
              style={s.remove}
              onPress={() => removingId !== recherche.id && removeRecherche(recherche.id)}
            >
              {removingId === recherche.id ? 'Retrait…' : 'Retirer ma recherche'}
            </Text>
          )}

          <CoverageSummary recherche={recherche} chevaux={chevaux} />

          {reponses.map((rep) => {
            const u = usersById.get(rep.offreurId);
            const nom = u ? `${u.prenom} ${u.nom?.charAt(0) ?? ''}.`.trim() : 'Un offreur';
            const a = rep.annonce;
            // rep.status reste TOUJOURS 'pending' (aucune valeur 'accepted' —
            // cf. en-tête du fichier) : le bouton reste proposé tant que la
            // recherche est 'open', qu'il reste des chevaux non couverts
            // rattachés à CETTE réponse ne bloque rien de plus — le serveur
            // (RPC) revérifiera tout de toute façon.
            const canAccept = recherche.status === 'open' && rep.status === 'pending';
            return (
              <Card key={rep.id} pad>
                <Text style={s.itemTitle}>👤 {nom}</Text>
                {a ? (
                  <>
                    <Text style={s.itemMeta}>🏠 {a.lieu}</Text>
                    <Text style={s.itemMeta}>
                      {a.nbBoxesDisponibles != null ? `${a.nbBoxesDisponibles} box disponible${a.nbBoxesDisponibles > 1 ? 's' : ''}` : ''}
                      {a.prixNuitHT != null ? ` · ${a.prixNuitHT} €/nuit` : ''}
                    </Text>
                  </>
                ) : (
                  <Text style={s.itemMeta}>Annonce indisponible.</Text>
                )}
                {rep.chevalIdsAcceptes.length > 0 ? (
                  <Text style={s.status}>
                    ✅ Acceptée pour {rep.chevalIdsAcceptes.length} cheval{rep.chevalIdsAcceptes.length > 1 ? 'aux' : ''}
                  </Text>
                ) : null}
                <Text style={s.status}>
                  {recherche.status !== 'open' ? '🔒 Recherche complètement couverte'
                    : rep.status === 'pending' ? '⏳ En attente de ta décision' : 'Déclinée'}
                </Text>

                {canAccept && acceptingFor === rep.id ? (
                  <AccepterPanel
                    recherche={recherche}
                    reponse={rep}
                    onCancel={() => setAcceptingFor(null)}
                    onDone={(reservationIds) => { setAcceptingFor(null); setRecapIds(reservationIds); reload(); }}
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

/**
 * Couverture réelle, recalculée depuis les données déjà chargées par
 * useMyBoxRecherchesReponses (elles-mêmes lues à chaque cycle depuis
 * box_recherche_chevaux/box_reservations). Aucun état inventé.
 */
function CoverageSummary({
  recherche, chevaux,
}: { recherche: MyBoxRechercheEntry; chevaux: BoxRechercheCoverageCheval[] }) {
  if (chevaux.length === 0) return null;
  const total = chevaux.length;
  const couvert = chevaux.filter((c) => c.couvert).length;
  const matched = recherche.status === 'matched';
  return (
    <View style={s.coverage}>
      <Text style={s.coverageCount}>{couvert} / {total} cheval{total > 1 ? 'aux' : ''} couvert{couvert > 1 ? 's' : ''}</Text>
      {chevaux.map((c) => (
        <Text key={c.id} style={s.coverageLine}>
          {c.couvert ? '✅' : '⏳'} {c.nom} — {c.couvert ? 'Box trouvé' : 'Box recherché'}
        </Text>
      ))}
      <Text style={matched ? s.coverageMatched : s.coverageOpen}>
        {matched ? '✅ Recherche complètement couverte' : '🔎 Recherche en cours'}
      </Text>
    </View>
  );
}

function AccepterPanel({
  recherche, reponse, onCancel, onDone,
}: {
  recherche: MyBoxRechercheEntry;
  reponse: ReceivedBoxReponse;
  onCancel: () => void;
  onDone: (reservationIds: string[]) => void;
}) {
  const { accept } = useAcceptBoxRechercheResponse();
  const [chevaux, setChevaux] = useState<BoxRechercheChevalOption[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchAvailableChevauxForBoxRecherche(recherche.id).then(({ chevaux: c, error: err }) => {
      if (cancelled) return;
      setChevaux(c);
      if (err) setError(err);
      // Un seul cheval possible → pas d'ambiguïté, on le pré-sélectionne
      // (Dan, retour test réel : « le cheval était déjà connu, pas besoin
      // de le resélectionner »). Reste un choix explicite si plusieurs.
      if (c.length === 1) setSelected(new Set([c[0].id]));
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
    if (sending) return; // anti-double-clic : appel déjà en cours
    setSending(true);
    setError(null);
    const { reservationIds, error: err } = await accept({ reponseId: reponse.id, chevalIds: Array.from(selected) });
    setSending(false);
    if (err) { setError(err); return; }
    onDone(reservationIds ?? []);
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

  const singleCheval = chevaux.length === 1 ? chevaux[0] : null;

  return (
    <View style={s.picker}>
      {singleCheval ? (
        <Text style={s.pickerLabel}>Confier {singleCheval.nom} à cette proposition ?</Text>
      ) : (
        <>
          <Text style={s.pickerLabel}>Quels chevaux confies-tu à cette proposition ?</Text>
          {chevaux.map((c) => (
            <Text key={c.id} style={s.chevalOpt} onPress={() => !sending && toggle(c.id)}>
              {selected.has(c.id) ? '☑ ' : '☐ '}{c.nom}
            </Text>
          ))}
        </>
      )}
      {error ? <Text style={s.errorTxt}>{error}</Text> : null}
      <View style={s.ctaRow}>
        <PrimaryButton
          label={sending ? 'Acceptation en cours…' : singleCheval ? 'Confirmer' : `Confirmer l'acceptation (${selected.size})`}
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
  rechercheMeta: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 1 },
  rechercheStatus: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.textTertiary, marginTop: 1 },
  remove: { fontSize: FontSize.xs, color: Colors.urgent, fontWeight: FontWeight.bold, marginTop: 2 },
  coverage: { backgroundColor: BL.accentSoft, borderColor: BL.accentLine, borderWidth: 1, borderRadius: 12, padding: Spacing.sm, gap: 2 },
  coverageCount: { fontSize: FontSize.sm, fontWeight: FontWeight.extrabold, color: Colors.textPrimary },
  coverageLine: { fontSize: FontSize.sm, color: Colors.textSecondary },
  coverageMatched: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.success, marginTop: 2 },
  coverageOpen: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.textTertiary, marginTop: 2 },
  itemTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  itemMeta: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  status: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: BL.accent, marginTop: Spacing.sm },
  ctaRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm, flexWrap: 'wrap' },
  picker: { marginTop: Spacing.sm, gap: 6 },
  pickerLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5 },
  chevalOpt: { fontSize: FontSize.sm, color: Colors.textPrimary, paddingVertical: 4 },
  emptyTxt: { fontSize: FontSize.sm, color: Colors.textSecondary },
  errorTxt: { fontSize: FontSize.xs, color: Colors.danger },
});
