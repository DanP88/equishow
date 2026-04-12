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
  FlatList,
  Modal,
} from 'react-native';
import { useRouter, Link } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../../constants/theme';

type UserRole = 'cavalier' | 'coach' | 'organisateur';

export default function SignupScreen() {
  const router = useRouter();
  const { register, isSigningUp } = useAuth();

  const [prenom, setPrenom] = useState('');
  const [nom, setNom] = useState('');
  const [pseudo, setPseudo] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<UserRole>('cavalier');
  const [showPassword, setShowPassword] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);

  const roles: { id: UserRole; label: string; emoji: string; desc: string }[] = [
    { id: 'cavalier', label: 'Cavalier', emoji: '🐴', desc: 'Gérer mes chevaux et participer aux concours' },
    { id: 'coach', label: 'Coach', emoji: '🎓', desc: 'Proposer des séances de coaching' },
    { id: 'organisateur', label: 'Organisateur', emoji: '🏆', desc: 'Organiser des concours' },
  ];

  const handleSignup = async () => {
    // Validation
    if (!prenom.trim() || !nom.trim() || !email.trim() || !password.trim()) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Erreur', 'Les mots de passe ne correspondent pas');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Erreur', 'Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    if (!email.includes('@')) {
      Alert.alert('Erreur', 'Veuillez entrer une adresse email valide');
      return;
    }

    // Register
    const { user, error } = await register(email, password, {
      prenom: prenom.trim(),
      nom: nom.trim(),
      pseudo: pseudo.trim() || prenom.trim(),
      role,
    });

    if (error) {
      Alert.alert('Erreur d\'inscription', error);
    } else if (user) {
      Alert.alert(
        '✅ Inscription réussie!',
        'Bienvenue sur Equishow. Connectez-vous maintenant.'
      );
      router.replace('/(auth)/login');
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
            <Text style={s.tagline}>Rejoignez la communauté</Text>
          </View>

          {/* Form */}
          <View style={s.form}>
            {/* Name Fields */}
            <View style={s.nameRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>Prénom</Text>
                <TextInput
                  style={[s.input, prenom && s.inputFilled]}
                  placeholder="John"
                  placeholderTextColor={Colors.textTertiary}
                  value={prenom}
                  onChangeText={setPrenom}
                  editable={!isSigningUp}
                />
              </View>
              <View style={{ width: Spacing.md }} />
              <View style={{ flex: 1 }}>
                <Text style={s.label}>Nom</Text>
                <TextInput
                  style={[s.input, nom && s.inputFilled]}
                  placeholder="Doe"
                  placeholderTextColor={Colors.textTertiary}
                  value={nom}
                  onChangeText={setNom}
                  editable={!isSigningUp}
                />
              </View>
            </View>

            {/* Pseudo */}
            <View style={s.field}>
              <Text style={s.label}>Pseudo (optionnel)</Text>
              <TextInput
                style={[s.input, pseudo && s.inputFilled]}
                placeholder="JohnDoe_Equestre"
                placeholderTextColor={Colors.textTertiary}
                value={pseudo}
                onChangeText={setPseudo}
                editable={!isSigningUp}
              />
            </View>

            {/* Role Selection */}
            <View style={s.field}>
              <Text style={s.label}>Je suis...</Text>
              <TouchableOpacity
                style={s.roleSelector}
                onPress={() => setShowRoleModal(true)}
              >
                <Text style={s.roleSelectorText}>
                  {roles.find(r => r.id === role)?.emoji} {roles.find(r => r.id === role)?.label}
                </Text>
                <Text style={s.roleArrow}>▼</Text>
              </TouchableOpacity>
            </View>

            {/* Role Modal */}
            <Modal visible={showRoleModal} transparent animationType="fade">
              <TouchableOpacity
                style={s.backdrop}
                activeOpacity={1}
                onPress={() => setShowRoleModal(false)}
              >
                <TouchableOpacity activeOpacity={1} style={s.roleModal}>
                  <Text style={s.modalTitle}>Choisir votre rôle</Text>
                  {roles.map((r) => (
                    <TouchableOpacity
                      key={r.id}
                      style={[s.roleOption, role === r.id && s.roleOptionActive]}
                      onPress={() => {
                        setRole(r.id);
                        setShowRoleModal(false);
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[s.roleOptionLabel, role === r.id && s.roleOptionLabelActive]}>
                          {r.emoji} {r.label}
                        </Text>
                        <Text style={s.roleOptionDesc}>{r.desc}</Text>
                      </View>
                      {role === r.id && <Text style={s.roleCheck}>✓</Text>}
                    </TouchableOpacity>
                  ))}
                </TouchableOpacity>
              </TouchableOpacity>
            </Modal>

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
                editable={!isSigningUp}
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
                  editable={!isSigningUp}
                />
                <TouchableOpacity
                  style={s.togglePassword}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Text style={s.toggleIcon}>{showPassword ? '👁️' : '👁️‍🗨️'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Confirm Password */}
            <View style={s.field}>
              <Text style={s.label}>Confirmer mot de passe</Text>
              <TextInput
                style={[s.input, confirmPassword && s.inputFilled]}
                placeholder="••••••••"
                placeholderTextColor={Colors.textTertiary}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showPassword}
                editable={!isSigningUp}
              />
            </View>

            {/* Terms */}
            <View style={s.termsBox}>
              <Text style={s.termsText}>
                En créant un compte, j'accepte les{' '}
                <Text style={s.termsLink}>conditions d'utilisation</Text> et la{' '}
                <Text style={s.termsLink}>politique de confidentialité</Text>
              </Text>
            </View>

            {/* Sign Up Button */}
            <TouchableOpacity
              style={[s.signupBtn, isSigningUp && s.signupBtnDisabled]}
              onPress={handleSignup}
              disabled={isSigningUp}
              activeOpacity={0.8}
            >
              {isSigningUp ? (
                <ActivityIndicator color={Colors.textInverse} size="small" />
              ) : (
                <Text style={s.signupBtnText}>Créer un compte</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Login Link */}
          <View style={s.loginSection}>
            <Text style={s.loginLabel}>Vous avez déjà un compte?</Text>
            <Link href="/(auth)/login" asChild>
              <TouchableOpacity activeOpacity={0.7}>
                <Text style={s.loginLink}>Se connecter</Text>
              </TouchableOpacity>
            </Link>
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
    paddingVertical: Spacing.lg,
    justifyContent: 'space-between',
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
    marginTop: Spacing.md,
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
  nameRow: {
    flexDirection: 'row',
    gap: Spacing.md,
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
  roleSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
  },
  roleSelectorText: {
    flex: 1,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
    fontWeight: FontWeight.semibold,
  },
  roleArrow: {
    fontSize: 12,
    color: Colors.textTertiary,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
  },
  roleModal: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    width: '100%',
    ...Shadow.card,
  },
  modalTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  roleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.sm,
    backgroundColor: Colors.background,
  },
  roleOptionActive: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primary,
  },
  roleOptionLabel: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
  },
  roleOptionLabelActive: {
    color: Colors.primary,
  },
  roleOptionDesc: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    marginTop: Spacing.xs,
  },
  roleCheck: {
    fontSize: FontSize.lg,
    color: Colors.primary,
    fontWeight: FontWeight.bold,
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
  termsBox: {
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
  },
  termsText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  termsLink: {
    color: Colors.primary,
    fontWeight: FontWeight.bold,
  },
  signupBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md + 4,
    alignItems: 'center',
    ...Shadow.fab,
  },
  signupBtnDisabled: {
    opacity: 0.6,
  },
  signupBtnText: {
    color: Colors.textInverse,
    fontWeight: FontWeight.extrabold,
    fontSize: FontSize.base,
  },
  loginSection: {
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  loginLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  loginLink: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: FontWeight.extrabold,
  },
});
