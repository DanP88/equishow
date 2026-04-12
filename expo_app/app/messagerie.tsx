import { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView,
  TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../constants/theme';

type Conversation = {
  id: string;
  with: string;
  pseudo: string;
  couleur: string;
  initiales: string;
  sujet: string;
  dernierMsg: string;
  heure: string;
  nonLus: number;
  annonce?: string;
  annonceType?: 'transport' | 'box' | 'coach';
  messages: { id: string; moi: boolean; texte: string; heure: string }[];
};

const MOCK_CONVS: Conversation[] = [
  {
    id: 'conv1',
    with: 'Marie Dupont',
    pseudo: 'MarieDup_KWPN',
    couleur: '#7C3AED',
    initiales: 'MD',
    sujet: '🚐 Transport Grenoble → Lyon',
    dernierMsg: 'Parfait, je confirme la réservation !',
    heure: '14:32',
    nonLus: 2,
    annonce: 'Grenoble → Lyon · 14 avr',
    annonceType: 'transport',
    messages: [
      { id: 'm1', moi: false, texte: 'Bonjour ! Il me reste 2 places pour le 14 avril, départ Grenoble 6h. Cela vous convient ?', heure: '13:45' },
      { id: 'm2', moi: true, texte: "Parfait ! Est-ce que votre van a bien accès à l'eau pour les chevaux pendant le trajet ?", heure: '14:10' },
      { id: 'm3', moi: false, texte: "Oui, j'ai un abreuvoir automatique dans le van. Pas de souci !", heure: '14:28' },
      { id: 'm4', moi: false, texte: 'Parfait, je confirme la réservation !', heure: '14:32' },
    ],
  },
  {
    id: 'conv2',
    with: 'Club Équestre de Lyon',
    pseudo: 'CELyon_Officiel',
    couleur: '#F97316',
    initiales: 'CL',
    sujet: '🏠 Box Grand Prix de Lyon',
    dernierMsg: 'La paille est fournie, apportez juste votre matériel.',
    heure: 'hier',
    nonLus: 0,
    annonce: 'Box 14-16 avr · Haras de Lyon',
    annonceType: 'box',
    messages: [
      { id: 'm1', moi: true, texte: 'Bonjour, je souhaite réserver 1 box du 14 au 16 avril. Est-ce que la paille est incluse ?', heure: 'hier 10:20' },
      { id: 'm2', moi: false, texte: 'Bonjour ! Oui, la paille est incluse dans le prix. Eau courante disponible 24h/24.', heure: 'hier 11:05' },
      { id: 'm3', moi: false, texte: 'La paille est fournie, apportez juste votre matériel.', heure: 'hier 11:06' },
    ],
  },
  {
    id: 'conv3',
    with: 'Émilie Laurent',
    pseudo: 'EmilieLaurent_Pro',
    couleur: '#7C3AED',
    initiales: 'EL',
    sujet: '🎓 Coaching CSO — Grand Prix Lyon',
    dernierMsg: 'Je suis disponible le matin dès 7h30.',
    heure: 'lun',
    nonLus: 1,
    annonce: 'Coaching CSO · 65€/h HT',
    annonceType: 'coach',
    messages: [
      { id: 'm1', moi: true, texte: 'Bonjour Émilie, je recherche un coach pour le Grand Prix de Lyon le 14 avril. Êtes-vous disponible ?', heure: 'lun 09:00' },
      { id: 'm2', moi: false, texte: 'Bonjour ! Oui, je suis disponible ce jour-là. Quel niveau votre cheval ?', heure: 'lun 09:45' },
      { id: 'm3', moi: true, texte: 'Amateur 2, spécialité CSO. Nous participons en 105cm.', heure: 'lun 10:00' },
      { id: 'm4', moi: false, texte: 'Je suis disponible le matin dès 7h30.', heure: 'lun 10:15' },
    ],
  },
];

const ANNONCE_COLORS: Record<string, string> = {
  transport: '#0369A1',
  box: '#F97316',
  coach: '#7C3AED',
};

export default function MessagerieScreen() {
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [message, setMessage] = useState('');
  const [convs, setConvs] = useState(MOCK_CONVS);

  function sendMessage() {
    if (!message.trim() || !activeConv) return;
    const newMsg = { id: Date.now().toString(), moi: true, texte: message.trim(), heure: 'maintenant' };
    const updated = convs.map((c) =>
      c.id === activeConv.id
        ? { ...c, messages: [...c.messages, newMsg], dernierMsg: message.trim(), heure: 'maintenant' }
        : c,
    );
    setConvs(updated);
    setActiveConv({ ...activeConv, messages: [...activeConv.messages, newMsg], dernierMsg: message.trim() });
    setMessage('');
  }

  if (activeConv) {
    return (
      <SafeAreaView style={s.root}>
        {/* Header conversation */}
        <View style={s.convHeader}>
          <TouchableOpacity style={s.backBtn} onPress={() => setActiveConv(null)}>
            <Text style={s.backIcon}>‹</Text>
          </TouchableOpacity>
          <View style={[s.convAvatar, { backgroundColor: activeConv.couleur }]}>
            <Text style={s.convAvatarText}>{activeConv.initiales}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.convName}>{activeConv.with}</Text>
            <Text style={s.convPseudo}>@{activeConv.pseudo}</Text>
          </View>
        </View>

        {/* Annonce liée */}
        {activeConv.annonce && (
          <View style={[s.annonceTag, { backgroundColor: ANNONCE_COLORS[activeConv.annonceType!] + '18', borderColor: ANNONCE_COLORS[activeConv.annonceType!] + '55' }]}>
            <Text style={[s.annonceTagText, { color: ANNONCE_COLORS[activeConv.annonceType!] }]}>
              Annonce : {activeConv.annonce}
            </Text>
          </View>
        )}

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={s.messages}>
            {activeConv.messages.map((msg) => (
              <View key={msg.id} style={[s.msgRow, msg.moi && s.msgRowMoi]}>
                <View style={[s.bubble, msg.moi ? s.bubbleMoi : s.bubbleEux]}>
                  <Text style={[s.bubbleText, msg.moi && s.bubbleTextMoi]}>{msg.texte}</Text>
                  <Text style={[s.bubbleTime, msg.moi && s.bubbleTimeMoi]}>{msg.heure}</Text>
                </View>
              </View>
            ))}
          </ScrollView>

          {/* Stripe notice */}
          <View style={s.stripeNotice}>
            <Text style={s.stripeIcon}>🔒</Text>
            <Text style={s.stripeText}>Paiement sécurisé via Stripe · Commission 9%</Text>
          </View>

          {/* Input */}
          <View style={s.inputRow}>
            <TextInput
              style={s.input}
              value={message}
              onChangeText={setMessage}
              placeholder="Votre message..."
              placeholderTextColor={Colors.textTertiary}
              multiline
            />
            <TouchableOpacity
              style={[s.sendBtn, !message.trim() && s.sendBtnDisabled]}
              onPress={sendMessage}
              disabled={!message.trim()}
            >
              <Text style={s.sendIcon}>➤</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

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
        {convs.map((c) => (
          <TouchableOpacity
            key={c.id}
            style={s.convCard}
            onPress={() => setActiveConv(c)}
            activeOpacity={0.85}
          >
            <View style={[s.convAvatar, { backgroundColor: c.couleur }]}>
              <Text style={s.convAvatarText}>{c.initiales}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={s.convTopRow}>
                <Text style={s.convCardName}>{c.with}</Text>
                <Text style={s.convTime}>{c.heure}</Text>
              </View>
              <Text style={s.convSujet}>{c.sujet}</Text>
              <Text style={s.convLastMsg} numberOfLines={1}>{c.dernierMsg}</Text>
            </View>
            {c.nonLus > 0 && (
              <View style={s.nonLusBadge}>
                <Text style={s.nonLusText}>{c.nonLus}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
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

  convCard: { backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.lg, flexDirection: 'row', alignItems: 'center', gap: Spacing.md, borderWidth: 1, borderColor: Colors.border, ...Shadow.card },
  convAvatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  convAvatarText: { color: Colors.textInverse, fontSize: FontSize.base, fontWeight: FontWeight.bold },
  convTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  convCardName: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  convTime: { fontSize: FontSize.xs, color: Colors.textTertiary },
  convSujet: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: FontWeight.semibold, marginTop: 2 },
  convLastMsg: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  nonLusBadge: { width: 22, height: 22, borderRadius: 11, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  nonLusText: { color: Colors.textInverse, fontSize: 11, fontWeight: FontWeight.bold },

  // Conversation view
  convHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.surface },
  convName: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  convPseudo: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: FontWeight.semibold },

  annonceTag: { margin: Spacing.md, marginBottom: 0, borderRadius: Radius.md, padding: Spacing.sm, borderWidth: 1 },
  annonceTagText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },

  messages: { padding: Spacing.lg, gap: Spacing.sm, paddingBottom: 20 },
  msgRow: { flexDirection: 'row' },
  msgRowMoi: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '80%', borderRadius: Radius.xl, padding: Spacing.md, gap: 4 },
  bubbleMoi: { backgroundColor: Colors.primary },
  bubbleEux: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  bubbleText: { fontSize: FontSize.base, color: Colors.textPrimary, lineHeight: 20 },
  bubbleTextMoi: { color: Colors.textInverse },
  bubbleTime: { fontSize: 10, color: Colors.textTertiary, alignSelf: 'flex-end' },
  bubbleTimeMoi: { color: 'rgba(255,255,255,0.7)' },

  stripeNotice: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.xs, backgroundColor: Colors.surfaceVariant, borderTopWidth: 1, borderTopColor: Colors.border },
  stripeIcon: { fontSize: 12 },
  stripeText: { fontSize: 11, color: Colors.textTertiary },

  inputRow: { flexDirection: 'row', gap: Spacing.sm, padding: Spacing.lg, paddingTop: Spacing.sm, backgroundColor: Colors.surface, borderTopWidth: 1, borderTopColor: Colors.border },
  input: { flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.xl, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, fontSize: FontSize.base, color: Colors.textPrimary, backgroundColor: Colors.surfaceVariant, maxHeight: 100 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { backgroundColor: Colors.borderMedium },
  sendIcon: { color: Colors.textInverse, fontSize: 16 },
});
