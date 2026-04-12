import { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter, Link } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../../constants/theme';

export default function LoginScreen() {
  const router = useRouter();
  const { login, isSigningIn, error } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs');
      return;
    }

    if (!email.includes('@')) {
      Alert.alert('Erreur', 'Veuillez entrer une adresse email valide');
      return;
    }

    const { error: loginError } = await login(email, password);

    if (loginError) {
      Alert.alert('Erreur de connexion', loginError);
    } else {
      // Success - navigation is handled by auth state change
      Alert.alert('✅ Connecté!', 'Bienvenue sur Equishow');
      router.replace('/(tabs)/chevaux');
    }
  };

  return (
    <SafeAreaView style={s.root}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={s.header}>
            <Text style={s.logo}>🐴 EQUISHOW</Text>
            <Text style={s.tagline}>Plateforme équestre complète</Text>
          </View>

          {/* Form */}
          <View style={s.form}>
            {/* Email */}
            <View style={s.field}>
              <Text style={s.label}>Email</Text>
              <TextInput
                style={[s.input, email && s.inputFilled]}
                placeholder="votre@email.com"
                placeholderTextColor={Colors.textTertiary}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!isSigningIn}
              />
            </View>

            {/* Password */}
            <View style={s.field}>
              <Text style={s.label}>Mot de passe</Text>
              <View style={s.passwordContainer}>
                <TextInput
                  style={[s.input, s.passwordInput, password && s.inputFilled]}
                  placeholder="••••••••"
                  placeholderTextColor={Colors.textTertiary}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  editable={!isSigningIn}
                />
                <TouchableOpacity
                  style={s.togglePassword}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Text style={s.toggleIcon}>{showPassword ? '👁️' : '👁️‍🗨️'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Error Message */}
            {error && (
              <View style={s.errorBox}>
                <Text style={s.errorText}>❌ {error}</Text>
              </View>
            )}

            {/* Login Button */}
            <TouchableOpacity
              style={[s.loginBtn, isSigningIn && s.loginBtnDisabled]}
              onPress={handleLogin}
              disabled={isSigningIn}
              activeOpacity={0.8}
            >
              {isSigningIn ? (
                <ActivityIndicator color={Colors.textInverse} size="small" />
              ) : (
                <Text style={s.loginBtnText}>Se connecter</Text>
              )}
            </TouchableOpacity>

            {/* Forgot Password Link */}
            <TouchableOpacity>
              <Text style={s.forgotPassword}>Mot de passe oublié?</Text>
            </TouchableOpacity>
          </View>

          {/* Divider */}
          <View style={s.divider}>
            <View style={s.dividerLine} />
            <Text style={s.dividerText}>OU</Text>
            <View style={s.dividerLine} />
          </View>

          {/* Sign Up Link */}
          <View style={s.signupSection}>
            <Text style={s.signupLabel}>Pas encore inscrit?</Text>
            <Link href="/(auth)/signup" asChild>
              <TouchableOpacity activeOpacity={0.7}>
                <Text style={s.signupLink}>Créer un compte</Text>
              </TouchableOpacity>
            </Link>
          </View>

          {/* Demo Credentials */}
          <View style={s.demoBox}>
            <Text style={s.demoTitle}>📧 Compte de démo</Text>
            <Text style={s.demoText}>Email: demo@equishow.local</Text>
            <Text style={s.demoText}>Mot de passe: Demo123!</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xl,
    justifyContent: 'space-between',
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
    marginTop: Spacing.xl,
  },
  logo: {
    fontSize: FontSize.xl + 8,
    fontWeight: FontWeight.black,
    color: Colors.primary,
    marginBottom: Spacing.xs,
  },
  tagline: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  form: {
    gap: Spacing.lg,
  },
  field: {
    gap: Spacing.xs,
  },
  label: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
    backgroundColor: Colors.surface,
  },
  inputFilled: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  passwordInput: {
    flex: 1,
  },
  togglePassword: {
    position: 'absolute',
    right: Spacing.md,
    padding: Spacing.sm,
  },
  toggleIcon: {
    fontSize: 18,
  },
  errorBox: {
    backgroundColor: '#FFE5E5',
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: '#FF4444',
  },
  errorText: {
    fontSize: FontSize.sm,
    color: '#CC0000',
    fontWeight: FontWeight.semibold,
  },
  loginBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md + 4,
    alignItems: 'center',
    ...Shadow.fab,
  },
  loginBtnDisabled: {
    opacity: 0.6,
  },
  loginBtnText: {
    color: Colors.textInverse,
    fontWeight: FontWeight.extrabold,
    fontSize: FontSize.base,
  },
  forgotPassword: {
    textAlign: 'center',
    color: Colors.primary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Spacing.xl,
    gap: Spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    fontWeight: FontWeight.semibold,
  },
  signupSection: {
    alignItems: 'center',
    gap: Spacing.sm,
  },
  signupLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  signupLink: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: FontWeight.extrabold,
  },
  demoBox: {
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
    marginTop: Spacing.lg,
  },
  demoTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
    marginBottom: Spacing.xs,
  },
  demoText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontFamily: 'Courier New',
  },
});
