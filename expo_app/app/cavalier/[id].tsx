import { View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../../constants/theme';
import { getUserById } from '../../data/mockUsers';
import { userStore } from '../../data/store';

export default function CavalierPublicProfil() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = getUserById(id);

  if (!user) {
    return (
      <SafeAreaView style={s.root}>
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
            <Text style={s.backIcon}>‹</Text>
          </TouchableOpacity>
          <Text style={s.headerTitle}>Profil</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={s.notFound}>
          <Text style={s.notFoundText}>Profil introuvable</Text>
        </View>
      </SafeAreaView>
    );
  }

  const roleLabel = user.role === 'coach' ? 'Coach' : user.role === 'organisateur' ? 'Organisateur' : 'Cavalier';

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Text style={s.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Profil</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.container}>
        {/* Avatar + nom */}
        <View style={s.heroCard}>
          <View style={[s.avatar, { backgroundColor: user.avatarColor }]}>
            <Text style={s.avatarText}>{user.initiales}</Text>
          </View>
          <Text style={s.name}>{user.prenom} {user.nom}</Text>
          <Text style={s.pseudo}>@{user.pseudo}</Text>
          <View style={[s.roleBadge, { backgroundColor: user.avatarColor + '22', borderColor: user.avatarColor }]}>
            <Text style={[s.roleText, { color: user.avatarColor }]}>{roleLabel}</Text>
          </View>
        </View>

        {/* Infos */}
        {user.region ? (
          <View style={s.infoCard}>
            <View style={s.infoRow}>
              <Text style={s.infoIcon}>📍</Text>
              <View>
                <Text style={s.infoLabel}>Région</Text>
                <Text style={s.infoValue}>{user.region}</Text>
              </View>
            </View>
          </View>
        ) : null}

        {user.disciplines.length > 0 && (
          <View style={s.infoCard}>
            <Text style={s.sectionTitle}>Disciplines</Text>
            <View style={s.tagsRow}>
              {user.disciplines.map(d => (
                <View key={d} style={s.tag}>
                  <Text style={s.tagText}>{d}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <TouchableOpacity
          style={s.msgBtn}
          onPress={() => router.push({
            pathname: '/messagerie',
            params: {
              otherId: user.id,
              otherNom: `${user.prenom} ${user.nom}`,
              otherPseudo: user.pseudo,
              otherCouleur: user.avatarColor,
              otherInitiales: user.initiales,
              sujet: '💬 Discussion',
            },
          } as any)}
          activeOpacity={0.85}
        >
          <Text style={s.msgBtnText}>💬 Envoyer un message</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surfaceVariant, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 24, color: Colors.textPrimary, lineHeight: 28 },
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  notFound: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  notFoundText: { fontSize: FontSize.base, color: Colors.textSecondary },
  container: { padding: Spacing.lg, gap: Spacing.lg, paddingBottom: 40 },
  heroCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.xl,
    alignItems: 'center', gap: Spacing.md, borderWidth: 1, borderColor: Colors.border, ...Shadow.card,
  },
  avatar: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 28, fontWeight: FontWeight.extrabold, color: '#fff' },
  name: { fontSize: FontSize.xl, fontWeight: FontWeight.extrabold, color: Colors.textPrimary },
  pseudo: { fontSize: FontSize.base, color: Colors.primary, fontWeight: FontWeight.semibold },
  roleBadge: { paddingHorizontal: Spacing.md, paddingVertical: 4, borderRadius: Radius.lg, borderWidth: 1 },
  roleText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, textTransform: 'uppercase', letterSpacing: 0.5 },
  infoCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.lg,
    borderWidth: 1, borderColor: Colors.border, gap: Spacing.md,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  infoIcon: { fontSize: 20 },
  infoLabel: { fontSize: FontSize.xs, color: Colors.textTertiary, fontWeight: FontWeight.semibold, textTransform: 'uppercase', letterSpacing: 0.5 },
  infoValue: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary, marginTop: 2 },
  sectionTitle: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  tag: { backgroundColor: Colors.primaryLight, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 4, borderWidth: 1, borderColor: Colors.primaryBorder },
  tagText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.primary },
  msgBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.lg,
    paddingVertical: Spacing.md + 4, alignItems: 'center', ...Shadow.fab,
  },
  msgBtnText: { color: '#fff', fontWeight: FontWeight.extrabold, fontSize: FontSize.base },
});
