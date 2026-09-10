import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Image,
  StyleSheet, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Spacing, Radius, FontSize, FontWeight } from '../../constants/theme';
import { useAuth } from '../../hooks/useAuth';
import { TEST_ACCOUNTS } from '../../data/mockUsers';
import { userStore } from '../../data/store';
import { loginLimiter } from '../../lib/rateLimiter';
import { V2_ENABLED, V2_FLAGS } from '../../v2/flags';
import { BL, FONT, injectBlushFonts } from '../../v2/ui/blush';

// V2 (prototype) activée → après connexion on entre dans la nouvelle navigation.
const V2_NAV = V2_ENABLED && V2_FLAGS.navigation;

// Même identité visuelle que l'appli V2 (thème Blush). No-op sur natif.
injectBlushFonts();

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
    if (V2_NAV) { router.replace('/(v2)/accueil' as any); return; }
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
    if (V2_NAV) { router.replace('/(v2)/accueil' as any); return; }
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
            <Image
              source={require('../../assets/logo-equishow.png')}
              style={styles.logoImg}
              resizeMode="cover"
            />
          </View>
          <Text style={styles.appName}>EQUISHOW</Text>
          <Text style={styles.tagline}>La plateforme des cavaliers</Text>
        </View>

        {/* V2 (prototype) — entrée directe sans compte, build de dev uniquement */}
        {__DEV__ && V2_NAV && (
          <TouchableOpacity
            style={styles.v2Btn}
            onPress={() => router.replace('/(v2)/accueil' as any)}
            activeOpacity={0.85}
          >
            <Text style={styles.v2BtnText}>▶  Tester la V2 (sans compte)</Text>
            <Text style={styles.v2BtnSub}>nouvelle navigation F2 · panneau capacités : /v2-dev</Text>
          </TouchableOpacity>
        )}

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
              placeholderTextColor={BL.faint}
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
              placeholderTextColor={BL.faint}
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
              ? <ActivityIndicator color={BL.accentInk} />
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

// ── Identité visuelle = thème Blush de l'appli V2 (v2/ui/blush) ──────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BL.bg,
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
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: BL.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: BL.accentLine,
  },
  logoImg: {
    // Remplit tout le cercle (resizeMode cover clippé par overflow hidden)
    width: 96,
    height: 96,
  },
  logoText: {
    fontFamily: FONT.head,
    fontSize: 32,
    fontWeight: FontWeight.extrabold,
    color: BL.accentInk,
  },
  appName: {
    fontFamily: FONT.head,
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: BL.ink,
    letterSpacing: 2,
  },
  tagline: {
    fontFamily: FONT.body,
    fontSize: FontSize.sm,
    color: BL.sub,
    marginTop: 4,
  },
  v2Btn: {
    backgroundColor: BL.accent,
    borderRadius: BL.radiusTile,
    padding: Spacing.md,
    alignItems: 'center',
    marginBottom: Spacing.lg,
    gap: 2,
  },
  v2BtnText: {
    fontFamily: FONT.body,
    color: BL.accentInk,
    fontSize: FontSize.base,
    fontWeight: '800',
  },
  v2BtnSub: {
    fontFamily: FONT.body,
    color: BL.accentInk,
    fontSize: FontSize.xs,
    opacity: 0.9,
  },
  testSection: {
    marginBottom: Spacing.xl,
  },
  testTitle: {
    fontFamily: FONT.body,
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: BL.sub,
    marginBottom: Spacing.md,
  },
  testGrid: {
    gap: Spacing.sm,
  },
  testCard: {
    backgroundColor: BL.card,
    borderRadius: BL.radiusTile,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: BL.line,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  testIcon: {
    fontSize: 24,
  },
  testLabel: {
    fontFamily: FONT.body,
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: BL.ink,
  },
  testEmail: {
    fontFamily: FONT.body,
    fontSize: FontSize.xs,
    color: BL.faint,
  },
  form: {
    backgroundColor: BL.card,
    borderRadius: BL.radius,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: BL.line,
  },
  title: {
    fontFamily: FONT.head,
    fontSize: FontSize.xxl,
    fontWeight: '700',
    color: BL.ink,
    marginBottom: Spacing.xl,
  },
  errorBox: {
    backgroundColor: BL.accentSoft,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: BL.accentLine,
  },
  errorText: {
    fontFamily: FONT.body,
    fontSize: FontSize.sm,
    color: BL.berry,
  },
  field: {
    marginBottom: Spacing.lg,
  },
  label: {
    fontFamily: FONT.body,
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: BL.sub,
    marginBottom: Spacing.xs,
  },
  input: {
    fontFamily: FONT.body,
    borderWidth: 1,
    borderColor: BL.accentLine,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    fontSize: FontSize.base,
    color: BL.ink,
    backgroundColor: BL.card,
  },
  btn: {
    backgroundColor: BL.accent,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnText: {
    fontFamily: FONT.body,
    color: BL.accentInk,
    fontSize: FontSize.base,
    fontWeight: '800',
  },
  link: {
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
  linkText: {
    fontFamily: FONT.body,
    fontSize: FontSize.sm,
    color: BL.sub,
  },
  linkBold: {
    color: BL.accent,
    fontWeight: '700',
  },
});
