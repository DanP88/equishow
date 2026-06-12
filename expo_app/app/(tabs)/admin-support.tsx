import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, RefreshControl, Modal, TextInput,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, FontWeight } from '../../constants/theme';
import { AuthGuard } from '../../components/AuthGuard';
import { AlertModal } from '../../components/AlertModal';
import { useScreenTracking } from '../../hooks/useScreenTracking';
import {
  useAdminSupportRequests, SupportRequest, SupportStatus,
} from '../../hooks/useSupportRequests';

type Filter = SupportStatus | 'all';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'open', label: 'Ouverts' },
  { value: 'in_progress', label: 'En cours' },
  { value: 'resolved', label: 'Résolus' },
  { value: 'closed', label: 'Clos' },
  { value: 'all', label: 'Tous' },
];

const STATUS_META: Record<SupportStatus, { label: string; bg: string; fg: string }> = {
  open: { label: 'Ouvert', bg: '#FEF3C7', fg: '#92400E' },
  in_progress: { label: 'En cours', bg: '#DBEAFE', fg: '#1E40AF' },
  resolved: { label: 'Résolu', bg: '#D1FAE5', fg: '#065F46' },
  closed: { label: 'Clos', bg: '#E5E7EB', fg: '#374151' },
};

// Libellé « nature du problème » (colonne category). Inclut un fallback pour les
// valeurs legacy (anciens tickets dont category = type d'objet).
const NATURE_LABEL: Record<string, string> = {
  paiement: 'Paiement', remboursement: 'Remboursement', prestation: 'Litige prestation',
  compte: 'Compte', autre: 'Autre',
  transport: 'Transport', box: 'Box', coaching: 'Coaching', stage: 'Stage',
};

// Filtres « nature » (client-side, n'impacte pas la requête du hook).
const NATURE_FILTERS: { value: string; label: string }[] = [
  { value: 'all', label: 'Toutes' },
  { value: 'paiement', label: 'Paiement' },
  { value: 'remboursement', label: 'Remboursement' },
  { value: 'prestation', label: 'Litige' },
  { value: 'compte', label: 'Compte' },
  { value: 'autre', label: 'Autre' },
];

function requesterName(t: SupportRequest): string {
  const r = t.requester;
  if (!r) return 'Utilisateur';
  const full = [r.prenom, r.nom].filter(Boolean).join(' ').trim();
  return full || r.pseudo || 'Utilisateur';
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
}

export default function AdminSupportScreen() {
  return (
    <AuthGuard requiredRole="admin">
      <AdminSupportContent />
    </AuthGuard>
  );
}

