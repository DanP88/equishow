// ─────────────────────────────────────────────────────────────────────────────
// /concours/[id]/discussion — fil public LOT 1 (Option C).
// Lecture publique, écriture par tout utilisateur connecté. Soft delete (auteur,
// org propriétaire, admin via RLS 082). Realtime. Marque lu à l'ouverture.
// Identité = pseudo + couleur + initiales uniquement (pas de nom/club/niveau).
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet, SafeAreaView,
  ActivityIndicator, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors } from '../../../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../../../constants/theme';
import { useScreenTracking } from '../../../hooks/useScreenTracking';
import { useConcoursDiscussion, ConcoursMessage } from '../../../hooks/useConcoursDiscussion';

function timeLabel(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const hm = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  return sameDay ? hm : `${d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })} ${hm}`;
}

function roleBadge(role: string | null): string | null {
  if (role === 'organisateur') return 'Organisateur';
  if (role === 'admin') return 'Equishow';
  return null;
}

export default function ConcoursDiscussionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  useScreenTracking('concours-discussion', { concours_id: id });
  const { messages, isLoading, sending, send, softDelete, markRead, canDelete, canPost } = useConcoursDiscussion(id);
  const [draft, setDraft] = useState('');

  // Marque le fil lu à l'ouverture (remet le badge non-lu à 0).
  useEffect(() => { markRead(); }, [markRead]);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace(`/concours/${id}` as any);
  };

  const onSend = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setDraft('');
    const { error } = await send(text);
    if (error) {
      setDraft(text); // restaure en cas d'échec
      if (Platform.OS === 'web') window.alert("Échec de l'envoi. Réessaie.");
      else Alert.alert('Échec', "Le message n'a pas pu être envoyé.");
    }
  };

  const onDelete = (m: ConcoursMessage) => {
    const run = async () => { await softDelete(m.id); };
    if (Platform.OS === 'web') { if (window.confirm('Supprimer ce message ?')) run(); }
    else Alert.alert('Supprimer', 'Supprimer ce message ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: run },
    ]);
  };

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <TouchableOpacity onPress={goBack} style={s.back}><Text style={s.backTxt}>←</Text></TouchableOpacity>
        <Text style={s.title} numberOfLines={1}>💬 Discussion</Text>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.list}>
          {isLoading && messages.length === 0 ? (
            <View style={s.loader}><ActivityIndicator color={Colors.primary} /></View>
          ) : messages.length === 0 ? (
            <View style={s.empty}>
              <Text style={s.emptyTitle}>🐎 Pas encore de message</Text>
              <Text style={s.emptyTxt}>Pose une question, propose un transport ou trouve des cavaliers pour ce concours.</Text>
            </View>
          ) : (
            messages.map((m) => {
              const badge = roleBadge(m.auteur_role);
              return (
                <View key={m.id} style={s.msgRow}>
                  <View style={[s.avatar, { backgroundColor: m.auteur_couleur || Colors.primary }]}>
                    <Text style={s.avatarTxt}>{(m.auteur_initiales || m.auteur_pseudo || '?').slice(0, 2).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={s.msgHead}>
                      <Text style={s.author} numberOfLines={1}>{m.auteur_pseudo || 'Cavalier'}</Text>
                      {!!badge && <View style={s.roleBadge}><Text style={s.roleBadgeTxt}>{badge}</Text></View>}
                      <Text style={s.time}>{timeLabel(m.created_at)}</Text>
                    </View>
                    {m.is_deleted ? (
                      <Text style={s.deleted}>Message supprimé</Text>
                    ) : (
                      <Text style={s.contenu}>{m.contenu}</Text>
                    )}
                    {canDelete(m) && (
                      <TouchableOpacity onPress={() => onDelete(m)} hitSlop={8}>
                        <Text style={s.delBtn}>Supprimer</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>

        {canPost ? (
          <View style={s.composer}>
            <TextInput
              style={s.input}
              value={draft}
              onChangeText={setDraft}
              placeholder="Écrire un message…"
              placeholderTextColor={Colors.textTertiary}
              multiline
              maxLength={2000}
            />
            <TouchableOpacity
              style={[s.sendBtn, (!draft.trim() || sending) && s.sendBtnOff]}
              activeOpacity={0.85}
              disabled={!draft.trim() || sending}
              onPress={onSend}
            >
              <Text style={s.sendTxt}>{sending ? '…' : 'Envoyer'}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={s.composer}>
            <Text style={s.loginHint}>Connecte-toi pour participer à la discussion.</Text>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  back: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surfaceVariant },
  backTxt: { fontSize: 20, color: Colors.textPrimary },
  title: { flex: 1, fontSize: FontSize.lg, fontWeight: FontWeight.extrabold, color: Colors.textPrimary },
  list: { padding: Spacing.lg, paddingBottom: Spacing.lg, gap: Spacing.md },
  loader: { paddingVertical: Spacing.xl, alignItems: 'center' },
  empty: { alignItems: 'center', paddingVertical: Spacing.xl, paddingHorizontal: Spacing.lg },
  emptyTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: 6 },
  emptyTxt: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 19 },
  msgRow: { flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start' },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { color: Colors.textInverse, fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  msgHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: 2 },
  author: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textPrimary, flexShrink: 1 },
  roleBadge: { backgroundColor: Colors.primaryLight, borderRadius: Radius.xs, paddingHorizontal: 6, paddingVertical: 1 },
  roleBadgeTxt: { fontSize: 10, color: Colors.primary, fontWeight: FontWeight.bold },
  time: { fontSize: FontSize.xs, color: Colors.textTertiary, marginLeft: 'auto' },
  contenu: { fontSize: FontSize.base, color: Colors.textPrimary, lineHeight: 20 },
  deleted: { fontSize: FontSize.sm, color: Colors.textTertiary, fontStyle: 'italic' },
  delBtn: { fontSize: FontSize.xs, color: Colors.danger, fontWeight: FontWeight.semibold, marginTop: 4 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm, padding: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.surface },
  input: { flex: 1, maxHeight: 120, minHeight: 40, backgroundColor: Colors.background, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, fontSize: FontSize.base, color: Colors.textPrimary },
  sendBtn: { backgroundColor: Colors.primary, borderRadius: Radius.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, alignItems: 'center', justifyContent: 'center' },
  sendBtnOff: { opacity: 0.4 },
  sendTxt: { color: Colors.textInverse, fontWeight: FontWeight.bold, fontSize: FontSize.base },
  loginHint: { flex: 1, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', paddingVertical: Spacing.sm },
});
