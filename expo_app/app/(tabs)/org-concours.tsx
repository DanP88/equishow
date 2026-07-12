import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView, Modal, ActivityIndicator } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../../constants/theme';
import { useMyConcoursClaims } from '../../hooks/useConcoursClaims';
import {
  useMyConcours, publishConcours, archiveConcours, fetchConcoursForEdit,
  ConcoursStatut,
} from '../../hooks/useConcours';
import { validateConcoursForm, rowToFormFields } from '../../lib/concoursValidation';
import { ConfirmModal } from '../../components/ConfirmModal';
import { AlertModal } from '../../components/AlertModal';

const STATUT_TABS: { key: ConcoursStatut; label: string }[] = [
  { key: 'brouillon', label: 'Brouillons' },
  { key: 'publie', label: 'Publiés' },
  { key: 'archive', label: 'Archivés' },
];

const STATUT_BADGE: Record<ConcoursStatut, { label: string; bg: string; fg: string }> = {
  brouillon: { label: '📝 Brouillon', bg: '#FFF7ED', fg: '#F59E0B' },
  publie: { label: '✅ Publié', bg: '#ECFDF5', fg: '#10B981' },
  archive: { label: '🗄️ Archivé', bg: '#F3F4F6', fg: '#6B7280' },
};

export default function OrgConcoursScreen() {
  // LOT 1 Org V2 — fin des concours mock : on n'affiche QUE les concours réels
  // revendiqués (claims). « Créer un concours » oriente d'abord vers la
  // revendication (anti-doublon), aucune écriture mock dans concoursStore.
  const { claims, reload: reloadClaims } = useMyConcoursClaims();
  // L'organisateur voit TOUS les statuts (en attente / approuvé / refusé).
  const revendiques = claims;
  const [showCreateModal, setShowCreateModal] = useState(false);

  // PR2-C — « Mes concours » créés par l'organisateur (filtrés serveur par statut).
  const [activeTab, setActiveTab] = useState<ConcoursStatut>('brouillon');
  const { concours: myConcours, isLoading: myLoading, reload: reloadMine } = useMyConcours(activeTab);
  const [confirmPublishId, setConfirmPublishId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [alertState, setAlertState] = useState<{ title: string; message: string; variant: 'info' | 'success' | 'error' } | null>(null);

  useFocusEffect(useCallback(() => {
    reloadClaims();
    reloadMine();
  }, [reloadClaims, reloadMine]));

  // Publication : valide d'abord que le brouillon est complet (réutilise la
  // validation du formulaire sur le row persisté), puis change UNIQUEMENT le statut.
  const doPublish = useCallback(async (id: string) => {
    setConfirmPublishId(null);
    setBusyId(id);
    const row = await fetchConcoursForEdit(id);
    if (!row) {
      setBusyId(null);
      setAlertState({ title: 'Erreur', message: 'Concours introuvable ou accès refusé.', variant: 'error' });
      return;
    }
    const invalid = validateConcoursForm(rowToFormFields(row), { allowPastDate: true });
    if (invalid) {
      setBusyId(null);
      setAlertState({ title: 'Informations incomplètes', message: `${invalid.message} Modifie le brouillon avant de le publier.`, variant: 'error' });
      return;
    }
    const { ok, error } = await publishConcours(id);
    setBusyId(null);
    if (!ok) { setAlertState({ title: 'Publication impossible', message: error ?? 'Réessaie.', variant: 'error' }); return; }
    setAlertState({ title: 'Concours publié 🎉', message: 'Il est maintenant visible dans les listes publiques.', variant: 'success' });
    reloadMine();
  }, [reloadMine]);

  const doArchive = useCallback(async (id: string) => {
    setBusyId(id);
    const { ok, error } = await archiveConcours(id);
    setBusyId(null);
    if (!ok) { setAlertState({ title: 'Archivage impossible', message: error ?? 'Réessaie.', variant: 'error' }); return; }
    setAlertState({ title: 'Concours archivé', message: 'Il n\'apparaît plus dans les listes publiques.', variant: 'info' });
    reloadMine();
  }, [reloadMine]);
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

        {/* PR2-C — Mes concours créés (brouillons / publiés / archivés), filtrés serveur */}
        <View style={s.mineSection}>
          <Text style={s.mineTitle}>Mes concours créés</Text>
          <View style={s.tabsRow}>
            {STATUT_TABS.map((t) => (
              <TouchableOpacity
                key={t.key}
                style={[s.tab, activeTab === t.key && s.tabActive]}
                onPress={() => setActiveTab(t.key)}
                activeOpacity={0.8}
              >
                <Text style={[s.tabTxt, activeTab === t.key && s.tabTxtActive]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {myLoading ? (
            <ActivityIndicator color={Colors.primary} style={{ marginTop: Spacing.md }} />
          ) : myConcours.length === 0 ? (
            <Text style={s.mineEmpty}>
              {activeTab === 'brouillon'
                ? 'Aucun brouillon. Crée un concours pour commencer.'
                : activeTab === 'publie'
                ? 'Aucun concours publié pour le moment.'
                : 'Aucun concours archivé.'}
            </Text>
          ) : (
            myConcours.map((c) => {
              const badge = STATUT_BADGE[c.statut];
              const busy = busyId === c.id;
              return (
                <View key={c.id} style={s.concoursCard}>
                  <View style={s.concoursHeader}>
                    <Text style={s.concoursName} numberOfLines={1}>{c.nom}</Text>
                    <View style={[s.statutBadge, { backgroundColor: badge.bg }]}>
                      <Text style={[s.statutText, { color: badge.fg }]}>{badge.label}</Text>
                    </View>
                  </View>
                  {!!c.dateLabel && <Text style={s.concoursDate}>📅 {c.dateLabel}</Text>}
                  {!!c.lieu && <Text style={s.concoursDetail} numberOfLines={1}>📍 {c.lieu}</Text>}

                  <View style={s.actionsRow}>
                    <TouchableOpacity
                      style={[s.actionBtn, s.actionSecondary]}
                      onPress={() => router.push({ pathname: '/creer-concours', params: { id: c.id } } as any)}
                      activeOpacity={0.85}
                      disabled={busy}
                    >
                      <Text style={s.actionSecondaryTxt}>✏️ Modifier</Text>
                    </TouchableOpacity>

                    {c.statut === 'brouillon' && (
                      <TouchableOpacity
                        style={[s.actionBtn, s.actionPrimary, busy && s.actionDisabled]}
                        onPress={() => setConfirmPublishId(c.id)}
                        activeOpacity={0.85}
                        disabled={busy}
                      >
                        {busy ? <ActivityIndicator color={Colors.textInverse} size="small" />
                          : <Text style={s.actionPrimaryTxt}>🚀 Publier</Text>}
                      </TouchableOpacity>
                    )}

                    {c.statut === 'publie' && (
                      <TouchableOpacity
                        style={[s.actionBtn, s.actionSecondary, busy && s.actionDisabled]}
                        onPress={() => doArchive(c.id)}
                        activeOpacity={0.85}
                        disabled={busy}
                      >
                        {busy ? <ActivityIndicator color={Colors.textSecondary} size="small" />
                          : <Text style={s.actionSecondaryTxt}>🗄️ Archiver</Text>}
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </View>

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

            <TouchableOpacity
              style={s.modalSecondaryBtn}
              activeOpacity={0.85}
              onPress={() => { setShowCreateModal(false); router.push('/creer-concours' as any); }}
            >
              <Text style={s.modalSecondaryBtnTxt}>➕ Créer un nouveau concours</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setShowCreateModal(false)} activeOpacity={0.7}>
              <Text style={s.modalCancel}>Fermer</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <ConfirmModal
        visible={!!confirmPublishId}
        title="Publier ce concours ?"
        message="Il deviendra immédiatement visible par tous les cavaliers dans les listes publiques. Tu pourras encore le modifier ou l'archiver ensuite."
        confirmLabel="Publier"
        cancelLabel="Annuler"
        onConfirm={() => { if (confirmPublishId) doPublish(confirmPublishId); }}
        onCancel={() => setConfirmPublishId(null)}
      />

      <AlertModal
        visible={!!alertState}
        title={alertState?.title ?? ''}
        message={alertState?.message}
        variant={alertState?.variant ?? 'info'}
        onClose={() => setAlertState(null)}
      />
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
  modalSecondaryBtn: { backgroundColor: Colors.surfaceVariant, borderRadius: Radius.lg, paddingVertical: Spacing.md, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  modalSecondaryBtnTxt: { color: Colors.textPrimary, fontWeight: FontWeight.bold, fontSize: FontSize.sm },

  // PR2-C — Mes concours créés
  mineSection: { gap: Spacing.sm, marginTop: Spacing.sm },
  mineTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  tabsRow: { flexDirection: 'row', gap: Spacing.xs, backgroundColor: Colors.surfaceVariant, borderRadius: Radius.md, padding: 4 },
  tab: { flex: 1, paddingVertical: Spacing.sm, borderRadius: Radius.sm, alignItems: 'center' },
  tabActive: { backgroundColor: Colors.surface, ...Shadow.card },
  tabTxt: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.textSecondary },
  tabTxtActive: { color: Colors.primary, fontWeight: FontWeight.bold },
  mineEmpty: { fontSize: FontSize.sm, color: Colors.textTertiary, textAlign: 'center', paddingVertical: Spacing.lg, lineHeight: 20 },
  actionsRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  actionBtn: { flex: 1, paddingVertical: Spacing.sm + 2, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  actionPrimary: { backgroundColor: Colors.primary },
  actionPrimaryTxt: { color: Colors.textInverse, fontWeight: FontWeight.bold, fontSize: FontSize.sm },
  actionSecondary: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  actionSecondaryTxt: { color: Colors.textSecondary, fontWeight: FontWeight.semibold, fontSize: FontSize.sm },
  actionDisabled: { opacity: 0.6 },
});
