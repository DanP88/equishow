import { useState, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView,
  TextInput, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors } from '../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../constants/theme';
import { userStore } from '../data/store';
import {
  useConversations, useConversationMessages, getOrCreateConversation,
} from '../hooks/useMessaging';

const ANNONCE_COLORS: Record<string, string> = {
  transport: '#0369A1',
  box: '#F97316',
  coach: '#7C3AED',
};

function hhmm(d: Date | null) {
  if (!d) return '';
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

type Other = { id: string; nom: string; pseudo: string; couleur: string; initiales: string };

export default function MessagerieScreen() {
  const params = useLocalSearchParams<{
    otherId?: string; otherNom?: string; otherPseudo?: string; otherCouleur?: string; otherInitiales?: string;
    sujet?: string; annonce?: string; annonceType?: string;
    // Legacy compat (agenda coach)
    cavalierNom?: string; cavalierPseudo?: string; cavalierCouleur?: string; titre?: string;
  }>();

  const { conversations, reload } = useConversations();
  const [active, setActive] = useState<{ convId: string; other: Other } | null>(null);
  const [message, setMessage] = useState('');
  const [creating, setCreating] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const myId = userStore.id;

  const { messages, send, markRead } = useConversationMessages(active?.convId);

  // Ouvre/crée une conversation depuis les params (une seule fois).
  const didInit = useRef(false);
  useEffect(() => {
    if (didInit.current || !params.otherId) return;
    didInit.current = true;
    const otherNom = params.otherNom ?? params.cavalierNom ?? 'Utilisateur';
    const other: Other = {
      id: params.otherId,
      nom: otherNom,
      pseudo: params.otherPseudo ?? params.cavalierPseudo ?? otherNom,
      couleur: params.otherCouleur ?? params.cavalierCouleur ?? Colors.primary,
      initiales: params.otherInitiales ?? otherNom.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase(),
    };
    const me: Other = {
      id: myId,
      nom: `${userStore.prenom} ${userStore.nom}`.trim() || 'Moi',
      pseudo: userStore.pseudo ?? '',
      couleur: userStore.avatarColor ?? Colors.primary,
      initiales: `${(userStore.prenom || '?')[0] ?? ''}${(userStore.nom || '')[0] ?? ''}`.toUpperCase(),
    };
    (async () => {
      setCreating(true);
      const { id } = await getOrCreateConversation({
        me, other,
        sujet: params.sujet ?? (params.titre ? `🎓 ${params.titre}` : undefined),
        annonce: params.annonce,
        annonceType: params.annonceType,
      });
      setCreating(false);
      if (id) { setActive({ convId: id, other }); reload(); }
    })();
  }, [params.otherId]);

  // Marquer comme lu quand la conv est ouverte / nouveaux messages.
  useEffect(() => {
    if (active?.convId) markRead();
  }, [active?.convId, messages.length, markRead]);

  async function handleSend() {
    const text = message.trim();
    if (!text || !active?.convId) return;
    setMessage('');
    await send(text);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
  }

  // ── Vue conversation active ──
  if (active) {
    const other = active.other;
    const annonceType = (params.annonceType as string) || 'coach';
    return (
      <SafeAreaView style={s.root}>
        <View style={s.convHeader}>
          <TouchableOpacity style={s.backBtn} onPress={() => { setActive(null); reload(); }}>
            <Text style={s.backIcon}>‹</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.convHeaderInfo}
            onPress={() => router.push({ pathname: '/cavalier/[id]', params: { id: other.id } } as any)}
            activeOpacity={0.7}
          >
            <View style={[s.convAvatar, { backgroundColor: other.couleur }]}>
              <Text style={s.convAvatarText}>{other.initiales}</Text>
            </View>
            <View>
              <Text style={s.convName}>{other.nom}</Text>
              <Text style={s.convPseudo}>@{other.pseudo} · voir profil ›</Text>
            </View>
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={s.messages}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
          >
            {messages.length === 0 && (
              <Text style={s.noMsgText}>Commencez la discussion...</Text>
            )}
            {messages.map((msg) => {
              const isMine = msg.senderId === myId;
              return (
                <View key={msg.id} style={[s.msgRow, isMine && s.msgRowMoi]}>
                  {!isMine && (
                    <View style={[s.smallAvatar, { backgroundColor: other.couleur }]}>
                      <Text style={s.smallAvatarText}>{other.initiales}</Text>
                    </View>
                  )}
                  <View style={[s.bubble, isMine ? s.bubbleMoi : s.bubbleEux]}>
                    <Text style={[s.bubbleText, isMine && s.bubbleTextMoi]}>{msg.contenu}</Text>
                    <Text style={[s.bubbleTime, isMine && s.bubbleTimeMoi]}>{hhmm(msg.createdAt)}</Text>
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
  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.canGoBack() ? router.back() : router.replace('/')}>
          <Text style={s.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Messages</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.list}>
        {creating && <ActivityIndicator color={Colors.primary} style={{ marginTop: Spacing.lg }} />}
        {conversations.length === 0 && !creating ? (
          <View style={s.empty}>
            <Text style={s.emptyIcon}>💬</Text>
            <Text style={s.emptyTitle}>Aucun message</Text>
            <Text style={s.emptyText}>Vos conversations apparaîtront ici.</Text>
          </View>
        ) : (
          conversations.map((c) => (
            <TouchableOpacity
              key={c.id}
              style={s.convCard}
              onPress={() => setActive({ convId: c.id, other: { id: c.otherId, nom: c.otherNom, pseudo: c.otherPseudo, couleur: c.otherCouleur, initiales: c.otherInitiales } })}
              activeOpacity={0.85}
            >
              <View style={[s.convAvatar, { backgroundColor: c.otherCouleur }]}>
                <Text style={s.convAvatarText}>{c.otherInitiales}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={s.convTopRow}>
                  <Text style={[s.convCardName, c.unread && s.convCardNameBold]}>{c.otherNom}</Text>
                  <Text style={s.convTime}>{hhmm(c.lastMessageAt)}</Text>
                </View>
                <Text style={s.convSujet}>{c.sujet}</Text>
                <Text style={[s.convLastMsg, c.unread && s.convLastMsgBold]} numberOfLines={1}>
                  {c.dernierMsg || 'Démarrez la conversation...'}
                </Text>
              </View>
              {c.unread && <View style={s.nonLusDot} />}
            </TouchableOpacity>
          ))
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
  nonLusDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: Colors.primary, flexShrink: 0 },

  // Conversation view
  convHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.surface },
  convHeaderInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  convName: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  convPseudo: { fontSize: FontSize.xs, color: Colors.primary },

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
