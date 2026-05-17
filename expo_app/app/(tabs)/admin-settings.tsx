import { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert,
} from 'react-native';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, FontWeight } from '../../constants/theme';
import { ServiceType, CommissionConfig } from '../../types/service';
import { useCommissions } from '../../hooks/useCommissions';
import { savePlatformCommissions } from '../../hooks/usePlatformSettings';
import { useAuth } from '../../hooks/useAuth';
import { AuthGuard } from '../../components/AuthGuard';
import { useScreenTracking } from '../../hooks/useScreenTracking';
import { ConfirmModal } from '../../components/ConfirmModal';
import { AlertModal } from '../../components/AlertModal';
import { router } from 'expo-router';

const SERVICE_LABELS: Record<ServiceType, string> = {
  trajet: 'Trajets',
  location: 'Location de Van',
  cours: 'Cours de Coach',
  box: 'Location de Box',
};

const SERVICE_DESCRIPTIONS: Record<ServiceType, string> = {
  trajet: 'Commission sur les trajets classiques',
  location: 'Commission sur les locations de van',
  cours: 'Commission sur les cours de coaching',
  box: 'Commission sur les locations de box',
};

interface CommissionInput {
  trajet: string;
  location: string;
  cours: string;
  box: string;
}

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
  const commissions = useCommissions();
  const [commissionInputs, setCommissionInputs] = useState<CommissionInput>({
    trajet: (commissions.trajet * 100).toFixed(1),
    location: (commissions.location * 100).toFixed(1),
    cours: (commissions.cours * 100).toFixed(1),
    box: (commissions.box * 100).toFixed(1),
  });
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleCommissionChange = (serviceType: ServiceType, value: string) => {
    setCommissionInputs(prev => ({
      ...prev,
      [serviceType]: value,
    }));
  };

  const handleSaveAllCommissions = async () => {
    const newCommissions: Partial<CommissionConfig> = {};
    let isValid = true;

    (Object.keys(commissionInputs) as ServiceType[]).forEach((serviceType) => {
      const value = parseFloat(commissionInputs[serviceType]);
      if (isNaN(value) || value < 0 || value > 100) {
        isValid = false;
      } else {
        newCommissions[serviceType] = value / 100;
      }
    });

    if (!isValid) return;

    setSaving(true);
    const { error } = await savePlatformCommissions(newCommissions as CommissionConfig);
    setSaving(false);

    if (error) {
      Alert.alert('Erreur', `Impossible de sauvegarder : ${error}`);
    } else {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    }
  };

  const isValidCommissions = () => {
    return (Object.keys(commissionInputs) as ServiceType[]).every((serviceType) => {
      const value = parseFloat(commissionInputs[serviceType]);
      return !isNaN(value) && value >= 0 && value <= 100;
    });
  };

  const serviceTypes: ServiceType[] = ['trajet', 'location', 'cours', 'box'];

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

      {/* Analytics shortcut */}
      <TouchableOpacity
        style={styles.analyticsBtn}
        onPress={() => router.push('/admin-analytics')}
        activeOpacity={0.85}
      >
        <Text style={styles.analyticsBtnIcon}>📊</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.analyticsBtnTitle}>Analytics</Text>
          <Text style={styles.analyticsBtnSub}>Comportement utilisateurs · KPIs · funnels · erreurs</Text>
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

      {/* Commission Settings */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Commissions par Type de Service</Text>
        <Text style={styles.description}>
          Définissez le pourcentage de commission que la plateforme prend sur chaque type de transaction.
        </Text>

        <View style={styles.commissionsGrid}>
          {serviceTypes.map((serviceType) => (
            <View key={serviceType} style={styles.commissionCard}>
              <Text style={styles.commissionCardTitle}>{SERVICE_LABELS[serviceType]}</Text>
              <Text style={styles.commissionCardDesc}>{SERVICE_DESCRIPTIONS[serviceType]}</Text>

              <View style={styles.commissionDisplay}>
                <Text style={styles.currentLabel}>Commission actuelle:</Text>
                <Text style={styles.currentValue}>{(commissions[serviceType] * 100).toFixed(1)}%</Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Nouvelle commission (%)</Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.input}
                    value={commissionInputs[serviceType]}
                    onChangeText={(value) => handleCommissionChange(serviceType, value)}
                    placeholder="5.0"
                    placeholderTextColor={Colors.textTertiary}
                    keyboardType="decimal-pad"
                  />
                  <Text style={styles.inputSuffix}>%</Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.button, (!isValidCommissions() || saving) && styles.buttonDisabled]}
          onPress={handleSaveAllCommissions}
          disabled={!isValidCommissions() || saving}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>
            {saving ? 'Enregistrement...' : 'Enregistrer toutes les commissions'}
          </Text>
        </TouchableOpacity>

        {saveSuccess && (
          <View style={styles.successMessage}>
            <Text style={styles.successText}>✓ Commissions mises à jour avec succès</Text>
          </View>
        )}
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
