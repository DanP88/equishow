import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView, Alert } from 'react-native';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../../constants/theme';
import { userStore } from '../../data/store';

const ACCOUNTS = [
  { role: 'cavalier', label: 'Cavalier', emoji: '🐴' },
  { role: 'coach', label: 'Coach', emoji: '🎓' },
  { role: 'organisateur', label: 'Organisateur', emoji: '📋' },
  { role: 'admin', label: 'Admin', emoji: '⚙️' },
] as const;

export default function AdminProfilScreen() {
  const [currentRole] = useState(userStore.role);

  const handleSwitchAccount = (newRole: 'cavalier' | 'coach' | 'organisateur' | 'admin') => {
    const success = userStore.switchAccount(newRole);
    if (success) {
      Alert.alert(
        '✅ Compte changé',
        `Vous êtes maintenant connecté en tant que ${newRole}`,
        [{ text: 'OK' }]
      );
    } else {
      Alert.alert('❌ Erreur', 'Impossible de changer de compte');
    }
  };

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Profil Admin</Text>
      </View>

      <ScrollView contentContainerStyle={s.container}>
        {/* Profil actuel */}
        <View style={s.currentProfile}>
          <View style={[s.avatar, { backgroundColor: userStore.avatarColor }]}>
            <Text style={s.avatarText}>{userStore.prenom[0]}{userStore.nom[0]}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.profileName}>{userStore.prenom} {userStore.nom}</Text>
            <Text style={s.profilePseudo}>@{userStore.pseudo}</Text>
            <Text style={s.profileRole}>Actuellement: {currentRole}</Text>
          </View>
        </View>

        {/* Changer de compte */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>🔄 Changer de compte</Text>
          <Text style={s.sectionDesc}>Sélectionnez un rôle pour tester l'application</Text>

          <View style={s.accountsList}>
            {ACCOUNTS.map((account) => (
              <TouchableOpacity
                key={account.role}
                style={[
                  s.accountBtn,
                  currentRole === account.role && s.accountBtnActive,
                ]}
                onPress={() => handleSwitchAccount(account.role)}
              >
                <Text style={s.accountEmoji}>{account.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[s.accountLabel, currentRole === account.role && s.accountLabelActive]}>
                    {account.label}
                  </Text>
                  <Text style={s.accountRole}>{account.role}</Text>
                </View>
                {currentRole === account.role && (
                  <Text style={s.checkmark}>✓</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Infos */}
        <View style={s.infoBox}>
          <Text style={s.infoTitle}>ℹ️ À propos</Text>
          <Text style={s.infoText}>
            Cette fonctionnalité vous permet de tester l'application avec différents rôles et accès.
          </Text>
          <Text style={s.infoText}>
            Les données sont synchronisées en temps réel à travers tous les comptes.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: {
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  headerTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  container: {
    padding: Spacing.lg,
    gap: Spacing.lg,
  },

  // Profil actuel
  currentProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.card,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textInverse,
  },
  profileName: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  profilePseudo: {
    fontSize: FontSize.xs,
    color: Colors.primary,
    marginTop: Spacing.xs,
  },
  profileRole: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    marginTop: Spacing.xs,
  },

  // Section
  section: {
    gap: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  sectionDesc: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },

  // Liste de comptes
  accountsList: {
    gap: Spacing.sm,
  },
  accountBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 2,
    borderColor: Colors.border,
    ...Shadow.card,
  },
  accountBtnActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  accountEmoji: {
    fontSize: 28,
  },
  accountLabel: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  accountLabelActive: {
    color: Colors.primary,
  },
  accountRole: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  checkmark: {
    fontSize: FontSize.lg,
    color: Colors.primary,
    fontWeight: FontWeight.bold,
  },

  // Info box
  infoBox: {
    backgroundColor: '#EFF6FF',
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    gap: Spacing.sm,
  },
  infoTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: '#1E40AF',
  },
  infoText: {
    fontSize: FontSize.sm,
    color: '#1E40AF',
    lineHeight: 20,
  },
});
