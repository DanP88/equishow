// ─────────────────────────────────────────────────────────────────────────────
// CoachsPresentsModal — G1. Popup « Coachs présents » d'un concours.
//
// Point d'accès aux coachs présents : profil · contacter (SIMULÉ en phase
// front-only) · voir son annonce de coaching POUR CE concours (si elle existe).
// Dédup assurée en amont par useConcoursCoaches (par users.id).
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { View, Text, Modal, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { BL, FONT } from '../ui/blush';
import { useConcoursCoaches, PresentCoach } from '../adapters/concoursCoaches';
import { useCoachContacts } from '../state/coachContactLocal';

export function CoachsPresentsModal({
  visible, onClose, concoursId, concoursNom,
}: {
  visible: boolean;
  onClose: () => void;
  concoursId?: string;
  concoursNom?: string;
}) {
  const { coaches, demo } = useConcoursCoaches(concoursId);
  const { contact } = useCoachContacts();
  const [contacted, setContacted] = useState<Record<string, boolean>>({});

  const go = (path: string) => { onClose(); router.push(path as any); };

  const onContact = (c: PresentCoach) => {
    contact({
      coachUserId: c.userId,
      coachNom: c.nom,
      coachInitiales: c.initiales,
      coachCouleur: c.couleur,
      concoursId,
      concoursNom,
    });
    setContacted((s) => ({ ...s, [c.key]: true }));
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <TouchableOpacity style={s.backdropTap} activeOpacity={1} onPress={onClose} />
        <View style={s.sheet}>
          <View style={s.grabber} />
          <Text style={s.title}>Coachs présents</Text>
          <Text style={s.subtitle}>Les coachs disponibles ou déjà présents sur ce concours</Text>

          <ScrollView style={{ maxHeight: 460 }} contentContainerStyle={s.list} showsVerticalScrollIndicator={false}>
            {coaches.length === 0 ? (
              <View style={s.empty}>
                <Text style={s.emptyTxt}>Aucun coach n'est encore indiqué comme présent sur ce concours.</Text>
              </View>
            ) : (
              coaches.map((c) => (
                <View key={c.key} style={s.card}>
                  <View style={s.head}>
                    <View style={[s.avatar, { backgroundColor: c.couleur }]}>
                      <Text style={s.avatarTxt}>{c.initiales}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.name}>{c.nom}{c.note ? `   ★ ${c.note}` : ''}</Text>
                      <Text style={s.present}>Coach présent sur ce concours</Text>
                      {c.disciplines ? <Text style={s.disc}>{c.disciplines}{c.niveaux ? ` · ${c.niveaux}` : ''}</Text> : null}
                    </View>
                  </View>

                  <View style={s.actions}>
                    {c.userId ? (
                      <TouchableOpacity style={s.act} onPress={() => go(`/user-profile/${c.userId}`)}>
                        <Text style={s.actTxt}>Voir le profil</Text>
                      </TouchableOpacity>
                    ) : null}

                    <TouchableOpacity style={s.act} onPress={() => onContact(c)}>
                      <Text style={s.actTxt}>{contacted[c.key] ? '✓ Contact enregistré' : 'Contacter'}</Text>
                    </TouchableOpacity>

                    {c.annonceId ? (
                      <TouchableOpacity
                        style={[s.act, s.actPrimary]}
                        onPress={() => go(`/(v2)/coach/detail?id=${c.annonceId}${concoursId ? `&concoursId=${concoursId}` : ''}`)}
                      >
                        <Text style={[s.actTxt, s.actPrimaryTxt]}>Voir son annonce</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  {contacted[c.key] && (
                    <Text style={s.contactNote}>
                      Message simulé — la messagerie réelle sera branchée en Phase 2.{' '}
                      <Text style={s.contactLink} onPress={() => go('/(v2)/messagerie')}>Ouvrir la messagerie ›</Text>
                    </Text>
                  )}
                </View>
              ))
            )}

            {demo && <Text style={s.demo}>· coachs de démonstration — connecte-toi pour voir les vrais</Text>}
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

  list: { gap: 10, paddingBottom: 6 },
  empty: { backgroundColor: BL.card, borderRadius: 16, borderWidth: 1, borderColor: BL.line, padding: 18 },
  emptyTxt: { fontFamily: FONT.body, fontSize: 13, color: BL.sub, textAlign: 'center', lineHeight: 19 },

  card: { backgroundColor: BL.card, borderRadius: 16, borderWidth: 1, borderColor: BL.line, padding: 13, gap: 10 },
  head: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { color: '#fff', fontWeight: '800', fontSize: 13, fontFamily: FONT.body },
  name: { fontFamily: FONT.head, fontSize: 15, fontWeight: '700', color: BL.ink },
  present: { fontFamily: FONT.body, fontSize: 10.5, color: BL.accent, fontWeight: '700', marginTop: 1 },
  disc: { fontFamily: FONT.body, fontSize: 11, color: BL.sub, marginTop: 2 },

  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  act: { borderWidth: 1, borderColor: BL.accentLine, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: BL.card },
  actTxt: { fontFamily: FONT.body, fontSize: 11.5, color: BL.accent, fontWeight: '700' },
  actPrimary: { backgroundColor: BL.accent, borderColor: BL.accent },
  actPrimaryTxt: { color: BL.accentInk },

  contactNote: { fontFamily: FONT.body, fontSize: 10.5, color: BL.sub, lineHeight: 15 },
  contactLink: { color: BL.accent, fontWeight: '700' },
  demo: { fontFamily: FONT.body, fontSize: 10.5, color: BL.faint, fontStyle: 'italic', marginTop: 6 },

  close: { marginTop: 12, alignItems: 'center', paddingVertical: 12, borderRadius: 999, borderWidth: 1, borderColor: BL.line, backgroundColor: BL.card },
  closeTxt: { fontFamily: FONT.body, fontSize: 13, fontWeight: '700', color: BL.sub },
});
