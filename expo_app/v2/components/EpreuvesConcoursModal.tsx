// ─────────────────────────────────────────────────────────────────────────────
// EpreuvesConcoursModal — liste des épreuves d'un concours (retour testeur :
// la ligne "Épreuves du concours · N" n'ouvrait rien). Lecture seule, réutilise
// le parsing déjà existant (epreuveOptions, v2/lib/epreuves.ts).
// ─────────────────────────────────────────────────────────────────────────────
import { View, Text, Modal, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { BL, FONT } from '../ui/blush';
import { epreuveOptions } from '../lib/epreuves';

export function EpreuvesConcoursModal({
  visible, onClose, concours,
}: {
  visible: boolean;
  onClose: () => void;
  concours?: { liste_epreuves?: string[] | null; type_concours?: string | null } | null;
}) {
  const epr = epreuveOptions(concours);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <TouchableOpacity style={s.backdropTap} activeOpacity={1} onPress={onClose} />
        <View style={s.sheet}>
          <View style={s.grabber} />
          <Text style={s.title}>Épreuves du concours</Text>
          <Text style={s.subtitle}>
            {epr.source === 'concours'
              ? `${epr.list.length} épreuve${epr.list.length > 1 ? 's' : ''} publiée${epr.list.length > 1 ? 's' : ''}`
              : `Liste type${epr.discipline ? ` ${epr.discipline}` : ''} — ce concours n'a pas publié ses épreuves`}
          </Text>

          <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={s.list} showsVerticalScrollIndicator={false}>
            {epr.list.length === 0 ? (
              <View style={s.empty}><Text style={s.emptyTxt}>Aucune épreuve disponible pour ce concours.</Text></View>
            ) : (
              epr.list.map((label, i) => (
                <View key={`${label}-${i}`} style={s.row}><Text style={s.rowTxt}>{label}</Text></View>
              ))
            )}
            {epr.source === 'type' && <Text style={s.demo}>· liste type FFE — à confirmer sur la FFE</Text>}
          </ScrollView>

          <TouchableOpacity style={s.close} onPress={onClose}>
            <Text style={s.closeTxt}>Fermer</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(30,20,26,0.45)', justifyContent: 'flex-end' },
  backdropTap: { flex: 1 },
  sheet: { backgroundColor: BL.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 18 },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: BL.accentLine, marginBottom: 10 },
  title: { fontFamily: FONT.head, fontSize: 20, fontWeight: '700', color: BL.ink },
  subtitle: { fontFamily: FONT.body, fontSize: 12, color: BL.sub, marginTop: 2, marginBottom: 12 },

  list: { gap: 8, paddingBottom: 6 },
  empty: { backgroundColor: BL.card, borderRadius: 16, borderWidth: 1, borderColor: BL.line, padding: 18 },
  emptyTxt: { fontFamily: FONT.body, fontSize: 13, color: BL.sub, textAlign: 'center', lineHeight: 19 },

  row: { backgroundColor: BL.card, borderRadius: 12, borderWidth: 1, borderColor: BL.line, paddingHorizontal: 12, paddingVertical: 10 },
  rowTxt: { fontFamily: FONT.body, fontSize: 13, color: BL.ink },

  demo: { fontFamily: FONT.body, fontSize: 10.5, color: BL.faint, fontStyle: 'italic', marginTop: 6 },

  close: { marginTop: 12, alignItems: 'center', paddingVertical: 12, borderRadius: 999, borderWidth: 1, borderColor: BL.line, backgroundColor: BL.card },
  closeTxt: { fontFamily: FONT.body, fontSize: 13, fontWeight: '700', color: BL.sub },
});
