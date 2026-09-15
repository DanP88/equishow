// ─────────────────────────────────────────────────────────────────────────────
// AdminSupportV2 — reskin Blush de app/(tabs)/admin-support.tsx (réclamations
// EQ-REC). Actions RÉELLES (markInProgress/resolve) via useAdminSupportRequests.
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Modal, TextInput } from 'react-native';
import { BL, FONT } from '../../ui/blush';
import { Segment } from '../../ui/kit';
import { Spacing, FontSize, FontWeight } from '../../../constants/theme';
import { useAdminSupportRequests, SupportRequest, SupportStatus } from '../../../hooks/useSupportRequests';
import { AlertModal } from '../../../components/AlertModal';

type Filter = SupportStatus | 'all';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'open', label: 'Ouverts' }, { key: 'in_progress', label: 'En cours' },
  { key: 'resolved', label: 'Résolus' }, { key: 'closed', label: 'Clos' }, { key: 'all', label: 'Tous' },
];
const STATUS_META: Record<SupportStatus, { label: string; bg: string; fg: string }> = {
  open: { label: 'Ouvert', bg: '#FBF1DB', fg: '#A6822E' },
  in_progress: { label: 'En cours', bg: '#EAF0FB', fg: '#3B5FA3' },
  resolved: { label: 'Résolu', bg: '#EAF3EC', fg: BL.sage },
  closed: { label: 'Clos', bg: BL.neutralSoft, fg: BL.sub },
};
const NATURE_LABEL: Record<string, string> = {
  paiement: 'Paiement', remboursement: 'Remboursement', prestation: 'Litige prestation',
  compte: 'Compte', autre: 'Autre', transport: 'Transport', box: 'Box', coaching: 'Coaching', stage: 'Stage',
};

function requesterName(t: SupportRequest): string {
  const r = t.requester;
  if (!r) return 'Utilisateur';
  const full = [r.prenom, r.nom].filter(Boolean).join(' ').trim();
  return full || r.pseudo || 'Utilisateur';
}
function fmtDate(iso: string): string {
  try { return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); }
  catch { return iso; }
}

