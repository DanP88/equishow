import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView, Modal } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../../constants/theme';
import { useMyConcoursClaims } from '../../hooks/useConcoursClaims';

export default function OrgConcoursScreen() {
  // LOT 1 Org V2 — fin des concours mock : on n'affiche QUE les concours réels
  // revendiqués (claims). « Créer un concours » oriente d'abord vers la
  // revendication (anti-doublon), aucune écriture mock dans concoursStore.
  const { claims, reload: reloadClaims } = useMyConcoursClaims();
  // L'organisateur voit TOUS les statuts (en attente / approuvé / refusé).
  const revendiques = claims;
  const [showCreateModal, setShowCreateModal] = useState(false);

  useFocusEffect(useCallback(() => {
    reloadClaims();
  }, [reloadClaims]));
  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Mes concours</Text>
      </View>

      <ScrollView contentContainerStyle={s.container}>
        {/* LOT P0 — Revendiquer un concours FFE existant + Radar de demande (action prioritaire) */}
        <TouchableOpacity style={s.claimBtn} onPress={() => router.push('/org-revendiquer' as any)} activeOpacity={0.85}>
          <Text style={s.createIcon}>📡</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.claimTitle}>Revendiquer un concours</Text>
            <Text style={s.createHint}>Accède au Radar de demande de ton concours</Text>
          </View>
          <Text style={s.createArrow}>→</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.createBtn} onPress={() => setShowCreateModal(true)} activeOpacity={0.85}>
          <Text style={s.createIcon}>🏆</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.createTitle}>Créer un concours</Text>
            <Text style={s.createHint}>Remplissez tous les détails de votre concours</Text>
          </View>
          <Text style={s.createArrow}>→</Text>
        </TouchableOpacity>

        {/* PART 4 — Démo locale : visualiser le Radar même sans migration 076. */}
        {__DEV__ && (
          <TouchableOpacity
            style={s.demoBtn}
            activeOpacity={0.85}
            onPress={() => router.push({ pathname: '/org-radar', params: { concoursId: 'demo', nom: 'CSO de Deauville' } } as any)}
          >
            <Text style={s.createIcon}>🧪</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.claimTitle}>Voir un exemple de Radar</Text>
              <Text style={s.createHint}>Mode démonstration (local) — données d'exemple</Text>
            </View>
            <Text style={s.createArrow}>→</Text>
          </TouchableOpacity>
        )}

        {revendiques.length > 0 && (
          <View style={s.claimsSection}>
            <Text style={s.claimsTitle}>Mes concours revendiqués</Text>
            {revendiques.map((c) => {
              const approved = c.status === 'approved';
              const meta =
                c.status === 'approved' ? { label: '✅ Approuvé', bg: '#ECFDF5', fg: '#10B981' }
                : c.status === 'rejected' ? { label: '❌ Refusé', bg: '#FEE2E2', fg: '#EF4444' }
                : { label: '⏳ En attente de validation', bg: '#FFF7ED', fg: '#F59E0B' };
              return (
                <View key={c.id} style={s.claimCard}>
                  <Text style={s.claimName} numberOfLines={1}>{c.concoursNom ?? c.concoursId}</Text>
                  <View style={[s.claimBadge, { backgroundColor: meta.bg }]}>
                    <Text style={[s.claimBadgeTxt, { color: meta.fg }]}>{meta.label}</Text>
                  </View>
                  {approved ? (
                    <TouchableOpacity
                      style={s.radarBtn}
                      activeOpacity={0.85}
                      onPress={() => router.push({ pathname: '/org-radar', params: { concoursId: c.concoursId, nom: c.concoursNom ?? '' } } as any)}
                    >
                      <Text style={s.radarBtnTxt}>📊 Voir le Radar</Text>
                    </TouchableOpacity>
                  ) : (
                    <Text style={s.radarHint}>📊 Radar disponible après validation</Text>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {revendiques.length === 0 && (
          <Text style={s.emptyText}>
            Aucun concours revendiqué pour l'instant. Revendique ton concours FFE pour accéder à ton Radar de demande.
          </Text>
        )}
      </ScrollView>

      {/* Modale anti-doublon : oriente d'abord vers la revendication d'un concours
          FFE déjà importé. La création manuelle est volontairement désactivée
          (à venir) — aucune écriture mock dans concoursStore. */}
      <Modal visible={showCreateModal} transparent animationType="fade" onRequestClose={() => setShowCreateModal(false)}>
        <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={() => setShowCreateModal(false)}>
          <TouchableOpacity activeOpacity={1} style={s.sheet}>
            <Text style={s.modalIcon}>🏆</Text>
            <Text style={s.modalTitle}>Vérifie avant de créer</Text>
            <Text style={s.modalMsg}>
              Avant de créer un nouveau concours, vérifiez d'abord s'il existe déjà dans Equishow. De nombreux concours FFE sont déjà importés.
            </Text>

            <TouchableOpacity
              style={s.modalPrimary}
              activeOpacity={0.85}
              onPress={() => { setShowCreateModal(false); router.push('/org-revendiquer' as any); }}
            >
              <Text style={s.modalPrimaryTxt}>🔍 Rechercher / revendiquer un concours existant</Text>
            </TouchableOpacity>

            <View style={s.modalSecondary}>
              <Text style={s.modalSecondaryTxt}>➕ Créer un nouveau concours</Text>
              <Text style={s.modalSoon}>Bientôt disponible</Text>
            </View>

            <TouchableOpacity onPress={() => setShowCreateModal(false)} activeOpacity={0.7}>
              <Text style={s.modalCancel}>Fermer</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: { padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  container: { padding: Spacing.lg, gap: Spacing.md },
  createBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.primaryLight, borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.primaryBorder, gap: Spacing.md, ...Shadow.card },
  createIcon: { fontSize: 28 },
  createTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.primary },
  createHint: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  createArrow: { fontSize: 20, color: Colors.primary, fontWeight: FontWeight.bold },
  claimBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 1.5, borderColor: Colors.primaryBorder, gap: Spacing.md },
  claimTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  claimsSection: { gap: Spacing.sm },
  claimsTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginTop: Spacing.sm },
  claimCard: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, gap: Spacing.sm, ...Shadow.card },
  claimName: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  claimStatus: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  claimBadge: { alignSelf: 'flex-start', borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 4 },
  claimBadgeTxt: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  demoBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF3C7', borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: '#FCD34D', gap: Spacing.md },
  concoursCard: { backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, ...Shadow.card },
  concoursHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.sm },
  concoursName: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary, flex: 1 },
  statutBadge: { borderRadius: Radius.xs, paddingHorizontal: Spacing.sm, paddingVertical: 3 },
  statutText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  concoursDate: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.xs },
  concoursDetail: { fontSize: FontSize.sm, color: Colors.textTertiary, marginBottom: Spacing.md },
  concoursStats: { flexDirection: 'row', gap: Spacing.sm },
  statBadge: { backgroundColor: Colors.surfaceVariant, borderRadius: Radius.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs },
  statLabel: { fontSize: FontSize.xs, color: Colors.textTertiary },
  statValue: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  emptyText: { fontSize: FontSize.sm, color: Colors.textTertiary, textAlign: 'center', marginTop: Spacing.xl, lineHeight: 20 },

  radarBtn: { marginTop: Spacing.xs, backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: Spacing.md, paddingHorizontal: Spacing.md, alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch', ...Shadow.card },
  radarBtnTxt: { color: Colors.textInverse, fontWeight: FontWeight.bold, fontSize: FontSize.sm, textAlign: 'center' },
  radarHint: { marginTop: Spacing.sm, fontSize: FontSize.xs, color: Colors.textTertiary, fontStyle: 'italic' },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: Spacing.lg },
  sheet: { backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.xl, gap: Spacing.md, alignItems: 'stretch' },
  modalIcon: { fontSize: 36, textAlign: 'center' },
  modalTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.extrabold, color: Colors.textPrimary, textAlign: 'center' },
  modalMsg: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  modalPrimary: { backgroundColor: Colors.primary, borderRadius: Radius.lg, paddingVertical: Spacing.md, paddingHorizontal: Spacing.md, alignItems: 'center', marginTop: Spacing.sm },
  modalPrimaryTxt: { color: Colors.textInverse, fontWeight: FontWeight.bold, fontSize: FontSize.sm, textAlign: 'center' },
  modalSecondary: { backgroundColor: Colors.surfaceVariant, borderRadius: Radius.lg, paddingVertical: Spacing.md, alignItems: 'center', opacity: 0.7 },
  modalSecondaryTxt: { color: Colors.textTertiary, fontWeight: FontWeight.semibold, fontSize: FontSize.sm },
  modalSoon: { color: Colors.textTertiary, fontSize: FontSize.xs, fontStyle: 'italic', marginTop: 2 },
  modalCancel: { color: Colors.textSecondary, fontWeight: FontWeight.semibold, fontSize: FontSize.sm, textAlign: 'center', paddingVertical: Spacing.sm },
});
