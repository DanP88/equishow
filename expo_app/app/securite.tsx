import { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView, TextInput, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../constants/theme';

export default function SecuriteScreen() {
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  function changePassword() {
    if (!currentPwd || !newPwd || !confirmPwd) {
      Alert.alert('Champs manquants', 'Veuillez remplir tous les champs.');
      return;
    }
    if (newPwd !== confirmPwd) {
      Alert.alert('Erreur', 'Les nouveaux mots de passe ne correspondent pas.');
      return;
    }
    if (newPwd.length < 8) {
      Alert.alert('Mot de passe trop court', 'Minimum 8 caractères requis.');
      return;
    }
    Alert.alert('Succès', 'Mot de passe modifié avec succès.', [{ text: 'OK', onPress: () => router.back() }]);
  }

  function deleteAccount() {
    Alert.alert(
      'Supprimer mon compte',
      'Cette action est irréversible. Toutes vos données seront supprimées définitivement.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer', style: 'destructive', onPress: () => router.replace('/(auth)/login') },
      ],
    );
  }

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Text style={s.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Sécurité</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.container}>
        {/* Email info */}
        <View style={s.emailCard}>
          <Text style={s.emailIcon}>📧</Text>
          <View>
            <Text style={s.emailLabel}>Compte connecté</Text>
            <Text style={s.emailValue}>sarah.lefebvre@email.fr</Text>
          </View>
          <View style={s.verifiedBadge}>
            <Text style={s.verifiedText}>✓ Vérifié</Text>
          </View>
        </View>

        {/* Changer mot de passe */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Changer le mot de passe</Text>
          <View style={s.sectionCard}>
            <Field
              label="Mot de passe actuel"
              value={currentPwd}
              onChangeText={setCurrentPwd}
              secure={!showCurrent}
              toggle={() => setShowCurrent(!showCurrent)}
              showToggle={showCurrent}
            />
            <View style={s.divider} />
            <Field
              label="Nouveau mot de passe"
              value={newPwd}
              onChangeText={setNewPwd}
              secure={!showNew}
              toggle={() => setShowNew(!showNew)}
              showToggle={showNew}
              hint="8 caractères minimum"
            />
            <View style={s.divider} />
            <Field
              label="Confirmer le nouveau mot de passe"
              value={confirmPwd}
              onChangeText={setConfirmPwd}
              secure
            />
          </View>
          <TouchableOpacity style={s.saveBtn} onPress={changePassword} activeOpacity={0.85}>
            <Text style={s.saveBtnText}>Enregistrer le nouveau mot de passe</Text>
          </TouchableOpacity>
        </View>

        {/* Sécurité du compte */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Sécurité du compte</Text>
          <View style={s.sectionCard}>
            <InfoRow icon="🔒" label="Authentification 2FA" value="Non activée" actionLabel="Activer" onAction={() => Alert.alert('Bientôt disponible', 'La double authentification sera disponible prochainement.')} />
            <View style={s.divider} />
            <InfoRow icon="📱" label="Appareils connectés" value="1 appareil" actionLabel="Gérer" onAction={() => Alert.alert('Appareils', 'Aucun autre appareil connecté à votre compte.')} />
            <View style={s.divider} />
            <InfoRow icon="🕐" label="Dernière connexion" value="Aujourd'hui, 08h42" />
          </View>
        </View>

        {/* Zone dangereuse */}
        <TouchableOpacity style={s.deleteBtn} onPress={deleteAccount} activeOpacity={0.85}>
          <Text style={s.deleteBtnText}>🗑 Supprimer mon compte</Text>
        </TouchableOpacity>
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({ label, value, onChangeText, secure, toggle, showToggle, hint }: {
  label: string; value: string; onChangeText?: (v: string) => void;
  secure?: boolean; toggle?: () => void; showToggle?: boolean; hint?: string;
}) {
  return (
    <View style={s.fieldWrap}>
      <Text style={s.fieldLabel}>{label}</Text>
      <View style={s.fieldRow}>
        <TextInput
          style={s.fieldInput}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secure}
          placeholder="••••••••"
          placeholderTextColor={Colors.textTertiary}
          autoCapitalize="none"
        />
        {toggle && (
          <TouchableOpacity style={s.eyeBtn} onPress={toggle}>
            <Text style={s.eyeIcon}>{showToggle ? '🙈' : '👁'}</Text>
          </TouchableOpacity>
        )}
      </View>
      {hint && <Text style={s.fieldHint}>{hint}</Text>}
    </View>
  );
}

function InfoRow({ icon, label, value, actionLabel, onAction }: {
  icon: string; label: string; value: string; actionLabel?: string; onAction?: () => void;
}) {
  return (
    <View style={s.infoRow}>
      <Text style={s.infoIcon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={s.infoLabel}>{label}</Text>
        <Text style={s.infoValue}>{value}</Text>
      </View>
      {actionLabel && onAction && (
        <TouchableOpacity style={s.infoAction} onPress={onAction}>
          <Text style={s.infoActionText}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.surface },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surfaceVariant, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 24, color: Colors.textPrimary, lineHeight: 28 },
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  container: { padding: Spacing.lg, gap: Spacing.xl },
  emailCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border },
  emailIcon: { fontSize: 24 },
  emailLabel: { fontSize: FontSize.xs, color: Colors.textTertiary },
  emailValue: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  verifiedBadge: { marginLeft: 'auto', backgroundColor: Colors.successBg, borderRadius: Radius.xs, paddingHorizontal: Spacing.sm, paddingVertical: 2, borderWidth: 1, borderColor: Colors.successBorder },
  verifiedText: { fontSize: FontSize.xs, color: Colors.success, fontWeight: FontWeight.bold },
  section: { gap: Spacing.sm },
  sectionTitle: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.8, paddingHorizontal: Spacing.xs },
  sectionCard: { backgroundColor: Colors.surface, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.border, padding: Spacing.lg },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.md },
  fieldWrap: { gap: Spacing.xs },
  fieldLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, backgroundColor: Colors.surfaceVariant, overflow: 'hidden' },
  fieldInput: { flex: 1, padding: Spacing.md, fontSize: FontSize.base, color: Colors.textPrimary },
  eyeBtn: { padding: Spacing.md },
  eyeIcon: { fontSize: 16 },
  fieldHint: { fontSize: FontSize.xs, color: Colors.textTertiary },
  saveBtn: { backgroundColor: Colors.primary, borderRadius: Radius.lg, paddingVertical: Spacing.md + 2, alignItems: 'center' },
  saveBtnText: { color: Colors.textInverse, fontWeight: FontWeight.bold, fontSize: FontSize.base },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  infoIcon: { fontSize: 20, width: 28 },
  infoLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  infoValue: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  infoAction: { backgroundColor: Colors.surfaceVariant, borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderWidth: 1, borderColor: Colors.border },
  infoActionText: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.semibold },
  deleteBtn: { borderWidth: 1, borderColor: Colors.urgentBorder, borderRadius: Radius.lg, paddingVertical: Spacing.md + 2, alignItems: 'center', backgroundColor: Colors.urgentBg },
  deleteBtnText: { color: Colors.urgent, fontWeight: FontWeight.bold, fontSize: FontSize.base },
});
