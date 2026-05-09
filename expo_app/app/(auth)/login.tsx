import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, FontWeight } from '../../constants/theme';
import { useAuth } from '../../hooks/useAuth';
import { TEST_ACCOUNTS } from '../../data/mockUsers';
import { userStore } from '../../data/store';
import { loginLimiter } from '../../lib/rateLimiter';

const SCREEN_BY_ROLE: Record<string, string> = {
  cavalier: '/(tabs)/chevaux',
  coach: '/(tabs)/coach-agenda',
  organisateur: '/(tabs)/profil-org',
  admin: '/(tabs)/admin-settings',
};

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const { login, isSigningIn } = useAuth();

  function handleTestAccountLogin(accountKey: string, role: string) {
    userStore.switchAccount(accountKey as any);
    const screen = SCREEN_BY_ROLE[role] || '/(tabs)/chevaux';
    router.replace(screen as any);
  }

  async function handleLogin() {
    setErrorMsg(null);
    if (!email.trim() || !password) {
      setErrorMsg('Veuillez remplir tous les champs.');
      return;
    }

    const limitState = await loginLimiter.getState();
    if (limitState.locked) {
      const mins = Math.ceil((limitState.resetAt - Date.now()) / 60000);
      setErrorMsg(`Trop de tentatives. Réessayez dans ${mins} minute${mins > 1 ? 's' : ''}.`);
      return;
    }

    const { user, error } = await login(email.trim(), password);
    if (error) {
      await loginLimiter.recordFailure(email.trim());
      setErrorMsg(typeof error === 'string' ? error : 'Email ou mot de passe incorrect.');
      return;
    }
    await loginLimiter.reset();
    const screen = (user?.role && SCREEN_BY_ROLE[user.role]) || '/(tabs)/chevaux';
    router.replace(screen as any);
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* Logo */}
        <View style={styles.logoArea}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>E</Text>
          </View>
          <Text style={styles.appName}>EQUISHOW</Text>
          <Text style={styles.tagline}>La plateforme des cavaliers</Text>
        </View>

        {/* Comptes de test — visibles uniquement en build de dev */}
        {__DEV__ && TEST_ACCOUNTS.length > 0 && (
          <View style={styles.testSection}>
            <Text style={styles.testTitle}>Comptes de test</Text>
            <View style={styles.testGrid}>
              {TEST_ACCOUNTS.map((account) => (
                <TouchableOpacity
                  key={account.accountKey}
                  style={styles.testCard}
                  onPress={() => handleTestAccountLogin(account.accountKey, account.role)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.testIcon}>{account.icon}</Text>
                  <Text style={styles.testLabel}>{account.label}</Text>
                  <Text style={styles.testEmail}>{account.email}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Form */}
        <View style={styles.form}>
          <Text style={styles.title}>Connexion</Text>

          {errorMsg ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          ) : null}

          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="email@exemple.fr"
              placeholderTextColor={Colors.textTertiary}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isSigningIn}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Mot de passe</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={Colors.textTertiary}
              secureTextEntry
              editable={!isSigningIn}
            />
          </View>

          <TouchableOpacity
            style={[styles.btn, isSigningIn && styles.btnDisabled]}
            onPress={handleLogin}
            activeOpacity={0.85}
            disabled={isSigningIn}
          >
            {isSigningIn
              ? <ActivityIndicator color={Colors.textInverse} />
              : <Text style={styles.btnText}>Se connecter</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push('/(auth)/signup')} style={styles.link}>
            <Text style={styles.linkText}>Pas encore de compte ? <Text style={styles.linkBold}>S'inscrire</Text></Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flexGrow: 1,
    padding: Spacing.lg,
    justifyContent: 'center',
  },
  logoArea: {
    alignItems: 'center',
    marginBottom: Spacing.xxxl,
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  logoText: {
    fontSize: 32,
    fontWeight: FontWeight.extrabold,
    color: Colors.textInverse,
  },
  appName: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.extrabold,
    color: Colors.textPrimary,
    letterSpacing: 2,
  },
  tagline: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  testSection: {
    marginBottom: Spacing.xl,
  },
  testTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
  },
  testGrid: {
    gap: Spacing.sm,
  },
  testCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  testIcon: {
    fontSize: 24,
  },
  testLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
  },
  testEmail: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
  },
  form: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xxl,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  title: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.xl,
  },
  errorBox: {
    backgroundColor: '#FEF2F2',
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: {
    fontSize: FontSize.sm,
    color: '#DC2626',
  },
  field: {
    marginBottom: Spacing.lg,
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.borderMedium,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
    backgroundColor: Colors.surface,
  },
  btn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnText: {
    color: Colors.textInverse,
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
  },
  link: {
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
  linkText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  linkBold: {
    color: Colors.primary,
    fontWeight: FontWeight.semibold,
  },
});
