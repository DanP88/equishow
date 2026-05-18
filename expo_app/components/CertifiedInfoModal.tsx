// ─────────────────────────────────────────────────────────────────────────────
// <CertifiedInfoModal /> — Popup explicative quand on tape sur un sceau "Coach Certifié"
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, ScrollView, Platform } from 'react-native';
import { Colors } from '../constants/colors';
import { Spacing, Radius, FontSize, FontWeight } from '../constants/theme';
import { CertifiedSeal } from './CertifiedSeal';

interface Props {
  visible: boolean;
  isCurrentUser?: boolean;
  onClose: () => void;
}

export function CertifiedInfoModal({ visible, isCurrentUser, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
          <View style={s.card}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={s.heroSeal}>
                <CertifiedSeal size="lg" />
              </View>

              <Text style={s.title}>Coach Certifié</Text>
              <Text style={s.subtitle}>Sceau de validation Equishow · Gratuit</Text>

              <Text style={s.description}>
                Ce sceau garantit que le coach a démontré son sérieux et la qualité de ses prestations
                à travers son activité réelle sur Equishow. Il n'est jamais payant : seul le mérite compte.
              </Text>

              <View style={s.criteriaBlock}>
                <Text style={s.criteriaTitle}>Comment l'obtenir</Text>
                <CriteriaRow icon="✓" text="Au moins 10 coachings réservés ET finalisés (payés)" />
                <CriteriaRow icon="⭐" text="Note moyenne ≥ 4,2/5 sur les avis cavaliers" />
                <CriteriaRow icon="🛡️" text="Aucun signalement critique en cours" />
              </View>

              <View style={s.distinctionBox}>
                <Text style={s.distinctionTitle}>⚠️ À ne pas confondre avec le badge Boost</Text>
                <Text style={s.distinctionText}>
                  <Text style={{ fontWeight: '700' }}>Coach Certifié</Text> = mérite, gratuit, automatique.{'\n'}
                  <Text style={{ fontWeight: '700' }}>Boost</Text> = visibilité sponsorisée payante (4,90€/30j),
                  n'a aucun lien avec la qualité du coach.
                </Text>
              </View>

              {isCurrentUser && (
                <Text style={s.note}>
                  La certification est vérifiée automatiquement chaque nuit. Continue d'offrir des
                  prestations de qualité pour la conserver.
                </Text>
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

function CriteriaRow({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={s.criteriaRow}>
      <Text style={s.criteriaIcon}>{icon}</Text>
      <Text style={s.criteriaText}>{text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center', padding: Spacing.lg,
  },
  card: {
    width: Platform.OS === 'web' ? 420 : '100%',
    maxWidth: 420, maxHeight: '88%',
    backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg,
  },
  heroSeal: { alignItems: 'center', marginBottom: Spacing.md },
  title: { fontSize: 24, fontWeight: FontWeight.extrabold, color: Colors.textPrimary, textAlign: 'center' },
  subtitle: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', marginTop: 4, marginBottom: Spacing.md },
  description: { fontSize: FontSize.base, color: Colors.textPrimary, lineHeight: 22, textAlign: 'center', marginBottom: Spacing.lg },

  criteriaBlock: { backgroundColor: Colors.surfaceVariant, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.lg },
  criteriaTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.sm },
  criteriaRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, marginBottom: 6 },
  criteriaIcon: { fontSize: 16, width: 24, textAlign: 'center' },
  criteriaText: { flex: 1, fontSize: FontSize.sm, color: Colors.textPrimary, lineHeight: 20 },

  distinctionBox: {
    backgroundColor: '#FEF3C7', borderColor: '#F59E0B', borderWidth: 1,
    borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.md,
  },
  distinctionTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: '#92400E', marginBottom: 6 },
  distinctionText: { fontSize: FontSize.sm, color: '#78350F', lineHeight: 20 },

  note: { fontSize: FontSize.xs, color: Colors.textTertiary, fontStyle: 'italic', textAlign: 'center', lineHeight: 16, marginTop: Spacing.sm },

  closeBtn: { marginTop: Spacing.md, paddingVertical: Spacing.md, backgroundColor: Colors.primary, borderRadius: Radius.md, alignItems: 'center' },
  closeBtnText: { color: '#fff', fontSize: FontSize.base, fontWeight: FontWeight.bold },
});
