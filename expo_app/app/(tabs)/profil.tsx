import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView,
  Modal, TextInput, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, CommonStyles, Shadow } from '../../constants/theme';
import { userStore } from '../../data/store';
import { PhotoAvatar } from '../../components/PhotoAvatar';
import { AvisSection } from '../../components/AvisSection';
import { useAuth } from '../../hooks/useAuth';
import { TEST_ACCOUNTS } from '../../data/mockUsers';

const ROLE_LABELS: Record<string, string> = {
  cavalier: 'Cavalier',
  coach: 'Coach',
  organisateur: 'Organisateur',
};

const ROLE_ICONS: Record<string, string> = {
  cavalier: '🏇',
  coach: '🎓',
  organisateur: '🏟️',
};

export default function ProfilScreen() {
  const { profile } = useAuth();
  const [user, setUser] = useState({ ...userStore });
  const [showEdit, setShowEdit] = useState(false);
  const [draft, setDraft] = useState({ ...userStore });

  useEffect(() => {
    const unsubscribe = userStore.onRoleChange(() => {
      setUser({ ...userStore });
      setDraft({ ...userStore });
    });
    return unsubscribe;
  }, []);

  function saveEdit() {
    Object.assign(userStore, draft);
    setUser({ ...userStore });
    setShowEdit(false);
  }

  function openEdit() {
    setDraft({ ...user });
    setShowEdit(true);
  }

  const nbChevaux = 3;
  const nbConcours = 8;

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Hero */}
        <View style={styles.heroSection}>
          <PhotoAvatar
            color={user.avatarColor}
            emoji="🏇"
            size={88}
            onEdit={(color) => {
              userStore.avatarColor = color;
              setUser({ ...userStore });
            }}
          />
          <Text style={styles.name}>{user.prenom} {user.nom}</Text>
          <Text style={styles.pseudo}>@{user.pseudo}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleIcon}>{ROLE_ICONS[user.role]}</Text>
            <Text style={styles.roleText}>{ROLE_LABELS[user.role]}</Text>
          </View>
          <View style={styles.planBadge}>
            <Text style={styles.planText}>🌟 Plan {user.plan}</Text>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => router.push('/(tabs)/chevaux')}>
            <StatBox label="Chevaux" value={nbChevaux} icon="🐴" />
          </TouchableOpacity>
          <View style={styles.statsDivider} />
          <TouchableOpacity style={{ flex: 1 }} onPress={() => router.push('/(tabs)/concours')}>
            <StatBox label="Concours" value={nbConcours} icon="🏆" />
          </TouchableOpacity>
          <View style={styles.statsDivider} />
          <TouchableOpacity style={{ flex: 1 }} onPress={() => router.push('/(tabs)/profil#reviews')}>
            <StatBox label="Avis" value={0} icon="⭐" />
          </TouchableOpacity>
        </View>

        {/* Bio */}
        {user.bio ? (
          <View style={[styles.section, { padding: Spacing.lg }]}>
            <Text style={styles.bioText}>{user.bio}</Text>
          </View>
        ) : null}

        {/* Avis Section */}
        {profile && <AvisSection userId={profile.id} />}

        {/* Infos */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informations</Text>
          <InfoRow label="Email" value={user.email} />
          <InfoRow label="Région" value={user.region} />
          <InfoRow label="Disciplines" value={user.disciplines.join(', ')} />
        </View>

        {/* Compte */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Mon compte</Text>
          <MenuButton icon="✏️" label="Modifier mon profil" onPress={openEdit} />
          <MenuButton
            icon={ROLE_ICONS[user.role]}
            label="Changer de type de compte"
            sublabel={ROLE_LABELS[user.role]}
            onPress={() => router.push('/compte-type')}
          />
          <MenuButton icon="🔔" label="Notifications" onPress={() => router.push('/notifications')} />
          <MenuButton icon="🔒" label="Sécurité" onPress={() => router.push('/securite')} />
          <MenuButton icon="💳" label="Abonnement" onPress={() => router.push('/tarification')} color={Colors.gold} />
        </View>

        {/* Test Accounts */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📧 Comptes de test</Text>
          {TEST_ACCOUNTS.map((account, idx) => (
            <TestAccountItem key={idx} account={account} />
          ))}
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={() => router.replace('/(auth)/login')}>
          <Text style={styles.logoutText}>Se déconnecter</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Edit Modal */}
      <Modal visible={showEdit} transparent animationType="slide">
        <View style={styles.editBackdrop}>
          <View style={styles.editSheet}>
            <Text style={styles.editTitle}>Modifier mon profil</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Field label="Prénom" value={draft.prenom} onChangeText={(v) => setDraft({ ...draft, prenom: v })} />
              <Field label="Nom" value={draft.nom} onChangeText={(v) => setDraft({ ...draft, nom: v })} />
              <Field
                label="Pseudo (visible publiquement)"
                value={draft.pseudo}
                onChangeText={(v) => setDraft({ ...draft, pseudo: v })}
                placeholder="ex: SarahL_CSO"
              />
              <Field label="Email" value={draft.email} onChangeText={(v) => setDraft({ ...draft, email: v })} />
              <Field label="Région" value={draft.region} onChangeText={(v) => setDraft({ ...draft, region: v })} />
              <Field
                label="Bio"
                value={draft.bio}
                onChangeText={(v) => setDraft({ ...draft, bio: v })}
                multiline
                placeholder="Décrivez-vous en quelques mots..."
              />
            </ScrollView>
            <View style={styles.editActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowEdit(false)}>
                <Text style={styles.cancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={saveEdit}>
                <Text style={styles.confirmText}>Enregistrer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function TestAccountItem({ account }: { account: any }) {
  const handleCopy = (text: string) => {
    Alert.alert('Copié', `${text} a été copié`);
  };

  const handleSwitchAccount = () => {
    const success = userStore.switchAccount(account.accountKey);
    if (success) {
      Alert.alert('✓ Compte changé', `Vous êtes maintenant connecté en tant que ${account.label}`);
      // Force a refresh of the navigation to update all screens
      router.replace('/(tabs)/profil');
    } else {
      Alert.alert('Erreur', 'Impossible de changer de compte');
    }
  };

  return (
    <TouchableOpacity
      style={styles.testAccountItem}
      onPress={handleSwitchAccount}
      activeOpacity={0.7}
    >
      <View style={styles.testAccountHeader}>
        <Text style={styles.testAccountEmoji}>{account.icon}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.testAccountName}>{account.label}</Text>
          {account.description && (
            <Text style={styles.testAccountDescription}>{account.description}</Text>
          )}
        </View>
        <Text style={styles.testAccountArrow}>›</Text>
      </View>
      <TouchableOpacity
        style={styles.testAccountEmail}
        onPress={(e) => {
          e.stopPropagation();
          handleCopy(account.email);
        }}
      >
        <Text style={styles.testAccountEmailText}>{account.email}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.testAccountPassword}
        onPress={(e) => {
          e.stopPropagation();
          handleCopy(account.password);
        }}
      >
        <Text style={styles.testAccountPasswordText}>Mot de passe: {account.password}</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

function StatBox({ label, value, icon }: { label: string; value: number; icon: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function MenuButton({ icon, label, sublabel, onPress, color = Colors.textPrimary }: {
  icon: string; label: string; sublabel?: string; onPress: () => void; color?: string;
}) {
  return (
    <TouchableOpacity style={styles.menuBtn} onPress={onPress} activeOpacity={0.7}>
      <Text style={styles.menuIcon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={[styles.menuLabel, { color }]}>{label}</Text>
        {sublabel && <Text style={styles.menuSublabel}>{sublabel}</Text>}
      </View>
      <Text style={styles.menuArrow}>›</Text>
    </TouchableOpacity>
  );
}

function Field({ label, value, onChangeText, placeholder, multiline }: {
  label: string; value: string; onChangeText: (v: string) => void;
  placeholder?: string; multiline?: boolean;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.fieldInput, multiline && styles.fieldMultiline]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder ?? label}
        placeholderTextColor={Colors.textTertiary}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  container: { padding: Spacing.lg, paddingBottom: 100 },

  heroSection: { alignItems: 'center', marginBottom: Spacing.xl, gap: Spacing.xs },
  name: { fontSize: FontSize.xxl, fontWeight: FontWeight.extrabold, color: Colors.textPrimary, marginTop: Spacing.sm },
  pseudo: { fontSize: FontSize.base, color: Colors.primary, fontWeight: FontWeight.semibold },
  roleBadge: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, backgroundColor: Colors.surfaceVariant, borderRadius: 20, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderWidth: 1, borderColor: Colors.border },
  roleIcon: { fontSize: 14 },
  roleText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.semibold },
  planBadge: { backgroundColor: Colors.goldBg, borderRadius: Radius.xs, paddingHorizontal: Spacing.sm, paddingVertical: 2, borderWidth: 1, borderColor: Colors.goldBorder },
  planText: { fontSize: FontSize.sm, color: Colors.gold, fontWeight: FontWeight.semibold },

  statsRow: { ...CommonStyles.card, flexDirection: 'row', marginBottom: Spacing.lg },
  statBox: { flex: 1, alignItems: 'center', paddingVertical: Spacing.lg, gap: 2 },
  statIcon: { fontSize: 18 },
  statsDivider: { width: 1, backgroundColor: Colors.border },
  statValue: { fontSize: FontSize.xxl, fontWeight: FontWeight.extrabold, color: Colors.primary },
  statLabel: { fontSize: FontSize.xs, color: Colors.textSecondary },

  bioText: { fontSize: FontSize.base, color: Colors.textSecondary, lineHeight: 22 },

  section: { ...CommonStyles.card, marginBottom: Spacing.lg, overflow: 'hidden' },
  sectionTitle: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.8, padding: Spacing.lg, paddingBottom: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border },
  infoLabel: { fontSize: FontSize.base, color: Colors.textSecondary },
  infoValue: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary, flex: 1, textAlign: 'right' },
  menuBtn: { flexDirection: 'row', alignItems: 'center', padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: Spacing.md },
  menuIcon: { fontSize: 18, width: 24 },
  menuLabel: { fontSize: FontSize.base, fontWeight: FontWeight.medium },
  menuSublabel: { fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: 1 },
  menuArrow: { fontSize: FontSize.xl, color: Colors.textTertiary },

  logoutBtn: { borderWidth: 1, borderColor: Colors.urgentBorder, borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center', backgroundColor: Colors.urgentBg },
  logoutText: { color: Colors.urgent, fontWeight: FontWeight.semibold },

  // Edit modal
  editBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  editSheet: { backgroundColor: Colors.surface, borderTopLeftRadius: Radius.xxl, borderTopRightRadius: Radius.xxl, padding: Spacing.xl, paddingBottom: 40, maxHeight: '90%' },
  editTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.extrabold, color: Colors.textPrimary, textAlign: 'center', marginBottom: Spacing.xl },
  fieldWrap: { marginBottom: Spacing.md },
  fieldLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: Spacing.xs },
  fieldInput: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, padding: Spacing.md, fontSize: FontSize.base, color: Colors.textPrimary, backgroundColor: Colors.surfaceVariant },
  fieldMultiline: { height: 80, textAlignVertical: 'top' },
  editActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.lg },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: Colors.borderMedium, borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center' },
  cancelText: { color: Colors.textSecondary, fontWeight: FontWeight.semibold },
  confirmBtn: { flex: 1, backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center' },
  confirmText: { color: Colors.textInverse, fontWeight: FontWeight.bold },

  // Test accounts
  testAccountItem: { padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border },
  testAccountHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.sm, justifyContent: 'space-between' },
  testAccountEmoji: { fontSize: 20 },
  testAccountName: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  testAccountDescription: { fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: 2 },
  testAccountArrow: { fontSize: FontSize.lg, color: Colors.primary, fontWeight: FontWeight.semibold },
  testAccountEmail: { backgroundColor: Colors.surfaceVariant, borderRadius: Radius.sm, padding: Spacing.sm, marginBottom: Spacing.xs },
  testAccountEmailText: { fontSize: FontSize.xs, color: Colors.textSecondary, fontFamily: 'Courier New' },
  testAccountPassword: { backgroundColor: Colors.surfaceVariant, borderRadius: Radius.sm, padding: Spacing.sm },
  testAccountPasswordText: { fontSize: FontSize.xs, color: Colors.textSecondary, fontFamily: 'Courier New' },
});
