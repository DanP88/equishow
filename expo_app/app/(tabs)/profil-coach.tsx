import { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, SafeAreaView, TouchableOpacity, Modal, TextInput } from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../../constants/theme';
import { userStore, getFollowers, getFollowing } from '../../data/store';
import { useAvisStats } from '../../hooks/useAvis';
import { PhotoAvatar } from '../../components/PhotoAvatar';
import { AvisSection } from '../../components/AvisSection';
import { FollowListModal } from '../../components/FollowListModal';
import { useAuth } from '../../hooks/useAuth';

const ROLE_LABELS: Record<string, string> = {
  coach: 'Coach',
};

const ROLE_ICONS: Record<string, string> = {
  coach: '🎓',
};

export default function ProfilCoachScreen() {
  const { logout } = useAuth();
  async function handleLogout() {
    await logout();
    router.replace('/(auth)/login');
  }
  const [user, setUser] = useState({ ...userStore });
  const [showEdit, setShowEdit] = useState(false);
  const [draft, setDraft] = useState({ ...userStore });
  const [followModal, setFollowModal] = useState<'followers' | 'following' | null>(null);
  const { count: nbAvis } = useAvisStats(userStore.id);
  const nbFollowers = getFollowers(userStore.id).length;
  const nbFollowing = getFollowing(userStore.id).length;

  function saveEdit() {
    Object.assign(userStore, draft);
    setUser({ ...userStore });
    setShowEdit(false);
  }

  function openEdit() {
    setDraft({ ...user });
    setShowEdit(true);
  }

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Hero */}
        <View style={styles.heroSection}>
          <PhotoAvatar
            color={user.avatarColor}
            emoji="🎓"
            size={88}
          />
          <Text style={styles.name}>{user.prenom} {user.nom}</Text>
          <View style={styles.ratingRow}>
            <Text style={styles.stars}>★★★★★</Text>
            <Text style={styles.rating}>4.9 (47 avis)</Text>
          </View>
          <View style={styles.roleBadge}>
            <Text style={styles.roleIcon}>{ROLE_ICONS[user.role]}</Text>
            <Text style={styles.roleText}>{ROLE_LABELS[user.role]}</Text>
          </View>
          <View style={styles.planBadge}>
            <Text style={styles.planText}>🌟 Plan {user.plan}</Text>
          </View>
        </View>

        {/* Followers */}
        <View style={styles.followRow}>
          <TouchableOpacity style={styles.followItem} onPress={() => setFollowModal('followers')}>
            <Text style={styles.followNum}>{nbFollowers}</Text>
            <Text style={styles.followLabel}>Abonnés</Text>
          </TouchableOpacity>
          <View style={styles.statsDivider} />
          <TouchableOpacity style={styles.followItem} onPress={() => setFollowModal('following')}>
            <Text style={styles.followNum}>{nbFollowing}</Text>
            <Text style={styles.followLabel}>Abonnements</Text>
          </TouchableOpacity>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => router.push('/(tabs)/coach-students?tab=coaching')}>
            <StatBox label="Élèves en coaching" value={5} icon="🐴" />
          </TouchableOpacity>
          <View style={styles.statsDivider} />
          <TouchableOpacity style={{ flex: 1 }} onPress={() => router.push('/(tabs)/coach-students?tab=past')}>
            <StatBox label="Élèves passé" value={12} icon="✓" />
          </TouchableOpacity>
          <View style={styles.statsDivider} />
          <TouchableOpacity style={{ flex: 1 }} onPress={() => router.push('/(tabs)/profil-coach#avis')}>
            <StatBox label="Avis" value={nbAvis} icon="⭐" />
          </TouchableOpacity>
        </View>

        {/* Avis Section */}
        <AvisSection userId={userStore.id} />

        {/* Infos */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informations</Text>
          <InfoRow label="Email" value={user.email} />
          <InfoRow label="Région" value={user.region} />
          <InfoRow label="Disciplines" value={user.disciplines.join(', ')} />
          <InfoRow label="Tarif horaire" value="65€ HT" />
        </View>

        {/* Edit Button */}
        <TouchableOpacity
          style={styles.editButton}
          onPress={openEdit}
          activeOpacity={0.8}
        >
          <Text style={styles.editText}>✏️ Modifier mon profil</Text>
        </TouchableOpacity>

        {/* Mon compte */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Mon compte</Text>
          <TouchableOpacity style={styles.menuBtn} onPress={() => router.push('/compte-type')} activeOpacity={0.7}>
            <Text style={styles.menuIcon}>🐴</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.menuLabel}>Changer de type de compte</Text>
              <Text style={styles.menuSub}>Actuellement : Coach</Text>
            </View>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Support */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support & Aide</Text>
          <TouchableOpacity style={styles.menuBtn} onPress={() => router.push('/support?tab=faq' as any)} activeOpacity={0.7}>
            <Text style={styles.menuIcon}>❓</Text>
            <Text style={styles.menuLabel}>FAQ</Text>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuBtn} onPress={() => router.push('/support?tab=legal' as any)} activeOpacity={0.7}>
            <Text style={styles.menuIcon}>📄</Text>
            <Text style={styles.menuLabel}>Mentions légales</Text>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuBtn} onPress={() => router.push('/support?tab=contact' as any)} activeOpacity={0.7}>
            <Text style={styles.menuIcon}>📧</Text>
            <Text style={styles.menuLabel}>Nous contacter</Text>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuBtn} onPress={() => router.push('/support?tab=reclamation' as any)} activeOpacity={0.7}>
            <Text style={styles.menuIcon}>🚨</Text>
            <Text style={[styles.menuLabel, { color: '#DC2626' }]}>Faire une réclamation</Text>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Logout Button */}
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <Text style={styles.logoutText}>🚪 Se déconnecter</Text>
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
              <Field label="Email" value={draft.email} onChangeText={(v) => setDraft({ ...draft, email: v })} />
              <Field label="Région" value={draft.region} onChangeText={(v) => setDraft({ ...draft, region: v })} />
              <Field label="Disciplines" value={draft.disciplines.join(', ')} onChangeText={(v) => setDraft({ ...draft, disciplines: v.split(',').map(d => d.trim()) })} placeholder="ex: CSO, Dressage" />
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

      {followModal && (
        <FollowListModal
          visible={!!followModal}
          onClose={() => setFollowModal(null)}
          userId={userStore.id}
          type={followModal}
        />
      )}
    </SafeAreaView>
  );
}

