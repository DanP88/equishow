// ─────────────────────────────────────────────────────────────────────────────
// OpenBoxRecherches — BOX-2 (lecture) + BOX-3 (réponse) : liste temps réel
// des recherches Box 'open' (migration 114, realtime déjà actif depuis 114
// elle-même), avec réponse réelle de l'offreur via une de ses VRAIES annonces.
//
// BOX-3 — pas encore : acceptation par le demandeur, réservation. Une réponse
// reste 'pending' tant qu'un lot suivant ne la fait pas transiter (RPC
// accept_box_recherche_response, déjà en place côté serveur depuis 114).
// Si l'offreur n'a AUCUNE annonce, on ne crée rien : on l'invite à en publier
// une via « Je propose » (aucune réponse fantôme sans annonce réelle).
// Miroir de v2/components/OpenTransportRecherches.tsx (Lot 2+3).
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Spacing, FontSize, FontWeight } from '../../constants/theme';
import { Card, PrimaryButton, GhostButton } from '../ui/kit';
import { BL } from '../ui/blush';
import { useUsersByIds } from '../../hooks/useUsersByIds';
import { useMyBoxAnnonces } from '../../hooks/useBoxes';
import { useOpenBoxRecherches, useBoxRechercheReponses, OpenBoxRecherche } from '../adapters/boxRecherches';

function fmtDate(d?: string | null) {
  if (!d) return null;
  const dt = new Date(`${d}T00:00:00`);
  return isNaN(dt.getTime()) ? d : dt.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

export function OpenBoxRecherches() {
  const { recherches, isLoading } = useOpenBoxRecherches();
  const { annonces: myAnnonces } = useMyBoxAnnonces();
  const { myReponses, respond } = useBoxRechercheReponses();
  const usersById = useUsersByIds(recherches.map((r) => r.demandeurId));
  const [openPickerFor, setOpenPickerFor] = useState<string | null>(null);

  if (!isLoading && recherches.length === 0) return null;

  return (
    <View style={s.wrap}>
      <Text style={s.title}>🔎 Recherches en cours{recherches.length > 0 ? ` (${recherches.length})` : ''}</Text>
      {recherches.map((r) => {
        const u = usersById.get(r.demandeurId);
        const nom = u ? `${u.prenom} ${u.nom?.charAt(0) ?? ''}.`.trim() : 'Un cavalier';
        const dates = [fmtDate(r.dateDebut), fmtDate(r.dateFin)].filter(Boolean).join(' → ');
        const dejaRepondu = myReponses.some((rep) => rep.rechercheId === r.id);
        return (
          <Card key={r.id} pad>
            <Text style={s.lieu}>{r.lieu || '—'}</Text>
            <Text style={s.meta}>
              {nom} · {r.nbBox} box{r.nbBox > 1 ? 's' : ''}{dates ? ` · ${dates}` : ''}{r.litiereIncluse ? ' · litière souhaitée' : ''}
            </Text>
            {r.concoursNom ? <Text style={s.meta}>🏆 {r.concoursNom}</Text> : null}

            {dejaRepondu ? (
              <Text style={s.sent}>✅ Réponse envoyée</Text>
            ) : openPickerFor === r.id ? (
              <RepondrePicker
                recherche={r}
                annonces={myAnnonces}
                onCancel={() => setOpenPickerFor(null)}
                onSent={() => setOpenPickerFor(null)}
                respond={respond}
              />
            ) : (
              <View style={s.ctaRow}>
                <GhostButton label="Répondre" onPress={() => setOpenPickerFor(r.id)} />
              </View>
            )}
          </Card>
        );
      })}
    </View>
  );
}

function RepondrePicker({
  recherche, annonces, onCancel, onSent, respond,
}: {
  recherche: OpenBoxRecherche;
  annonces: { id: string; lieu: string; prixNuitHT: number; nbBoxesDisponibles: number }[];
  onCancel: () => void;
  onSent: () => void;
  respond: (input: { rechercheId: string; annonceId: string }) => Promise<{ id: string | null; error: string | null }>;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(annonces[0]?.id ?? null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (annonces.length === 0) {
    return (
      <View style={s.picker}>
        <Text style={s.emptyTxt}>Tu n'as aucune annonce Box pour l'instant.</Text>
        <View style={s.ctaRow}>
          <PrimaryButton label="Publier une annonce" onPress={() => router.push('/(v2)/box?face=propose' as any)} />
          <GhostButton label="Annuler" onPress={onCancel} />
        </View>
      </View>
    );
  }

  const send = async () => {
    if (!selectedId) return;
    setSending(true);
    setError(null);
    const { error: err } = await respond({ rechercheId: recherche.id, annonceId: selectedId });
    setSending(false);
    if (err) { setError(err); return; }
    onSent();
  };

  return (
    <View style={s.picker}>
      <Text style={s.pickerLabel}>Répondre avec quelle annonce ?</Text>
      {annonces.map((a) => (
        <Text
          key={a.id}
          style={[s.annonceOpt, selectedId === a.id && s.annonceOptSelected]}
          onPress={() => setSelectedId(a.id)}
        >
          {selectedId === a.id ? '● ' : '○ '}{a.lieu} · {a.nbBoxesDisponibles} box · {a.prixNuitHT} €/nuit
        </Text>
      ))}
      {error ? <Text style={s.errorTxt}>{error}</Text> : null}
      <View style={s.ctaRow}>
        <PrimaryButton label={sending ? 'Envoi…' : 'Envoyer ma réponse'} onPress={send} disabled={sending || !selectedId} />
        <GhostButton label="Annuler" onPress={onCancel} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: Spacing.sm, marginTop: Spacing.md },
  title: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textSecondary },
  lieu: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  meta: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  sent: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.success, marginTop: Spacing.sm },
  ctaRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm, flexWrap: 'wrap' },
  picker: { marginTop: Spacing.sm, gap: 6 },
  pickerLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5 },
  annonceOpt: { fontSize: FontSize.sm, color: Colors.textPrimary, paddingVertical: 4 },
  annonceOptSelected: { color: BL.accent, fontWeight: FontWeight.bold },
  emptyTxt: { fontSize: FontSize.sm, color: Colors.textSecondary },
  errorTxt: { fontSize: FontSize.xs, color: Colors.danger },
});
