// ─────────────────────────────────────────────────────────────────────────────
// <StripeAccountModal /> — Détails du compte Stripe Connect du vendeur
//
// Ouverte depuis la ligne "Compte Stripe actif" de SellerStripeMenuItem.
// N'embarque AUCUNE logique Stripe : elle reçoit l'état déjà chargé et délègue
// les actions au parent (onManage = onboarding/gestion, onSeePayments).
//
// Deux états visuels :
//   - 'active'   : compte connecté, paiements/virements activés
//   - 'inactive' : compte à créer ou en attente de vérification
//
// Style calqué sur LevelInfoModal (backdrop tap-to-close, carte blanche
// arrondie, bouton Fermer). Compatible iPhone.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, ScrollView, Platform } from 'react-native';
import { Colors } from '../constants/colors';
import { Spacing, Radius, FontSize, FontWeight } from '../constants/theme';

export type StripeModalState = 'active' | 'inactive';

interface Props {
  visible: boolean;
  state: StripeModalState;
  lastUpdated?: string | null; // ISO timestamp (stripe_last_updated) ou null
  onClose: () => void;
  onManage: () => void;        // bouton principal (onboarding / gestion Stripe)
  onSeePayments: () => void;   // bouton secondaire
}

function formatDate(iso?: string | null): string {
  if (!iso) return 'Non disponible';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 'Non disponible';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}

export function StripeAccountModal({
  visible, state, lastUpdated, onClose, onManage, onSeePayments,
}: Props) {
  const isActive = state === 'active';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
          <View style={s.card}>
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
              <Text style={s.icon}>{isActive ? '✅' : '⚙️'}</Text>
              <Text style={s.title}>
                {isActive ? 'Compte Stripe actif' : 'Compte Stripe à configurer'}
              </Text>
              <Text style={s.intro}>
                {isActive
                  ? 'Votre compte Stripe est connecté. Vous pouvez recevoir vos paiements sur Equishow.'
                  : 'Configurez votre compte Stripe pour recevoir vos paiements sur Equishow.'}
              </Text>

              {isActive && (
                <View style={s.details}>
                  <DetailRow label="Statut" value="Actif" valueColor={Colors.success} />
                  <DetailRow label="Paiements" value="Activés" valueColor={Colors.success} />
                  <DetailRow label="Virements" value="Compte bancaire Stripe" />
                  <DetailRow label="Séquestre Equishow" value="Après validation du service" />
                  <DetailRow label="Commission Equishow" value="Prélevée automatiquement" />
                  <DetailRow label="Dernière vérification" value={formatDate(lastUpdated)} />
                </View>
              )}

              {/* Actions */}
              <TouchableOpacity style={s.primaryBtn} onPress={onManage} activeOpacity={0.85}>
                <Text style={s.primaryBtnText}>
                  {isActive ? 'Gérer mon compte Stripe' : 'Activer mon compte Stripe'}
                </Text>
              </TouchableOpacity>

              {isActive && (
                <TouchableOpacity style={s.secondaryBtn} onPress={onSeePayments} activeOpacity={0.85}>
                  <Text style={s.secondaryBtnText}>Voir mes paiements</Text>
                </TouchableOpacity>
              )}
            </ScrollView>

            <TouchableOpacity style={s.closeBtn} onPress={onClose} activeOpacity={0.7}>
              <Text style={s.closeBtnText}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

function DetailRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <View style={s.detailRow}>
      <Text style={s.detailLabel}>{label}</Text>
      <Text style={[s.detailValue, !!valueColor && { color: valueColor }]}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center', padding: Spacing.lg,
  },
  card: {
    width: Platform.OS === 'web' ? 460 : '100%',
    maxWidth: 460, maxHeight: '98%', minHeight: '88%',
    backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg,
    overflow: 'hidden',
  },
  icon: { fontSize: 36, textAlign: 'center', marginBottom: 2 },
  title: { fontSize: 22, fontWeight: FontWeight.extrabold, color: Colors.textPrimary, textAlign: 'center' },
  intro: {
    fontSize: FontSize.base, color: Colors.textSecondary, lineHeight: 21,
    textAlign: 'center', marginTop: Spacing.xs, marginBottom: Spacing.md,
  },

  details: {
    backgroundColor: Colors.surfaceVariant, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: 2, marginBottom: Spacing.md,
  },
  detailRow: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    gap: Spacing.md, paddingVertical: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  detailLabel: { fontSize: FontSize.sm, color: Colors.textSecondary, flexShrink: 0, maxWidth: '45%' },
  detailValue: {
    fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textPrimary,
    flex: 1, textAlign: 'right',
  },

  primaryBtn: {
    paddingVertical: Spacing.md, backgroundColor: Colors.primary,
    borderRadius: Radius.md, alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontSize: FontSize.base, fontWeight: FontWeight.bold },
  secondaryBtn: {
    marginTop: Spacing.sm, paddingVertical: Spacing.md, backgroundColor: Colors.surfaceVariant,
    borderRadius: Radius.md, alignItems: 'center', borderWidth: 1, borderColor: Colors.border,
  },
  secondaryBtnText: { color: Colors.textPrimary, fontSize: FontSize.base, fontWeight: FontWeight.semibold },

  closeBtn: {
    marginTop: Spacing.md, paddingVertical: Spacing.md, backgroundColor: Colors.danger,
    borderRadius: Radius.md, alignItems: 'center',
  },
  closeBtnText: { color: '#fff', fontSize: FontSize.base, fontWeight: FontWeight.bold },
});
