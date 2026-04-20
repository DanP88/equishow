import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView,
  TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Colors } from '../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../constants/theme';
import {
  messagesStore, userStore, notificationsStore,
  getOrCreateConversation, sendMessageToConv, markConvAsRead,
  Conversation,
} from '../data/store';
import { getUserById } from '../data/mockUsers';

const ANNONCE_COLORS: Record<string, string> = {
  transport: '#0369A1',
  box: '#F97316',
  coach: '#7C3AED',
};

export default function MessagerieScreen() {
  const params = useLocalSearchParams<{
    otherId?: string;
    otherNom?: string;
    otherPseudo?: string;
    otherCouleur?: string;
    otherInitiales?: string;
    sujet?: string;
    annonce?: string;
    annonceType?: string;
    // Legacy compat
    cavalierNom?: string;
    cavalierPseudo?: string;
    cavalierCouleur?: string;
    titre?: string;
  }>();

  const [convs, setConvs] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [tick, setTick] = useState(0); // force re-render
  const scrollRef = useRef<ScrollView>(null);

  const myId = userStore.id;

  // Refresh toutes les 400ms pour voir les messages entrants
  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 400);
    return () => clearInterval(iv);
  }, []);

  useFocusEffect(useCallback(() => {
    refreshConvs();
  }, []));

  function refreshConvs() {
    const mine = messagesStore.list.filter(c => c.participants.includes(myId));
    setConvs([...mine]);
  }

  // Ouvrir/créer une conversation depuis les params
  useEffect(() => {
    // Résoudre otherId depuis les params (nouveau format ou legacy)
    let otherId = params.otherId;
    let otherNom = params.otherNom;
    let otherPseudo = params.otherPseudo;
    let otherCouleur = params.otherCouleur ?? Colors.primary;
    let otherInitiales = params.otherInitiales;
    let sujet = params.sujet;
    let annonce = params.annonce;
    let annonceType = params.annonceType as 'transport' | 'box' | 'coach' | undefined;

    // Legacy: cavalierNom / titre (venant de l'agenda coach)
    if (!otherId && params.cavalierNom) {
      otherNom = params.cavalierNom;
      otherPseudo = params.cavalierPseudo ?? params.cavalierNom;
      otherCouleur = params.cavalierCouleur ?? Colors.primary;
      const parts = params.cavalierNom.split(' ');
      otherInitiales = parts.map(p => p[0]).join('').slice(0, 2).toUpperCase();
      sujet = params.titre ? `🎓 ${params.titre}` : '💬 Discussion';
      annonceType = 'coach';
    }

    if (!otherNom) return;

    // Chercher otherId dans les utilisateurs connus si pas fourni
    if (!otherId && otherPseudo) {
      const all = messagesStore.list.find(c => {
        const other = c.participants.find(p => p !== myId);
        return other && (c.userA.pseudo === otherPseudo || c.userB.pseudo === otherPseudo);
      });
      if (all) {
        setActiveConvId(all.id);
        markConvAsRead(all.id, myId);
        return;
      }
    }

    if (!otherId) return; // pas assez d'info pour créer

    const myNom = `${userStore.prenom} ${userStore.nom}`;
    const myPseudo = userStore.pseudo;
    const myCouleur = userStore.avatarColor;
    const myInitiales = `${userStore.prenom[0]}${userStore.nom[0]}`;

    const conv = getOrCreateConversation(
      myId, myNom, myPseudo, myCouleur, myInitiales,
      otherId, otherNom!, otherPseudo ?? otherNom!, otherCouleur, otherInitiales ?? (otherNom!.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()),
      sujet, annonce, annonceType,
    );
    refreshConvs();
    setActiveConvId(conv.id);
    markConvAsRead(conv.id, myId);
  }, [params.otherId, params.cavalierNom, params.otherNom]);

  const activeConv = activeConvId ? messagesStore.list.find(c => c.id === activeConvId) ?? null : null;

  // Infos de l'autre dans la conv active
  const otherUser = activeConv
    ? (activeConv.userA.id === myId ? activeConv.userB : activeConv.userA)
    : null;

  function openConv(conv: Conversation) {
    markConvAsRead(conv.id, myId);
    setActiveConvId(conv.id);
    setTick(t => t + 1);
  }

  function handleSend() {
    if (!message.trim() || !activeConv) return;
    sendMessageToConv(activeConv.id, myId, message.trim());
    setMessage('');
    setTick(t => t + 1);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
  }

  // ── Vue conversation active ──
  if (activeConv && otherUser) {
    // Marquer comme lu à chaque render
    markConvAsRead(activeConv.id, myId);
    const msgs = activeConv.messages;

    return (
      <SafeAreaView style={s.root}>
        <View style={s.convHeader}>
          <TouchableOpacity style={s.backBtn} onPress={() => { setActiveConvId(null); refreshConvs(); }}>
            <Text style={s.backIcon}>‹</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.convHeaderInfo}
            onPress={() => router.push({ pathname: '/cavalier/[id]', params: { id: otherUser.id } } as any)}
            activeOpacity={0.7}
          >
            <View style={[s.convAvatar, { backgroundColor: otherUser.couleur }]}>
              <Text style={s.convAvatarText}>{otherUser.initiales}</Text>
            </View>
            <View>
              <Text style={s.convName}>{otherUser.nom}</Text>
              <Text style={s.convPseudo}>@{otherUser.pseudo} · voir profil ›</Text>
            </View>
          </TouchableOpacity>
        </View>

        {activeConv.annonce && (
          <View style={[s.annonceTag, { backgroundColor: ANNONCE_COLORS[activeConv.annonceType!] + '18', borderColor: ANNONCE_COLORS[activeConv.annonceType!] + '55' }]}>
            <Text style={[s.annonceTagText, { color: ANNONCE_COLORS[activeConv.annonceType!] }]}>
              {activeConv.sujet} · {activeConv.annonce}
            </Text>
          </View>
        )}

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={s.messages}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
          >
            {msgs.length === 0 && (
              <Text style={s.noMsgText}>Commencez la discussion...</Text>
            )}
            {msgs.map((msg) => {
              const isMine = msg.senderId === myId;
              return (
                <View key={msg.id} style={[s.msgRow, isMine && s.msgRowMoi]}>
                  {!isMine && (
                    <View style={[s.smallAvatar, { backgroundColor: otherUser.couleur }]}>
                      <Text style={s.smallAvatarText}>{otherUser.initiales}</Text>
                    </View>
                  )}
                  <View style={[s.bubble, isMine ? s.bubbleMoi : s.bubbleEux]}>
                    <Text style={[s.bubbleText, isMine && s.bubbleTextMoi]}>{msg.texte}</Text>
                    <Text style={[s.bubbleTime, isMine && s.bubbleTimeMoi]}>{msg.heure}</Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>

          <View style={s.inputRow}>
            <TextInput
              style={s.input}
              value={message}
              onChangeText={setMessage}
              placeholder="Votre message..."
              placeholderTextColor={Colors.textTertiary}
              multiline
              onSubmitEditing={handleSend}
            />
            <TouchableOpacity
              style={[s.sendBtn, !message.trim() && s.sendBtnDisabled]}
              onPress={handleSend}
              disabled={!message.trim()}
            >
              <Text style={s.sendIcon}>➤</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ── Liste des conversations ──
  const myConvs = messagesStore.list.filter(c => c.participants.includes(myId));

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Text style={s.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Messages</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.list}>
        {myConvs.length === 0 ? (
          <View style={s.empty}>
            <Text style={s.emptyIcon}>💬</Text>
            <Text style={s.emptyTitle}>Aucun message</Text>
            <Text style={s.emptyText}>Vos conversations apparaîtront ici.</Text>
          </View>
        ) : (
          myConvs.map((c) => {
            const other = c.userA.id === myId ? c.userB : c.userA;
            const nonLus = c.unreadBy[myId] ?? 0;
            return (
              <TouchableOpacity key={c.id} style={s.convCard} onPress={() => openConv(c)} activeOpacity={0.85}>
                <View style={[s.convAvatar, { backgroundColor: other.couleur }]}>
                  <Text style={s.convAvatarText}>{other.initiales}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={s.convTopRow}>
                    <Text style={[s.convCardName, nonLus > 0 && s.convCardNameBold]}>{other.nom}</Text>
                    <Text style={s.convTime}>{c.heure}</Text>
                  </View>
                  <Text style={s.convSujet}>{c.sujet}</Text>
                  <Text style={[s.convLastMsg, nonLus > 0 && s.convLastMsgBold]} numberOfLines={1}>
                    {c.dernierMsg || 'Démarrez la conversation...'}
                  </Text>
                </View>
                {nonLus > 0 && (
                  <View style={s.nonLusBadge}>
                    <Text style={s.nonLusText}>{nonLus > 9 ? '9+' : nonLus}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.surface },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surfaceVariant, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 24, color: Colors.textPrimary, lineHeight: 28 },
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  list: { padding: Spacing.lg, gap: Spacing.sm },
  empty: { alignItems: 'center', paddingVertical: 60, gap: Spacing.md },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  emptyText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  convCard: { backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.lg, flexDirection: 'row', alignItems: 'center', gap: Spacing.md, borderWidth: 1, borderColor: Colors.border, ...Shadow.card },
  convAvatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  convAvatarText: { color: Colors.textInverse, fontSize: FontSize.base, fontWeight: FontWeight.bold },
  convTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  convCardName: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  convCardNameBold: { fontWeight: FontWeight.extrabold },
  convTime: { fontSize: FontSize.xs, color: Colors.textTertiary },
  convSujet: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: FontWeight.semibold, marginTop: 2 },
  convLastMsg: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  convLastMsgBold: { fontWeight: FontWeight.bold, color: Colors.textPrimary },
  nonLusBadge: { width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  nonLusText: { color: Colors.textInverse, fontSize: 11, fontWeight: FontWeight.bold },

  // Conversation view
  convHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.surface },
  convHeaderInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  convName: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  convPseudo: { fontSize: FontSize.xs, color: Colors.primary },

  annonceTag: { marginHorizontal: Spacing.md, marginTop: Spacing.sm, borderRadius: Radius.md, padding: Spacing.sm, borderWidth: 1 },
  annonceTagText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },

  messages: { padding: Spacing.lg, gap: Spacing.sm, paddingBottom: 20 },
  noMsgText: { textAlign: 'center', color: Colors.textTertiary, fontSize: FontSize.sm, paddingVertical: 40 },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  msgRowMoi: { justifyContent: 'flex-end' },
  smallAvatar: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  smallAvatarText: { fontSize: 10, fontWeight: FontWeight.bold, color: '#fff' },
  bubble: { maxWidth: '78%', borderRadius: Radius.xl, padding: Spacing.md, gap: 4 },
  bubbleMoi: { backgroundColor: Colors.primary, borderBottomRightRadius: 4 },
  bubbleEux: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: FontSize.base, color: Colors.textPrimary, lineHeight: 20 },
  bubbleTextMoi: { color: Colors.textInverse },
  bubbleTime: { fontSize: 10, color: Colors.textTertiary, alignSelf: 'flex-end' },
  bubbleTimeMoi: { color: 'rgba(255,255,255,0.65)' },

  inputRow: { flexDirection: 'row', gap: Spacing.sm, padding: Spacing.md, backgroundColor: Colors.surface, borderTopWidth: 1, borderTopColor: Colors.border },
  input: { flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.xl, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, fontSize: FontSize.base, color: Colors.textPrimary, backgroundColor: Colors.surfaceVariant, maxHeight: 100 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { backgroundColor: Colors.borderMedium },
  sendIcon: { color: Colors.textInverse, fontSize: 16 },
});
