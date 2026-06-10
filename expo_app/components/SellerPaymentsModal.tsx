// ─────────────────────────────────────────────────────────────────────────────
// <SellerPaymentsModal /> — Récap des paiements reçus par le vendeur
//
// Ouverte depuis "Voir mes paiements" (StripeAccountModal → SellerStripeMenuItem).
// Lecture seule : s'appuie sur useMySellerPayments (table payments, RLS seller).
// Aucune logique Stripe / écriture.
//
// Navigation INTERNE (la modale ne se ferme jamais entre les vues) :
//   - 'summary'  : 2 cartes cliquables (Déjà gagné / En séquestre) + "Voir l'ensemble"
//   - 'released' : détail des paiements déjà versés
//   - 'escrow'   : détail des paiements en séquestre
//   - 'all'      : tous les paiements
// Une vue détail a un bouton "‹ Retour" qui ramène au récap.
//
// Style calqué sur StripeAccountModal / LevelInfoModal.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useState } from 'react';
import {
  View, Text, Modal, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Platform,
} from 'react-native';
import { Colors } from '../constants/colors';
import { Spacing, Radius, FontSize, FontWeight } from '../constants/theme';
import { formatMoney } from '../types/stripe';
import {
  SellerPayment, SellerPaymentsSummary, SellerPaymentType, isReleased, isInEscrow,
} from '../hooks/useMySellerPayments';

interface Props {
  visible: boolean;
  loading: boolean;
  error: boolean;
  payments: SellerPayment[];
  summary: SellerPaymentsSummary;
  onClose: () => void;
}

type PaymentsView = 'summary' | 'released' | 'escrow' | 'all';

const TYPE_LABEL: Record<SellerPaymentType, string> = {
  course: 'Cours / Coaching',
  stage: 'Stage',
  transport: 'Transport',
  box: 'Box / Hébergement',
};

const VIEW_TITLE: Record<Exclude<PaymentsView, 'summary'>, string> = {
  released: 'Déjà gagné',
  escrow: 'En séquestre',
  all: 'Tous les paiements',
};

interface Badge { label: string; bg: string; fg: string; }

function badgeFor(p: SellerPayment): Badge {
  if (p.paymentStatus === 'refunded') return { label: 'Remboursé', bg: '#F3F4F6', fg: '#6B7280' };
  if (p.disputeStatus === 'open')     return { label: 'Litige', bg: '#FEF3C7', fg: '#92400E' };
  if (p.transferState === 'released' || p.transferState === 'not_applicable')
    return { label: 'Versé', bg: '#DCFCE7', fg: '#166534' };
  if (p.transferState === 'reversed' || p.transferState === 'failed')
    return { label: 'Échec versement', bg: '#FEE2E2', fg: '#991B1B' };
  return { label: 'En séquestre', bg: '#DBEAFE', fg: '#1E40AF' };
}

