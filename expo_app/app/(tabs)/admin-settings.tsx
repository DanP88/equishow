import { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
} from 'react-native';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, FontWeight } from '../../constants/theme';
import { useAuth } from '../../hooks/useAuth';
import { AuthGuard } from '../../components/AuthGuard';
import { useScreenTracking } from '../../hooks/useScreenTracking';
import { ConfirmModal } from '../../components/ConfirmModal';
import { AlertModal } from '../../components/AlertModal';
import { router } from 'expo-router';

export default function AdminSettingsScreen() {
  return (
    <AuthGuard requiredRole="admin">
      <AdminSettingsContent />
    </AuthGuard>
  );
}

function AdminSettingsContent() {
  useScreenTracking('admin-settings');
  const { profile, isLoading, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  async function doLogout() {
    if (loggingOut) return;
    setShowLogoutConfirm(false);
    setLoggingOut(true);
    const { error } = await logout();
    if (error) {
      setLoggingOut(false);
      setLogoutError(typeof error === 'string' ? error : 'Impossible de se déconnecter.');
      return;
    }
    router.replace('/(auth)/login');
  }

  function handleLogout() {
    setShowLogoutConfirm(true);
  }

  if (isLoading) return null;

  if (profile?.role !== 'admin') {
    return (
      <View style={styles.accessDenied}>
        <Text style={styles.accessDeniedIcon}>🔒</Text>
        <Text style={styles.accessDeniedTitle}>Accès refusé</Text>
        <Text style={styles.accessDeniedText}>Cette page est réservée aux administrateurs.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Paramètres Admin</Text>
        <Text style={styles.subtitle}>Gestion de la plateforme Equishow</Text>
      </View>

      {/* CSV Import shortcut (déplacé hors de la bottom bar admin) */}
      <TouchableOpacity
        style={styles.analyticsBtn}
        onPress={() => router.push('/(tabs)/import-concours')}
        activeOpacity={0.85}
      >
        <Text style={styles.analyticsBtnIcon}>📋</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.analyticsBtnTitle}>Import CSV concours</Text>
          <Text style={styles.analyticsBtnSub}>Importer les concours depuis un fichier CSV</Text>
        </View>
        <Text style={styles.analyticsBtnArrow}>›</Text>
      </TouchableOpacity>

      {/* Admin Info */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Informations Admin</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Nom:</Text>
          <Text style={styles.infoValue}>{profile.prenom} {profile.nom}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Email:</Text>
          <Text style={styles.infoValue}>{profile.email}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Rôle:</Text>
          <Text style={styles.infoValue}>Admin</Text>
        </View>
      </View>

      {/* System Info */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Informations Système</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Version:</Text>
          <Text style={styles.infoValue}>1.0.0</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Environnement:</Text>
          <Text style={styles.infoValue}>Production</Text>
        </View>
      </View>

      {/* Logout */}
      <TouchableOpacity
        style={[styles.logoutBtn, loggingOut && { opacity: 0.6 }]}
        onPress={handleLogout}
        disabled={loggingOut}
        activeOpacity={0.85}
      >
        <Text style={styles.logoutText}>{loggingOut ? 'Déconnexion…' : '🚪 Se déconnecter'}</Text>
      </TouchableOpacity>

      <ConfirmModal
        visible={showLogoutConfirm}
        title="Se déconnecter ?"
        message="Vous reviendrez à l'écran de connexion."
        cancelLabel="Annuler"
        confirmLabel="Se déconnecter"
        destructive
        onCancel={() => setShowLogoutConfirm(false)}
        onConfirm={doLogout}
      />

      <AlertModal
        visible={!!logoutError}
        title="Erreur"
        message={logoutError ?? ''}
        variant="error"
        onClose={() => setLogoutError(null)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  header: {
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: FontSize.xxxl,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: FontSize.base,
    color: Colors.textSecondary,
  },
  analyticsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
  },
  analyticsBtnIcon: { fontSize: 28 },
  analyticsBtnTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.primary },
  analyticsBtnSub: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  analyticsBtnArrow: { fontSize: 24, color: Colors.primary, fontWeight: FontWeight.bold },
  countBadge: {
    minWidth: 24, height: 24, borderRadius: 12, backgroundColor: '#DC2626',
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6,
  },
  countBadgeText: { color: '#FFFFFF', fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  logoutBtn: {
    backgroundColor: '#DC2626',
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  logoutText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: '#FFFFFF',
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  description: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.lg,
    lineHeight: 20,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  infoLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: FontWeight.semibold,
  },
  infoValue: {
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    fontWeight: FontWeight.semibold,
  },
  commissionSection: {
    gap: Spacing.md,
  },
  commissionDisplay: {
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.md,
    padding: Spacing.md,
    alignItems: 'center',
  },
  currentLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  currentValue: {
    fontSize: FontSize.xxxl,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
  },
  inputGroup: {
    gap: Spacing.xs,
  },
  inputLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.borderMedium,
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  input: {
    flex: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
    backgroundColor: Colors.surface,
  },
  inputSuffix: {
    paddingHorizontal: Spacing.md,
    fontSize: FontSize.base,
    color: Colors.textSecondary,
    fontWeight: FontWeight.semibold,
  },
  inputHint: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
  },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: Colors.textInverse,
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
  },
  successMessage: {
    backgroundColor: '#D1FAE5',
    borderLeftWidth: 4,
    borderLeftColor: '#10B981',
    padding: Spacing.md,
    borderRadius: Radius.sm,
  },
  successText: {
    color: '#065F46',
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  accessDenied: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  accessDeniedIcon: { fontSize: 48 },
  accessDeniedTitle: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  accessDeniedText: {
    fontSize: FontSize.base,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  commissionsGrid: {
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  commissionCard: {
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.sm,
  },
  commissionCardTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  commissionCardDesc: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
  },
});
