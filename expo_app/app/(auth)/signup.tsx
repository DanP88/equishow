import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, FontWeight } from '../../constants/theme';
import { UserRole } from '../../types/user';
import { useAuth } from '../../hooks/useAuth';
import { signupLimiter } from '../../lib/rateLimiter';

const ROLES: { value: UserRole; label: string; desc: string }[] = [
  { value: 'cavalier', label: 'Cavalier', desc: 'Je pratique la compétition' },
  { value: 'organisateur', label: 'Organisateur', desc: "J'organise des concours" },
  { value: 'coach', label: 'Coach', desc: "J'encadre des cavaliers" },
];

export default function SignupScreen() {
  const [prenom, setPrenom] = useState('');
  const [nom, setNom] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('cavalier');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const { register, isSigningUp } = useAuth();

  async function handleSignup() {
    setErrorMsg(null);
    if (!prenom.trim() || !nom.trim() || !email.trim() || !password) {
      setErrorMsg('Veuillez remplir tous les champs.');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }

    const limitState = await signupLimiter.getState();
    if (limitState.locked) {
      const mins = Math.ceil((limitState.resetAt - Date.now()) / 60000);
      setErrorMsg(`Trop de tentatives. Réessayez dans ${mins} minute${mins > 1 ? 's' : ''}.`);
      return;
    }

    const pseudo = `${prenom.trim().toLowerCase()}.${nom.trim().toLowerCase()}`;
    const { error } = await register(email.trim(), password, {
      prenom: prenom.trim(),
      nom: nom.trim(),
      pseudo,
      role,
    });
    if (error) {
      await signupLimiter.recordFailure(email.trim());
      setErrorMsg(typeof error === 'string' ? error : 'Erreur lors de la création du compte.');
      return;
    }
    await signupLimiter.reset();
    router.replace('/(tabs)/chevaux');
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>← Retour</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Créer un compte</Text>

        <View style={styles.form}>
          {errorMsg ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          ) : null}

          <View style={styles.row}>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>Prénom</Text>
              <TextInput
                style={styles.input}
                value={prenom}
                onChangeText={setPrenom}
                placeholder="Prénom"
                placeholderTextColor={Colors.textTertiary}
                editable={!isSigningUp}
              />
            </View>
            <View style={{ width: Spacing.md }} />
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>Nom</Text>
              <TextInput
                style={styles.input}
                value={nom}
                onChangeText={setNom}
                placeholder="Nom"
                placeholderTextColor={Colors.textTertiary}
                editable={!isSigningUp}
              />
            </View>
          </View>

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
              editable={!isSigningUp}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Mot de passe</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••  (6 caractères minimum)"
              placeholderTextColor={Colors.textTertiary}
              secureTextEntry
              editable={!isSigningUp}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Je suis...</Text>
            <View style={styles.roleGroup}>
              {ROLES.map((r) => (
                <TouchableOpacity
                  key={r.value}
                  style={[styles.roleCard, role === r.value && styles.roleCardActive]}
                  onPress={() => setRole(r.value)}
                  activeOpacity={0.8}
                  disabled={isSigningUp}
                >
                  <Text style={[styles.roleLabel, role === r.value && styles.roleLabelActive]}>{r.label}</Text>
                  <Text style={[styles.roleDesc, role === r.value && styles.roleDescActive]}>{r.desc}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <TouchableOpacity
            style={[styles.btn, isSigningUp && styles.btnDisabled]}
            onPress={handleSignup}
            activeOpacity={0.85}
            disabled={isSigningUp}
          >
            {isSigningUp
              ? <ActivityIndicator color={Colors.textInverse} />
              : <Text style={styles.btnText}>Créer mon compte</Text>
            }
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  container: { flexGrow: 1, padding: Spacing.lg },
  back: { marginBottom: Spacing.lg },
  backText: { fontSize: FontSize.base, color: Colors.primary, fontWeight: FontWeight.semibold },
  title: { fontSize: FontSize.xxxl, fontWeight: FontWeight.extrabold, color: Colors.textPrimary, marginBottom: Spacing.xl },
  form: { backgroundColor: Colors.surface, borderRadius: Radius.xxl, padding: Spacing.xl, borderWidth: 1, borderColor: Colors.border },
  errorBox: {
    backgroundColor: '#FEF2F2',
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: { fontSize: FontSize.sm, color: '#DC2626' },
  row: { flexDirection: 'row' },
  field: { marginBottom: Spacing.lg },
  label: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textSecondary, marginBottom: Spacing.xs },
  input: { borderWidth: 1, borderColor: Colors.borderMedium, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2, fontSize: FontSize.base, color: Colors.textPrimary },
  roleGroup: { gap: Spacing.sm },
  roleCard: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, padding: Spacing.md, backgroundColor: Colors.surfaceVariant },
  roleCardActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  roleLabel: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  roleLabelActive: { color: Colors.primary },
  roleDesc: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  roleDescActive: { color: Colors.primaryDark },
  btn: { backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center', marginTop: Spacing.sm },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: Colors.textInverse, fontSize: FontSize.base, fontWeight: FontWeight.bold },
});
