// ─────────────────────────────────────────────────────────────────────────────
// OrganisateurPendingModal — validation « Organisateur » SIMULÉE (Phase 1).
//
// Reproduit le comportement V1 (compte-type : « le compte Organisateur est
// réservé aux structures vérifiées ») mais en version compte omni :
//  - la capacité organisateur est ajoutée en statut 'pending' ;
//  - cette pop-up informe qu'un email part vers l'admin ;
//  - AUCUN email n'est réellement envoyé, AUCUN appel backend.
//
// L'« approbation admin » se simule ensuite depuis le panneau DEV
// (useCapabilities().approveOrganisateur()).
// ─────────────────────────────────────────────────────────────────────────────
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../../constants/theme';

export function OrganisateurPendingModal({
  visible,
  structure,
  onClose,
}: {
  visible: boolean;
  structure?: string;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={s.card}>
          <Text style={s.icon}>📨</Text>
          <Text style={s.title}>Demande envoyée</Text>
          <Text style={s.body}>
            Un email a été envoyé à l’équipe EquiShow pour valider votre compte
            organisateur{structure ? ` (« ${structure} »)` : ''}.
            {'\n\n'}
            En attendant la validation, vous pouvez utiliser EquiShow normalement
            avec vos autres activités. Le statut « Organisateur » apparaîtra comme
            <Text style={s.bold}> en attente</Text> dans votre profil.
          </Text>
          <View style={s.simTag}>
            <Text style={s.simTagTxt}>PROTOTYPE — email &amp; validation simulés (aucun envoi réel)</Text>
          </View>
          <TouchableOpacity style={s.btn} onPress={onClose} activeOpacity={0.85}>
            <Text style={s.btnTxt}>J’ai compris</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  card: { backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.xl, alignItems: 'center', maxWidth: 360, ...Shadow.modal },
  icon: { fontSize: 44, marginBottom: Spacing.sm },
  title: { fontSize: FontSize.xxl, fontWeight: FontWeight.extrabold, color: Colors.textPrimary, marginBottom: Spacing.sm, textAlign: 'center' },
  body: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20, textAlign: 'center' },
  bold: { fontWeight: FontWeight.bold, color: Colors.textPrimary },
  simTag: { marginTop: Spacing.md, backgroundColor: Colors.warningBg, borderColor: Colors.warningBorder, borderWidth: 1, borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 4 },
  simTagTxt: { fontSize: FontSize.xs, color: Colors.warning, fontWeight: FontWeight.semibold, textAlign: 'center' },
  btn: { marginTop: Spacing.lg, backgroundColor: Colors.primary, borderRadius: Radius.lg, paddingVertical: Spacing.md + 2, paddingHorizontal: Spacing.xxl, alignItems: 'center', alignSelf: 'stretch' },
  btnTxt: { color: Colors.textInverse, fontWeight: FontWeight.extrabold, fontSize: FontSize.base },
});