function AdminSupportContent() {
  useScreenTracking('admin-support');

  // Deep-link notification → ticket : si un id est ciblé, on démarre sur « Tous »
  // pour le retrouver quel que soit son statut.
  const { ticket } = useLocalSearchParams<{ ticket?: string }>();
  const targetTicket = typeof ticket === 'string' ? ticket : '';

  const [filter, setFilter] = useState<Filter>(targetTicket ? 'all' : 'open');
  const [natureFilter, setNatureFilter] = useState<string>('all');
  const { items, loading, error, refresh, markInProgress, resolve } = useAdminSupportRequests(filter);

  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [resolveTarget, setResolveTarget] = useState<SupportRequest | null>(null);
  const [resolveMsg, setResolveMsg] = useState('');
  const [alert, setAlert] = useState<{ title: string; message: string; variant: 'success' | 'error' } | null>(null);

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const sorted = useMemo(
    () => (natureFilter === 'all' ? items : items.filter((t) => t.category === natureFilter)),
    [items, natureFilter],
  );

  // Ouvre la fiche du ticket ciblé par le deep-link, une fois la liste chargée.
  // Robustesse : id absent/introuvable → aucune erreur, écran normal.
  const deepLinkHandled = useRef(false);
  useEffect(() => {
    if (!targetTicket || deepLinkHandled.current || loading) return;
    if (items.some((t) => t.id === targetTicket)) setExpandedId(targetTicket);
    deepLinkHandled.current = true;
  }, [targetTicket, loading, items]);

  async function doMarkInProgress(t: SupportRequest) {
    if (actionLoading) return;
    setActionLoading(true);
    const { error } = await markInProgress(t.id);
    setActionLoading(false);
    if (error) setAlert({ title: 'Erreur', message: error, variant: 'error' });
  }

  function openResolve(t: SupportRequest) {
    setResolveTarget(t);
    setResolveMsg(t.resolutionMessage ?? '');
  }

  async function doResolve() {
    if (!resolveTarget || actionLoading) return;
    if (!resolveMsg.trim()) {
      setAlert({ title: 'Message requis', message: 'Saisissez une réponse avant de résoudre.', variant: 'error' });
      return;
    }
    setActionLoading(true);
    const { error } = await resolve(resolveTarget.id, resolveMsg);
    setActionLoading(false);
    setResolveTarget(null);
    setResolveMsg('');
    if (error) setAlert({ title: 'Erreur', message: error, variant: 'error' });
    else setAlert({ title: 'Réclamation résolue', message: "L'utilisateur a été notifié dans l'application.", variant: 'success' });
  }

  return (
    <View style={s.root}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.canGoBack() ? router.back() : router.replace('/')}>
          <Text style={s.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Réclamations</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Filtres statut */}
      <View style={s.filterRow}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.value}
            style={[s.filterChip, filter === f.value && s.filterChipActive]}
            onPress={() => setFilter(f.value)}
            activeOpacity={0.8}
          >
            <Text style={[s.filterText, filter === f.value && s.filterTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Filtres nature du problème (client-side) */}
      <View style={[s.filterRow, { paddingTop: 0 }]}>
        {NATURE_FILTERS.map((f) => (
          <TouchableOpacity
            key={f.value}
            style={[s.natureChip, natureFilter === f.value && s.natureChipActive]}
            onPress={() => setNatureFilter(f.value)}
            activeOpacity={0.8}
          >
            <Text style={[s.natureText, natureFilter === f.value && s.natureTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {loading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
        ) : error ? (
          <View style={s.emptyBox}><Text style={s.emptyText}>Erreur : {error}</Text></View>
        ) : sorted.length === 0 ? (
          <View style={s.emptyBox}><Text style={s.emptyText}>Aucune réclamation dans cette catégorie.</Text></View>
        ) : (
          sorted.map((t) => {
            const meta = STATUS_META[t.status];
            const open = expandedId === t.id;
            return (
              <TouchableOpacity
                key={t.id}
                style={s.card}
                activeOpacity={0.9}
                onPress={() => setExpandedId(open ? null : t.id)}
              >
                <View style={s.cardTop}>
                  <Text style={s.ref}>{t.ref}</Text>
                  <View style={[s.statusBadge, { backgroundColor: meta.bg }]}>
                    <Text style={[s.statusText, { color: meta.fg }]}>{meta.label}</Text>
                  </View>
                </View>

                <Text style={s.subject}>{t.subject}</Text>
                <View style={s.tagRow}>
                  <View style={s.natureTag}>
                    <Text style={s.natureTagText}>{NATURE_LABEL[t.category] ?? t.category}</Text>
                  </View>
                  {!!t.reservationType && (
                    <View style={s.objetTag}>
                      <Text style={s.objetTagText}>{NATURE_LABEL[t.reservationType] ?? t.reservationType}</Text>
                    </View>
                  )}
                </View>
                <Text style={s.meta}>
                  {requesterName(t)}
                  {t.reservationRef ? ` · ${t.reservationRef}` : ''} · {fmtDate(t.createdAt)}
                </Text>

                {open && (
                  <View style={s.detail}>
                    <Text style={s.detailLabel}>Nature du problème</Text>
                    <Text style={s.detailText}>
                      {NATURE_LABEL[t.category] ?? t.category}
                      {t.reservationType ? ` · objet : ${NATURE_LABEL[t.reservationType] ?? t.reservationType}` : ''}
                    </Text>

                    <Text style={[s.detailLabel, { marginTop: Spacing.md }]}>Description</Text>
                    <Text style={s.detailText}>{t.description}</Text>

                    {!!t.resolutionMessage && (
                      <>
                        <Text style={[s.detailLabel, { marginTop: Spacing.md }]}>Réponse</Text>
                        <Text style={s.detailText}>{t.resolutionMessage}</Text>
                      </>
                    )}

                    {(t.status === 'open' || t.status === 'in_progress') && (
                      <View style={s.actions}>
                        {t.status === 'open' && (
                          <TouchableOpacity
                            style={[s.actionBtn, s.actionSecondary]}
                            onPress={() => doMarkInProgress(t)}
                            disabled={actionLoading}
                            activeOpacity={0.85}
                          >
                            <Text style={s.actionSecondaryText}>Prendre en charge</Text>
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity
                          style={[s.actionBtn, s.actionPrimary]}
                          onPress={() => openResolve(t)}
                          disabled={actionLoading}
                          activeOpacity={0.85}
                        >
                          <Text style={s.actionPrimaryText}>Résoudre</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                )}
              </TouchableOpacity>
            );
          })
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Modale résolution */}
      <Modal visible={!!resolveTarget} transparent animationType="fade" onRequestClose={() => setResolveTarget(null)}>
        <View style={s.modalBackdrop}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Résoudre {resolveTarget?.ref}</Text>
            <Text style={s.modalSub}>Votre réponse sera envoyée à l'utilisateur (notification in-app).</Text>
            <TextInput
              style={s.modalInput}
              value={resolveMsg}
              onChangeText={setResolveMsg}
              placeholder="Décrivez la résolution apportée…"
              placeholderTextColor={Colors.textTertiary}
              multiline
              numberOfLines={5}
            />
            <View style={s.modalActions}>
              <TouchableOpacity
                style={[s.actionBtn, s.actionSecondary, { flex: 1 }]}
                onPress={() => { setResolveTarget(null); setResolveMsg(''); }}
                disabled={actionLoading}
                activeOpacity={0.85}
              >
                <Text style={s.actionSecondaryText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.actionBtn, s.actionPrimary, { flex: 1 }]}
                onPress={doResolve}
                disabled={actionLoading || !resolveMsg.trim()}
                activeOpacity={0.85}
              >
                {actionLoading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={s.actionPrimaryText}>Marquer résolu</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <AlertModal
        visible={!!alert}
        title={alert?.title ?? ''}
        message={alert?.message ?? ''}
        variant={alert?.variant ?? 'info'}
        onClose={() => setAlert(null)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.surface,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 32, color: Colors.textPrimary, lineHeight: 32 },
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  filterRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, backgroundColor: Colors.surface,
  },
  filterChip: {
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs + 2,
    borderRadius: 999, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.background,
  },
  filterChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.semibold },
  filterTextActive: { color: Colors.textInverse },
  natureChip: {
    paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs,
    borderRadius: 999, borderWidth: 1, borderColor: Colors.borderMedium, backgroundColor: Colors.background,
  },
  natureChipActive: { backgroundColor: Colors.textPrimary, borderColor: Colors.textPrimary },
  natureText: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.semibold },
  natureTextActive: { color: Colors.textInverse },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginTop: Spacing.xs },
  natureTag: { backgroundColor: Colors.primaryLight, borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  natureTagText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.primary },
  objetTag: { backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  objetTagText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.textSecondary },
  content: { padding: Spacing.lg, gap: Spacing.md },
  emptyBox: { padding: Spacing.xl, alignItems: 'center' },
  emptyText: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center' },
  card: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg,
    borderWidth: 1, borderColor: Colors.border, gap: Spacing.xs,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ref: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.primary },
  statusBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: 999 },
  statusText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  subject: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary, marginTop: 2 },
  meta: { fontSize: FontSize.xs, color: Colors.textTertiary },
  detail: { marginTop: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.md },
  detailLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textSecondary, textTransform: 'uppercase' },
  detailText: { fontSize: FontSize.sm, color: Colors.textPrimary, marginTop: 4, lineHeight: 20 },
  actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.lg },
  actionBtn: { borderRadius: Radius.md, paddingVertical: Spacing.sm + 2, paddingHorizontal: Spacing.lg, alignItems: 'center', justifyContent: 'center' },
  actionPrimary: { backgroundColor: Colors.primary },
  actionPrimaryText: { color: Colors.textInverse, fontWeight: FontWeight.bold, fontSize: FontSize.sm },
  actionSecondary: { backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border },
  actionSecondaryText: { color: Colors.textPrimary, fontWeight: FontWeight.semibold, fontSize: FontSize.sm },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: Spacing.lg },
  modalCard: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg, gap: Spacing.sm },
  modalTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  modalSub: { fontSize: FontSize.sm, color: Colors.textSecondary },
  modalInput: {
    borderWidth: 1, borderColor: Colors.borderMedium, borderRadius: Radius.md, padding: Spacing.md,
    fontSize: FontSize.base, color: Colors.textPrimary, minHeight: 110, textAlignVertical: 'top', marginTop: Spacing.xs,
  },
  modalActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
});