function Field({ label, value, onChangeText, placeholder }: {
  label: string; value: string; onChangeText: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.fieldInput}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder ?? label}
        placeholderTextColor={Colors.textTertiary}
      />
    </View>
  );
}

function StatBox({ label, value, icon }: { label: string; value: string | number; icon: string }) {
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  container: { padding: Spacing.lg, paddingBottom: 100 },
  heroSection: { alignItems: 'center', marginBottom: Spacing.lg },
  name: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginTop: Spacing.lg },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: Spacing.xs },
  stars: { color: Colors.gold, fontSize: FontSize.base },
  rating: { fontSize: FontSize.xs, color: Colors.textTertiary },
  roleBadge: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: Spacing.md, backgroundColor: '#7C3AED22', borderRadius: 999, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs },
  roleIcon: { fontSize: 16 },
  roleText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: '#7C3AED' },
  planBadge: { marginTop: Spacing.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs },
  planText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  followRow: { flexDirection: 'row', backgroundColor: Colors.surface, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.md, paddingVertical: Spacing.md },
  followItem: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  followNum: { fontSize: FontSize.xl, fontWeight: FontWeight.extrabold, color: Colors.primary },
  followLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  statsRow: { flexDirection: 'row', marginBottom: Spacing.lg, alignItems: 'center' },
  statBox: { flex: 1, alignItems: 'center', gap: Spacing.xs },
  statIcon: { fontSize: 20 },
  statValue: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  statLabel: { fontSize: FontSize.xs, color: Colors.textTertiary },
  statsDivider: { width: 1, height: 40, backgroundColor: Colors.border },
  section: { backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.lg, ...Shadow.card },
  sectionTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.md },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  infoLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  infoValue: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  editButton: { backgroundColor: Colors.primary, borderRadius: Radius.lg, paddingVertical: Spacing.md, alignItems: 'center', marginTop: Spacing.lg },
  editText: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: '#FFF' },
  logoutButton: { backgroundColor: '#FF4444', borderRadius: Radius.lg, paddingVertical: Spacing.md, alignItems: 'center', marginTop: Spacing.md },
  logoutText: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: '#FFF' },
  editBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  editSheet: { backgroundColor: Colors.surface, borderTopLeftRadius: Radius.xxl, borderTopRightRadius: Radius.xxl, padding: Spacing.xl, paddingBottom: 40, maxHeight: '90%' },
  editTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary, textAlign: 'center', marginBottom: Spacing.xl },
  fieldWrap: { marginBottom: Spacing.md },
  fieldLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: Spacing.xs },
  fieldInput: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, padding: Spacing.md, fontSize: FontSize.base, color: Colors.textPrimary, backgroundColor: Colors.background },
  editActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.lg },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: Colors.borderMedium, borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center' },
  cancelText: { color: Colors.textSecondary, fontWeight: FontWeight.semibold },
  confirmBtn: { flex: 1, backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center' },
  confirmText: { color: '#FFF', fontWeight: FontWeight.bold },
  Shadow: Shadow.card,
  menuBtn: { flexDirection: 'row', alignItems: 'center', padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: Spacing.md },
  menuIcon: { fontSize: 18, width: 24 },
  menuLabel: { flex: 1, fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  menuSub: { fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: 2 },
  menuArrow: { fontSize: FontSize.xl, color: Colors.textTertiary },
});