function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function SellerPaymentsModal({ visible, loading, error, payments, summary, onClose }: Props) {
  const [view, setView] = useState<PaymentsView>('summary');

  // À chaque ouverture, on revient sur le récap.
  useEffect(() => { if (visible) setView('summary'); }, [visible]);

  const releasedList = payments.filter(isReleased);
  const escrowList = payments.filter(isInEscrow);

  const listForView =
    view === 'released' ? releasedList :
    view === 'escrow' ? escrowList :
    payments;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
          <View style={s.card}>
            {/* En-tête : titre + retour si on est dans une vue détail */}
            {view === 'summary' ? (
              <Text style={s.title}>Mes paiements</Text>
            ) : (
              <View style={s.detailHeader}>
                <TouchableOpacity onPress={() => setView('summary')} activeOpacity={0.7} hitSlop={8}>
                  <Text style={s.backBtn}>‹ Retour</Text>
                </TouchableOpacity>
                <Text style={s.detailTitle}>{VIEW_TITLE[view]}</Text>
                <View style={{ width: 64 }} />
              </View>
            )}

            {/* ── Vue récap ── */}
            {view === 'summary' && (
              <>
                <View style={s.totals}>
                  <TouchableOpacity
                    style={[s.totalBox, { backgroundColor: '#DCFCE7' }]}
                    activeOpacity={0.8}
                    onPress={() => setView('released')}
                  >
                    <Text style={[s.totalAmount, { color: '#166534' }]}>{formatMoney(summary.totalReleased)}</Text>
                    <Text style={s.totalLabel}>Déjà gagné</Text>
                    <Text style={s.totalHint}>{releasedList.length} paiement{releasedList.length > 1 ? 's' : ''} ›</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.totalBox, { backgroundColor: '#DBEAFE' }]}
                    activeOpacity={0.8}
                    onPress={() => setView('escrow')}
                  >
                    <Text style={[s.totalAmount, { color: '#1E40AF' }]}>{formatMoney(summary.totalPending)}</Text>
                    <Text style={s.totalLabel}>En séquestre</Text>
                    <Text style={s.totalHint}>{escrowList.length} paiement{escrowList.length > 1 ? 's' : ''} ›</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity style={s.allBtn} activeOpacity={0.85} onPress={() => setView('all')}>
                  <Text style={s.allBtnText}>Voir l'ensemble des paiements</Text>
                </TouchableOpacity>

                <Text style={s.note}>
                  Les fonds en séquestre sont versés sur votre compte Stripe après validation
                  du service réalisé.
                </Text>
              </>
            )}

            {/* ── Vues détail (liste filtrée) ── */}
            {view !== 'summary' && (
              loading ? (
                <View style={s.center}><ActivityIndicator color={Colors.primary} /></View>
              ) : error ? (
                <Text style={s.empty}>Impossible de charger vos paiements.</Text>
              ) : listForView.length === 0 ? (
                <Text style={s.empty}>Aucun paiement dans cette catégorie.</Text>
              ) : (
                <ScrollView style={s.list} showsVerticalScrollIndicator={false}>
                  {listForView.map((p) => {
                    const badge = badgeFor(p);
                    return (
                      <View key={p.id} style={s.row}>
                        <View style={{ flex: 1 }}>
                          <Text style={s.rowType}>{TYPE_LABEL[p.type] ?? p.type}</Text>
                          <Text style={s.rowDate}>{formatDate(p.paidAt ?? p.createdAt)}</Text>
                        </View>
                        <View style={s.rowRight}>
                          <Text style={[s.rowAmount, p.paymentStatus === 'refunded' && s.rowAmountStrike]}>
                            {formatMoney(p.amountSeller)}
                          </Text>
                          <View style={[s.badge, { backgroundColor: badge.bg }]}>
                            <Text style={[s.badgeText, { color: badge.fg }]}>{badge.label}</Text>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </ScrollView>
              )
            )}

            <TouchableOpacity style={s.closeBtn} onPress={onClose} activeOpacity={0.7}>
              <Text style={s.closeBtnText}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center', padding: Spacing.lg,
  },
  card: {
    width: Platform.OS === 'web' ? 440 : '100%',
    maxWidth: 440, maxHeight: '98%', minHeight: '70%',
    backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg,
    overflow: 'hidden',
  },
  title: { fontSize: 22, fontWeight: FontWeight.extrabold, color: Colors.textPrimary, textAlign: 'center' },

  detailHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { fontSize: FontSize.base, color: Colors.primary, fontWeight: FontWeight.semibold, width: 64 },
  detailTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.extrabold, color: Colors.textPrimary, textAlign: 'center', flex: 1 },

  totals: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.lg },
  totalBox: { flex: 1, borderRadius: Radius.md, paddingVertical: Spacing.md, paddingHorizontal: Spacing.sm, alignItems: 'center' },
  totalAmount: { fontSize: 20, fontWeight: FontWeight.extrabold },
  totalLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  totalHint: { fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: 4, fontWeight: FontWeight.semibold },

  allBtn: {
    marginTop: Spacing.md, paddingVertical: Spacing.md, backgroundColor: '#FFEDD5',
    borderRadius: Radius.md, alignItems: 'center',
  },
  allBtnText: { color: '#9A3412', fontSize: FontSize.base, fontWeight: FontWeight.bold },

  list: { marginTop: Spacing.md },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  rowType: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  rowDate: { fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: 2 },
  rowRight: { alignItems: 'flex-end', gap: 4 },
  rowAmount: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  rowAmountStrike: { textDecorationLine: 'line-through', color: Colors.textTertiary },
  badge: { borderRadius: Radius.sm, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },

  center: { paddingVertical: Spacing.xl, alignItems: 'center' },
  empty: {
    textAlign: 'center', color: Colors.textSecondary, fontSize: FontSize.sm,
    paddingVertical: Spacing.xl, lineHeight: 20,
  },

  note: {
    fontSize: FontSize.xs, color: Colors.textTertiary, fontStyle: 'italic',
    marginTop: Spacing.lg, lineHeight: 16, textAlign: 'center',
  },
  closeBtn: {
    marginTop: Spacing.md, paddingVertical: Spacing.md, backgroundColor: Colors.danger,
    borderRadius: Radius.md, alignItems: 'center',
  },
  closeBtnText: { color: '#fff', fontSize: FontSize.base, fontWeight: FontWeight.bold },
});
