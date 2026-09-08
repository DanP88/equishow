// ─────────────────────────────────────────────────────────────────────────────
// DemandeStatusCard — « État de la demande » (transport / box / coach).
//
//   Après une demande de réservation SIMULÉE : tant que le vendeur (transporteur
//   / loueur / coach) n'a pas validé, le module reste « ⏳ En attente ».
//   Un bouton de test simule la validation → le module passe « Organisé » /
//   « Coach prévu ».
//
// Phase 2 : l'état sera dérivé du vrai statut de la réservation (accepted) +
// du paiement (paid / completed). Le bouton de simulation disparaîtra.
// ─────────────────────────────────────────────────────────────────────────────
import { View, Text, StyleSheet } from 'react-native';
import { BL, FONT } from '../ui/blush';
import { Card, GhostButton, Placeholder } from '../ui/kit';

export function DemandeStatusCard({
  vendorLabel,
  confirmed,
  onSimulate,
}: {
  /** « transporteur » | « loueur » | « coach ». */
  vendorLabel: string;
  confirmed: boolean;
  onSimulate: () => void;
}) {
  return (
    <Card>
      <Text style={s.title}>État de la demande</Text>
      {confirmed ? (
        <Text style={s.sub}>
          ✅ Le {vendorLabel} a validé et le paiement (séquestre) est effectué.
        </Text>
      ) : (
        <>
          <Text style={s.sub}>
            ⏳ Traitement en cours : le {vendorLabel} doit <Text style={s.b}>valider</Text> ta demande,
            puis le <Text style={s.b}>paiement sous séquestre</Text> est effectué. Tant que ces deux
            étapes ne sont pas faites, ce n'est <Text style={s.b}>pas</Text> encore réglé.
          </Text>
          <GhostButton label={`▸ Simuler : le ${vendorLabel} valide + paiement effectué`} onPress={onSimulate} />
          <Placeholder note="Phase 2 : dérivé du vrai statut de la réservation + paiement (accepted / paid / completed)" />
        </>
      )}
    </Card>
  );
}

const s = StyleSheet.create({
  title: { fontFamily: FONT.head, fontSize: 15, fontWeight: '700', color: BL.ink },
  sub: { fontFamily: FONT.body, fontSize: 12, color: BL.sub, lineHeight: 17 },
  b: { fontWeight: '700', color: BL.ink },
});
