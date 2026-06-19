// ─────────────────────────────────────────────────────────────────────────────
// /concours/[id]/discussion — fil public concours.
// LOT 1 : lecture publique, écriture connectée, soft delete (auteur·org·admin),
//   realtime, marque lu à l'ouverture, identité = pseudo+couleur+initiales.
// LOT 2 P1 : tags métier (#transport/#box/#coach/#stage) → CTA de conversion vers
//   les écrans Services existants ; réponses 1 niveau (parent_id) avec citation ;
//   garde-fou business discret. Notif de réponse = serveur (trigger 083).
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet, SafeAreaView,
  ActivityIndicator, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors } from '../../../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../../../constants/theme';
import { useScreenTracking } from '../../../hooks/useScreenTracking';
import { trackCta } from '../../../lib/analytics';
import { useConcoursDiscussion, ConcoursMessage } from '../../../hooks/useConcoursDiscussion';
import { useConcours } from '../../../hooks/useConcours';

// ── Tags métier LOT 2 (valeurs alignées sur le CHECK topic de la mig 083) ──────
type TagKey = 'transport' | 'box' | 'coach' | 'stage';
const TAG_KEYWORDS: TagKey[] = ['transport', 'box', 'coach', 'stage'];

// Détection AUTOMATIQUE du tag depuis le texte (plus de chips). Le 1er hashtag
// connu gagne. Insensible à la casse, robuste à la ponctuation (\w s'arrête au
// signe). Hashtags inconnus ignorés. Aucun hashtag connu → null (= général).
//   "Je cherche un #Transport." → 'transport' · "#box et #transport" → 'box'
function detectTopic(text: string): TagKey | null {
  const re = /#(\w+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const w = m[1].toLowerCase();
    if ((TAG_KEYWORDS as string[]).includes(w)) return w as TagKey;
  }
  return null;
}

// CTA de conversion : chaque tag pointe vers l'écran Services existant, pré-filtré
// par le NOM du concours (le filtre Services matche le champ texte `concours`).
// #stage → onglet coach + sous-onglet stages (services lit params.subTab).
const CTA: Record<TagKey, { label: string; tab: 'transport' | 'box' | 'coach'; subTab?: 'stages' }> = {
  transport: { label: 'Voir les transports disponibles', tab: 'transport' },
  box: { label: 'Voir les boxes disponibles', tab: 'box' },
  coach: { label: 'Voir les coachs disponibles', tab: 'coach' },
  stage: { label: 'Voir les stages disponibles', tab: 'coach', subTab: 'stages' },
};

const TAG_LABEL: Record<TagKey, string> = {
  transport: '🚐 Transport', box: '📦 Box', coach: '🎓 Coach', stage: '📚 Stage',
};
const isTagKey = (t: string | null): t is TagKey =>
  t === 'transport' || t === 'box' || t === 'coach' || t === 'stage';

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

function excerpt(s: string, n = 90): string {
  const t = (s || '').trim();
  return t.length > n ? `${t.slice(0, n)}…` : t;
}