export function AdminSupportV2() {
  const [filter, setFilter] = useState<Filter>('open');
  const { items, loading, error, refresh, markInProgress, resolve } = useAdminSupportRequests(filter);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [resolveTarget, setResolveTarget] = useState<SupportRequest | null>(null);
  const [resolveMsg, setResolveMsg] = useState('');
  const [alert, setAlert] = useState<{ title: string; message: string; variant: 'success' | 'error' } | null>(null);

  const sorted = useMemo(() => items, [items]);

  async function onRefresh() { setRefreshing(true); await refresh(); setRefreshing(false); }
  async function doMarkInProgress(t: SupportRequest) {
    if (actionLoading) return;
    setActionLoading(true);
    const { error: e } = await markInProgress(t.id);
    setActionLoading(false);
    if (e) setAlert({ title: 'Erreur', message: e, variant: 'error' });
  }
  function openResolve(t: SupportRequest) { setResolveTarget(t); setResolveMsg(t.resolutionMessage ?? ''); }
  async function doResolve() {
    if (!resolveTarget || actionLoading) return;
    if (!resolveMsg.trim()) { setAlert({ title: 'Message requis', message: 'Saisissez une réponse avant de résoudre.', variant: 'error' }); return; }
    setActionLoading(true);
    const { error: e } = await resolve(resolveTarget.id, resolveMsg);
    setActionLoading(false);
    setResolveTarget(null);
    setResolveMsg('');
    if (e) setAlert({ title: 'Erreur', message: e, variant: 'error' });
    else setAlert({ title: 'Réclamation résolue', message: "L'utilisateur a été notifié dans l'application.", variant: 'success' });
  }

  return (
    <View style={s.screen}>
      <View style={s.headPad}>
        <Text style={s.h1}>Réclamations</Text>
        <Segment options={FILTERS.map((f) => ({ key: f.key, label: f.label }))} value={filter} onChange={(v) => setFilter(v as Filter)} />
      </View>

      <ScrollView contentContainerStyle={s.pad} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BL.accent} />}>
        {loading ? (
          <ActivityIndicator color={BL.accent} style={{ marginTop: 40 }} />
        ) : error ? (
          <Text style={s.empty}>Erreur : {error}</Text>
        ) : sorted.length === 0 ? (
          <Text style={s.empty}>Aucune réclamation dans cette catégorie.</Text>
        ) : sorted.map((t) => {
          const meta = STATUS_META[t.status];
          const open = expandedId === t.id;
          return (
            <TouchableOpacity key={t.id} style={s.card} activeOpacity={0.9} onPress={() => setExpandedId(open ? null : t.id)}>
              <View style={s.cardTop}>
                <Text style={s.ref}>{t.ref}</Text>
                <View style={[s.statusBadge, { backgroundColor: meta.bg }]}><Text style={[s.statusTxt, { color: meta.fg }]}>{meta.label}</Text></View>
              </View>
              <Text style={s.subject}>{t.subject}</Text>
              <View style={s.tagRow}>
                <View style={s.natureTag}><Text style={s.natureTagTxt}>{NATURE_LABEL[t.category] ?? t.category}</Text></View>
                {!!t.reservationType && <View style={s.objTag}><Text style={s.objTagTxt}>{NATURE_LABEL[t.reservationType] ?? t.reservationType}</Text></View>}
              </View>
              <Text style={s.meta}>{requesterName(t)}{t.reservationRef ? ` · ${t.reservationRef}` : ''} · {fmtDate(t.createdAt)}</Text>

              {open && (
                <View style={s.detail}>
                  <Text style={s.detailLabel}>Description</Text>
                  <Text style={s.detailText}>{t.description}</Text>
                  {!!t.resolutionMessage && (<><Text style={[s.detailLabel, { marginTop: Spacing.md }]}>Réponse</Text><Text style={s.detailText}>{t.resolutionMessage}</Text></>)}
                  {(t.status === 'open' || t.status === 'in_progress') && (
                    <View style={s.actions}>
                      {t.status === 'open' && (
                        <TouchableOpacity style={[s.actionBtn, s.actionSecondary]} onPress={() => doMarkInProgress(t)} disabled={actionLoading}>
                          <Text style={s.actionSecondaryTxt}>Prendre en charge</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity style={[s.actionBtn, s.actionPrimary]} onPress={() => openResolve(t)} disabled={actionLoading}>
                        <Text style={s.actionPrimaryTxt}>Résoudre</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}
            </TouchableOpacity>
          );
        })}
        <View style={{ height: 40 }} />
      </ScrollView>

      <Modal visible={!!resolveTarget} transparent animationType="fade" onRequestClose={() => setResolveTarget(null)}>
        <View style={s.modalBackdrop}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Résoudre {resolveTarget?.ref}</Text>
            <Text style={s.modalSub}>Votre réponse sera envoyée à l'utilisateur (notification in-app).</Text>
            <TextInput style={s.modalInput} value={resolveMsg} onChangeText={setResolveMsg} placeholder="Décrivez la résolution apportée…" placeholderTextColor={BL.faint} multiline numberOfLines={5} />
            <View style={s.modalActions}>
              <TouchableOpacity style={[s.actionBtn, s.actionSecondary, { flex: 1 }]} onPress={() => { setResolveTarget(null); setResolveMsg(''); }} disabled={actionLoading}>
                <Text style={s.actionSecondaryTxt}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.actionBtn, s.actionPrimary, { flex: 1 }]} onPress={doResolve} disabled={actionLoading || !resolveMsg.trim()}>
                {actionLoading ? <ActivityIndicator color="#fff" /> : <Text style={s.actionPrimaryTxt}>Marquer résolu</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <AlertModal visible={!!alert} title={alert?.title ?? ''} message={alert?.message ?? ''} variant={alert?.variant ?? 'info'} onClose={() => setAlert(null)} />
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BL.bg },
  headPad: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, gap: Spacing.sm, backgroundColor: BL.card, borderBottomWidth: 1, borderBottomColor: BL.line, paddingBottom: Spacing.md },
  h1: { fontFamily: FONT.head, fontSize: 22, fontWeight: '700', color: BL.ink },
  pad: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 60 },
  empty: { fontSize: FontSize.sm, color: BL.sub, textAlign: 'center', padding: Spacing.xl },
  card: { backgroundColor: BL.card, borderRadius: 16, borderWidth: 1, borderColor: BL.line, padding: Spacing.lg, gap: 4 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ref: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: BL.accent },
  statusBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: 999 },
  statusTxt: { fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  subject: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: BL.ink, marginTop: 2 },
  meta: { fontSize: FontSize.xs, color: BL.faint },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginTop: Spacing.xs },
  natureTag: { backgroundColor: BL.accentSoft, borderRadius: 8, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  natureTagTxt: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: BL.accent },
  objTag: { backgroundColor: BL.bg, borderWidth: 1, borderColor: BL.line, borderRadius: 8, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  objTagTxt: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: BL.sub },
  detail: { marginTop: Spacing.md, borderTopWidth: 1, borderTopColor: BL.line, paddingTop: Spacing.md },
  detailLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: BL.sub, textTransform: 'uppercase' },
  detailText: { fontSize: FontSize.sm, color: BL.ink, marginTop: 4, lineHeight: 20 },
  actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.lg },
  actionBtn: { borderRadius: 999, paddingVertical: Spacing.sm + 2, paddingHorizontal: Spacing.lg, alignItems: 'center', justifyContent: 'center' },
  actionPrimary: { backgroundColor: BL.accent },
  actionPrimaryTxt: { color: '#fff', fontWeight: FontWeight.bold, fontSize: FontSize.sm },
  actionSecondary: { backgroundColor: BL.card, borderWidth: 1, borderColor: BL.line },
  actionSecondaryTxt: { color: BL.ink, fontWeight: FontWeight.semibold, fontSize: FontSize.sm },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(58,37,48,0.45)', justifyContent: 'center', padding: Spacing.lg },
  modalCard: { backgroundColor: BL.card, borderRadius: 16, padding: Spacing.lg, gap: Spacing.sm },
  modalTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: BL.ink },
  modalSub: { fontSize: FontSize.sm, color: BL.sub },
  modalInput: { borderWidth: 1, borderColor: BL.line, borderRadius: 10, padding: Spacing.md, fontSize: FontSize.base, color: BL.ink, minHeight: 110, textAlignVertical: 'top', marginTop: Spacing.xs },
  modalActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
});
