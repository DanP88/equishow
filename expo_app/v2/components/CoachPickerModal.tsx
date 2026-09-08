// ─────────────────────────────────────────────────────────────────────────────
// CoachPickerModal — sélection d'un coach (reprend l'UX « Rechercher un coach »
// de la V1 : liste + saisie libre). Utilisé par le coach permanent (G2).
//
// Candidats : auteurs d'annonces de coaching réelles + coachs de démo + saisie
// libre. FRONT-ONLY — ne fait que renvoyer le coach choisi via onPick.
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo, useState } from 'react';
import { View, Text, Modal, TextInput, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { BL, FONT } from '../ui/blush';
import { useCoachAnnonces } from '../../hooks/useCoachAnnonces';
import { MOCK_COACHES } from '../mocks/coach';
import type { CoachPermanent } from '../state/chevalCoachLocal';

const norm = (s: string) => s.trim().toLowerCase();
const initialsOf = (nom: string) =>
  nom.split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?';

export function CoachPickerModal({
  visible, onClose, onPick,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (coach: CoachPermanent) => void;
}) {
  const { annonces } = useCoachAnnonces();
  const [q, setQ] = useState('');

  const candidates = useMemo(() => {
    const byKey = new Map<string, CoachPermanent>();
    for (const a of annonces ?? []) {
      if (!a.auteurNom) continue;
      const key = a.auteurId || `n:${norm(a.auteurNom)}`;
      if (!byKey.has(key)) {
        byKey.set(key, {
          nom: a.auteurNom,
          userId: a.auteurId || undefined,
          initiales: a.auteurInitiales || initialsOf(a.auteurNom),
          couleur: a.auteurCouleur || '#7C3AED',
        });
      }
    }
    for (const m of MOCK_COACHES) {
      const key = `n:${norm(m.nom)}`;
      if (!byKey.has(key)) byKey.set(key, { nom: m.nom, initiales: m.initiales, couleur: m.couleur });
    }
    let list = [...byKey.values()].sort((x, y) => x.nom.localeCompare(y.nom));
    if (q.trim()) list = list.filter((c) => norm(c.nom).includes(norm(q)));
    return list;
  }, [annonces, q]);

  const pick = (c: CoachPermanent) => { onPick(c); setQ(''); onClose(); };
  const pickFree = () => {
    const nom = q.trim();
    if (!nom) return;
    pick({ nom, initiales: initialsOf(nom), couleur: '#7C3AED' });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={s.sheet}>
          <View style={s.grabber} />
          <Text style={s.title}>Choisir un coach</Text>
          <Text style={s.hint}>Coach qui accompagne ce cheval au quotidien (idéalement inscrit sur EquiShow).</Text>

          <TextInput
            style={s.input}
            value={q}
            onChangeText={setQ}
            placeholder="Rechercher ou saisir un nom…"
            placeholderTextColor={BL.faint}
            autoFocus
          />

          <ScrollView style={{ maxHeight: 320 }} contentContainerStyle={{ gap: 6, paddingBottom: 6 }} keyboardShouldPersistTaps="handled">
            {q.trim().length > 0 && !candidates.some((c) => norm(c.nom) === norm(q)) && (
              <TouchableOpacity style={[s.row, s.rowFree]} onPress={pickFree} activeOpacity={0.8}>
                <View style={[s.avatar, { backgroundColor: '#7C3AED' }]}><Text style={s.avatarTxt}>{initialsOf(q)}</Text></View>
                <Text style={s.rowName}>Utiliser « {q.trim()} »</Text>
              </TouchableOpacity>
            )}
            {candidates.map((c, i) => (
              <TouchableOpacity key={c.userId || `n${i}`} style={s.row} onPress={() => pick(c)} activeOpacity={0.8}>
                <View style={[s.avatar, { backgroundColor: c.couleur }]}><Text style={s.avatarTxt}>{c.initiales}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.rowName}>{c.nom}</Text>
                  {c.userId ? <Text style={s.rowMeta}>inscrit sur EquiShow</Text> : null}
                </View>
                <Text style={s.chev}>›</Text>
              </TouchableOpacity>
            ))}
            {candidates.length === 0 && !q.trim() && (
              <Text style={s.none}>Aucun coach dans la liste — saisis un nom.</Text>
            )}
          </ScrollView>

          <TouchableOpacity style={s.close} onPress={onClose}>
            <Text style={s.closeTxt}>Annuler</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(30,20,26,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: BL.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 18 },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: BL.accentLine, marginBottom: 10 },
  title: { fontFamily: FONT.head, fontSize: 19, fontWeight: '700', color: BL.ink },
  hint: { fontFamily: FONT.body, fontSize: 11.5, color: BL.sub, marginTop: 2, marginBottom: 10, lineHeight: 16 },
  input: { borderWidth: 1, borderColor: BL.line, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: BL.ink, backgroundColor: BL.card, marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: BL.card, borderWidth: 1, borderColor: BL.line, borderRadius: 12, paddingVertical: 9, paddingHorizontal: 11 },
  rowFree: { borderColor: BL.accentLine, backgroundColor: BL.accentSoft },
  avatar: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { color: '#fff', fontWeight: '800', fontSize: 12, fontFamily: FONT.body },
  rowName: { fontFamily: FONT.body, fontSize: 13.5, fontWeight: '700', color: BL.ink },
  rowMeta: { fontFamily: FONT.body, fontSize: 10, color: BL.accent, fontWeight: '600', marginTop: 1 },
  chev: { fontSize: 18, color: BL.faint },
  none: { fontFamily: FONT.body, fontSize: 12, color: BL.sub, fontStyle: 'italic', paddingVertical: 12, textAlign: 'center' },
  close: { marginTop: 12, alignItems: 'center', paddingVertical: 12, borderRadius: 999, borderWidth: 1, borderColor: BL.line, backgroundColor: BL.card },
  closeTxt: { fontFamily: FONT.body, fontSize: 13, fontWeight: '700', color: BL.sub },
});