export default function ConcoursDiscussionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  useScreenTracking('concours-discussion', { concours_id: id });
  const { concours } = useConcours(id);
  const { messages, isLoading, sending, send, softDelete, markRead, canDelete, canPost } = useConcoursDiscussion(id);
  const [draft, setDraft] = useState('');
  const [replyingTo, setReplyingTo] = useState<ConcoursMessage | null>(null);

  // Résolution du message parent pour la citation (réponse 1 niveau).
  const byId = useMemo(() => {
    const m = new Map<string, ConcoursMessage>();
    messages.forEach((x) => m.set(x.id, x));
    return m;
  }, [messages]);

  // Marque le fil lu à l'ouverture (remet le badge non-lu à 0).
  useEffect(() => { markRead(); }, [markRead]);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace(`/concours/${id}` as any);
  };

  // CTA de conversion : ouvre Services pré-filtré sur ce concours pour le module.
  const goServices = (key: TagKey) => {
    const c = CTA[key];
    trackCta('concours-discussion', `concours_disc_cta_${key}`, { concours_id: id });
    router.push({
      pathname: '/(tabs)/services',
      params: { tab: c.tab, ...(c.subTab ? { subTab: c.subTab } : {}), concours: concours?.nom ?? '' },
    } as any);
  };

  const onSend = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    // Tag implicite : détecté automatiquement depuis le texte (plus de chips).
    const detected = detectTopic(text);
    const parentId = replyingTo?.id ?? null;
    setDraft(''); setReplyingTo(null);
    const { error } = await send(text, detected, parentId);
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
              const parent = m.parent_id ? byId.get(m.parent_id) : undefined;
              const tagKey = isTagKey(m.topic) ? m.topic : null;
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

                    {/* Citation du message parent (réponse 1 niveau). */}
                    {!!m.parent_id && (
                      <View style={s.quote}>
                        <Text style={s.quoteAuthor} numberOfLines={1}>
                          ↳ {parent ? (parent.auteur_pseudo || 'Cavalier') : 'Message'}
                        </Text>
                        <Text style={s.quoteTxt} numberOfLines={2}>
                          {!parent ? "Message d'origine indisponible" : parent.is_deleted ? 'Message supprimé' : excerpt(parent.contenu)}
                        </Text>
                      </View>
                    )}

                    {/* Tag métier visible. */}
                    {tagKey && !m.is_deleted && (
                      <View style={s.tagPill}><Text style={s.tagPillTxt}>{TAG_LABEL[tagKey]}</Text></View>
                    )}

                    {m.is_deleted ? (
                      <Text style={s.deleted}>Message supprimé</Text>
                    ) : (
                      <Text style={s.contenu}>{m.contenu}</Text>
                    )}

                    {/* CTA de conversion selon le tag → écran Services pré-filtré. */}
                    {tagKey && !m.is_deleted && (
                      <TouchableOpacity style={s.ctaBtn} activeOpacity={0.85} onPress={() => goServices(tagKey)}>
                        <Text style={s.ctaTxt}>{CTA[tagKey].label}  →</Text>
                      </TouchableOpacity>
                    )}

                    {!m.is_deleted && (
                      <View style={s.msgActions}>
                        {canPost && (
                          <TouchableOpacity onPress={() => setReplyingTo(m)} hitSlop={8}>
                            <Text style={s.replyBtn}>Répondre</Text>
                          </TouchableOpacity>
                        )}
                        {canDelete(m) && (
                          <TouchableOpacity onPress={() => onDelete(m)} hitSlop={8}>
                            <Text style={s.delBtn}>Supprimer</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>

        {canPost ? (
          <View style={s.composerWrap}>
            {/* Garde-fou business discret : inciter à rester sur la plateforme. */}
            <Text style={s.safety}>
              🔒 Réserve via Equishow : paiement sécurisé, suivi dans l'app, visible par l'organisateur.
            </Text>

            {/* Aide hashtags : découvrabilité de la catégorisation (hors mode réponse). */}
            {!replyingTo && (
              <Text style={s.hint}>
                💡 Astuce : utilisez #transport, #box, #coach ou #stage
              </Text>
            )}

            {/* Bandeau « en réponse à … » (annulable). */}
            {replyingTo && (
              <View style={s.replyingBar}>
                <Text style={s.replyingTxt} numberOfLines={1}>
                  ↳ En réponse à {replyingTo.auteur_pseudo || 'Cavalier'} : {excerpt(replyingTo.contenu, 50)}
                </Text>
                <TouchableOpacity onPress={() => setReplyingTo(null)} hitSlop={8}>
                  <Text style={s.replyingClose}>✕</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={s.composer}>
              <TextInput
                style={s.input}
                value={draft}
                onChangeText={setDraft}
                placeholder={replyingTo ? 'Écrire une réponse…' : 'Écrire un message…'}
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
  quote: { borderLeftWidth: 3, borderLeftColor: Colors.primaryBorder, backgroundColor: Colors.surfaceVariant, borderRadius: Radius.xs, paddingHorizontal: Spacing.sm, paddingVertical: 4, marginBottom: 4 },
  quoteAuthor: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: FontWeight.semibold },
  quoteTxt: { fontSize: FontSize.xs, color: Colors.textSecondary, fontStyle: 'italic' },
  tagPill: { alignSelf: 'flex-start', backgroundColor: Colors.goldBg, borderRadius: Radius.xs, paddingHorizontal: 8, paddingVertical: 2, marginBottom: 4 },
  tagPillTxt: { fontSize: FontSize.xs, color: Colors.gold, fontWeight: FontWeight.bold },
  contenu: { fontSize: FontSize.base, color: Colors.textPrimary, lineHeight: 20 },
  deleted: { fontSize: FontSize.sm, color: Colors.textTertiary, fontStyle: 'italic' },
  ctaBtn: { alignSelf: 'flex-start', marginTop: 6, backgroundColor: Colors.primaryLight, borderWidth: 1, borderColor: Colors.primaryBorder, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  ctaTxt: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.bold },
  msgActions: { flexDirection: 'row', gap: Spacing.lg, marginTop: 4 },
  replyBtn: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: FontWeight.semibold },
  delBtn: { fontSize: FontSize.xs, color: Colors.danger, fontWeight: FontWeight.semibold },
  composerWrap: { borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.surface },
  safety: { fontSize: FontSize.xs, color: Colors.textTertiary, paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, lineHeight: 16 },
  hint: { fontSize: FontSize.xs, color: Colors.textTertiary, paddingHorizontal: Spacing.md, paddingTop: 2, lineHeight: 16 },
  replyingBar: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.surfaceVariant, borderRadius: Radius.sm, marginHorizontal: Spacing.md, marginTop: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  replyingTxt: { flex: 1, fontSize: FontSize.xs, color: Colors.textSecondary },
  replyingClose: { fontSize: FontSize.base, color: Colors.textTertiary, fontWeight: FontWeight.bold },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm, padding: Spacing.md, backgroundColor: Colors.surface },
  input: { flex: 1, maxHeight: 120, minHeight: 40, backgroundColor: Colors.background, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, fontSize: FontSize.base, color: Colors.textPrimary },
  sendBtn: { backgroundColor: Colors.primary, borderRadius: Radius.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, alignItems: 'center', justifyContent: 'center' },
  sendBtnOff: { opacity: 0.4 },
  sendTxt: { color: Colors.textInverse, fontWeight: FontWeight.bold, fontSize: FontSize.base },
  loginHint: { flex: 1, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', paddingVertical: Spacing.sm },
});
