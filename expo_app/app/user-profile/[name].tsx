import { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, CommonStyles, Shadow } from '../../constants/theme';
import { useFollow } from '../../hooks/useFollow';
import { useUsersByIds } from '../../hooks/useUsersByIds';

interface UserProfile {
  name: string;
  initiales: string;
  couleur: string;
  role: string;
  location: string;
  chevaux: number;
  concours: number;
  posts: Array<{
    id: string;
    contenu: string;
    date: Date;
    likes: number;
  }>;
}

// Map display names → stable user IDs (pour le système followers)
const NAME_TO_ID: Record<string, string> = {
  'Émilie Laurent': '550e8400-e29b-41d4-a716-446655440002',
  'Marc Dubois': '550e8400-e29b-41d4-a716-446655440004',
  'Sophie Martin': '550e8400-e29b-41d4-a716-446655440005',
  'Julien Mercier': '550e8400-e29b-41d4-a716-446655440003',
  'Sarah Lefebvre': '550e8400-e29b-41d4-a716-446655440001',
  'Sophie Dupont': '550e8400-e29b-41d4-a716-446655440099',
  'Marie Dupont': 'user_marie',
  'Thomas Renard': 'user_thomas',
  'Pierre Morel': 'user_pierre',
  'Lucie Bernard': 'user_lucie',
};

function nameToId(name: string): string {
  return NAME_TO_ID[name] ?? `uid_${name.replace(/\s+/g, '_').toLowerCase()}`;
}

// Le paramètre de route peut désormais être un VRAI users.id (UUID) — passé par
// la Communauté / les Services depuis auteurId. Dans ce cas on résout le profil
// réel (users_public) et le follow est persistant. Sinon : chemin mock legacy.
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function roleLabel(role: string): string {
  switch (role) {
    case 'coach': return 'Coach';
    case 'organisateur': return 'Organisateur';
    case 'admin': return 'Admin';
    default: return 'Cavalier';
  }
}

const USERNAME_MAP: Record<string, string> = {
  'user2': 'Marie Dupont',
  'user3': 'Thomas Renard',
  'user4': 'Lucie Bernard',
  'coach_user_1': 'Jean Dupont',
  'coach_user_2': 'Marc Lefevre',
  'org_user_1': 'Isabelle Martin',
  'cavalier_user_1': 'Anne Sophie Leclerc',
  'MarieDup_KWPN': 'Marie Dupont',
  'ThomasR_CCE': 'Thomas Renard',
  'SophieM_Coach': 'Sophie Martin',
  'PierreM_Equi': 'Pierre Morel',
  'LucieBernard': 'Lucie Bernard',
  'EmilieL_Cav': 'Émilie Laurent',
};

const USERS_MAP: Record<string, UserProfile> = {
  'Émilie Laurent': {
    name: 'Émilie Laurent',
    initiales: 'EL',
    couleur: '#7C3AED',
    role: 'Coach',
    location: 'Auvergne-Rhône-Alpes, France',
    chevaux: 5,
    concours: 15,
    posts: [
      {
        id: '1',
        contenu: 'Nouvelle session de cours CSO disponible ! Niveau club et amateur. Travail technique et style. 🏇',
        date: new Date(Date.now() - 3 * 3600000),
        likes: 12,
      },
    ],
  },
  'Marc Dubois': {
    name: 'Marc Dubois',
    initiales: 'MD',
    couleur: '#0369A1',
    role: 'Coach',
    location: 'Auvergne-Rhône-Alpes, France',
    chevaux: 8,
    concours: 20,
    posts: [
      {
        id: '2',
        contenu: 'Formateur FFE spécialiste en dressage et travail en liberté. Déplacements sur place ou domicile. 🎓',
        date: new Date(Date.now() - 6 * 3600000),
        likes: 8,
      },
    ],
  },
  'Sophie Laurent': {
    name: 'Sophie Laurent',
    initiales: 'SL',
    couleur: '#EA580C',
    role: 'Coach',
    location: 'Île-de-France, France',
    chevaux: 10,
    concours: 25,
    posts: [
      {
        id: '3',
        contenu: 'Cavalière professionnelle CCE, sélection nationale. Coaching terrain et préparation mentale ! 💪',
        date: new Date(Date.now() - 12 * 3600000),
        likes: 20,
      },
    ],
  },
  'Marie Dupont': {
    name: 'Marie Dupont',
    initiales: 'MD',
    couleur: '#7C3AED',
    role: 'Cavalier',
    location: 'Lyon, France',
    chevaux: 2,
    concours: 8,
    posts: [
      {
        id: '1',
        contenu: 'Super week-end au concours de Lyon ! Éclipse a été parfaite sur le parcours 🏆',
        date: new Date(Date.now() - 2 * 3600000),
        likes: 14,
      },
    ],
  },
  'Thomas Renard': {
    name: 'Thomas Renard',
    initiales: 'TR',
    couleur: '#0369A1',
    role: 'Cavalier',
    location: 'Grenoble, France',
    chevaux: 1,
    concours: 5,
    posts: [
      {
        id: '2',
        contenu: "Quelqu'un a une recommandation pour un ostéopathe équin dans la région lyonnaise ?",
        date: new Date(Date.now() - 5 * 3600000),
        likes: 8,
      },
    ],
  },
  'Sophie Martin': {
    name: 'Sophie Martin',
    initiales: 'SM',
    couleur: '#16A34A',
    role: 'Coach',
    location: 'Lyon, France',
    chevaux: 5,
    concours: 12,
    posts: [
      {
        id: '3',
        contenu: 'Résultats du Championnat Régional de Dressage disponibles ! Bravo à tous les participants 🎉',
        date: new Date(Date.now() - 24 * 3600000),
        likes: 32,
      },
    ],
  },
  'Pierre Morel': {
    name: 'Pierre Morel',
    initiales: 'PM',
    couleur: '#B45309',
    role: 'Cavalier',
    location: 'Saint-Étienne, France',
    chevaux: 3,
    concours: 6,
    posts: [
      {
        id: '4',
        contenu: 'Nouvelle sellerie ouverte à Saint-Étienne, très bonne qualité ! 🐴',
        date: new Date(Date.now() - 12 * 3600000),
        likes: 5,
      },
    ],
  },
  'Lucie Bernard': {
    name: 'Lucie Bernard',
    initiales: 'LB',
    couleur: '#F97316',
    role: 'Cavalier',
    location: 'Villeurbanne, France',
    chevaux: 2,
    concours: 4,
    posts: [
      {
        id: '5',
        contenu: 'Mon cheval vient de franchir un nouveau niveau ! Tellement content !',
        date: new Date(Date.now() - 36 * 3600000),
        likes: 10,
      },
    ],
  },
  'Camille Lefebvre': {
    name: 'Camille Lefebvre',
    initiales: 'CL',
    couleur: '#7C3AED',
    role: 'Cavalier',
    location: 'Bron, France',
    chevaux: 1,
    concours: 3,
    posts: [
      {
        id: '6',
        contenu: 'Premier concours réussi ! Merci à ma coach pour tout ! 💪',
        date: new Date(Date.now() - 48 * 3600000),
        likes: 7,
      },
    ],
  },
  'coach_user_1': {
    name: 'Coach User',
    initiales: 'CU',
    couleur: '#F59E0B',
    role: 'Coach',
    location: 'Paris, France',
    chevaux: 8,
    concours: 20,
    posts: [
      {
        id: '7',
        contenu: 'Nouvelle session de coaching disponible pour les cavaliers de niveau intermédiaire !',
        date: new Date(Date.now() - 3 * 3600000),
        likes: 15,
      },
    ],
  },
};

function timeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return "À l'instant";
  if (h < 24) return `Il y a ${h}h`;
  return `Il y a ${Math.floor(h / 24)}j`;
}

function generateUserProfile(username: string): UserProfile {
  // Use mapping if exists, otherwise use random name
  const displayName = USERNAME_MAP[username] || 'Utilisateur Équestre';

  const colors = ['#7C3AED', '#0369A1', '#16A34A', '#B45309', '#F97316', '#F59E0B'];
  const hash = username.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
  const color = colors[hash % colors.length];
  const initials = displayName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) || 'U';

  // Détecter si c'est un coach
  const isCoach = username.toLowerCase().includes('coach') ||
                  ['Émilie Laurent', 'Marc Dubois', 'Sophie Laurent'].includes(displayName);

  return {
    name: displayName,
    initiales: initials,
    couleur: color,
    role: isCoach ? 'Coach' : 'Cavalier',
    location: 'France',
    chevaux: isCoach ? Math.floor(Math.random() * 10) + 5 : Math.floor(Math.random() * 5) + 1,
    concours: isCoach ? Math.floor(Math.random() * 20) + 10 : Math.floor(Math.random() * 15) + 1,
    posts: [
      {
        id: '1',
        contenu: isCoach
          ? 'Coach passionné par l\'équitation et l\'enseignement ! Cours adaptés à tous les niveaux.'
          : 'Passionné par l\'équitation et la communauté équestre !',
        date: new Date(Date.now() - 24 * 3600000),
        likes: Math.floor(Math.random() * 20),
      },
    ],
  };
}

export default function UserProfileScreen() {
  const { name } = useLocalSearchParams<{ name: string }>();
  let decodedParam = '';

  try {
    decodedParam = name ? decodeURIComponent(name) : '';
  } catch (error) {
    console.error('Invalid URL parameter:', error);
  }

  const isUuid = UUID_RE.test(decodedParam);

  // Chemin RÉEL : le paramètre est un users.id → on résout le vrai profil.
  const realUsers = useUsersByIds(isUuid ? [decodedParam] : []);
  const realUser = isUuid ? realUsers.get(decodedParam) : undefined;

  // Chemin MOCK legacy : le paramètre est un nom/pseudo.
  const mockProfile = !isUuid && decodedParam
    ? (USERS_MAP[decodedParam] || generateUserProfile(decodedParam))
    : null;

  const [liked, setLiked] = useState<Record<string, boolean>>({});

  // targetId du follow : vrai users.id si UUID, sinon ID mock.
  const targetId = isUuid ? decodedParam : nameToId(decodedParam);
  const { following, toggle, followersCount, followingCount, isSelf } = useFollow(targetId);

  // Vue d'affichage unifiée (mock ou réel).
  const display = isUuid
    ? (realUser
        ? {
            name: realUser.pseudo?.trim() || `${realUser.prenom} ${realUser.nom}`.trim() || 'Utilisateur',
            initiales: realUser.initiales
              || ((realUser.prenom?.[0] ?? '') + (realUser.nom?.[0] ?? '')).toUpperCase()
              || 'U',
            couleur: realUser.avatar_color || '#7C3AED',
            role: roleLabel(realUser.role),
            location: 'France',
          }
        : null)
    : (mockProfile
        ? {
            name: mockProfile.name,
            initiales: mockProfile.initiales,
            couleur: mockProfile.couleur,
            role: mockProfile.role,
            location: mockProfile.location,
          }
        : null);

  // chevaux/concours/posts ne sont fiables que sur le chemin mock.
  const extras = !isUuid ? mockProfile : null;

  // Chargement du vrai profil en cours.
  if (isUuid && !realUser) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/')}>
            <Text style={styles.backButton}>← Retour</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.notFound}>
          <Text style={styles.notFoundText}>Chargement…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!display) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/')}>
            <Text style={styles.backButton}>← Retour</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.notFound}>
          <Text style={styles.notFoundText}>Utilisateur non trouvé</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.list}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/')}>
            <Text style={styles.backButton}>← Retour</Text>
          </TouchableOpacity>
        </View>

        {/* Hero Section */}
        <View style={styles.heroSection}>
          <View style={[styles.avatar, { backgroundColor: display.couleur }]}>
            <Text style={styles.avatarText}>{display.initiales}</Text>
          </View>
          <Text style={styles.name}>{display.name}</Text>
          <Text style={styles.role}>{display.role}</Text>
          <Text style={styles.location}>📍 {display.location}</Text>

          {/* Follow button (masqué sur mon propre profil) */}
          {!isSelf && (
            <TouchableOpacity
              style={[styles.followBtn, following && styles.followBtnActive]}
              onPress={() => void toggle()}
              activeOpacity={0.8}
            >
              <Text style={[styles.followBtnText, following && styles.followBtnTextActive]}>
                {following ? '✓ Abonné' : '+ Suivre'}
              </Text>
            </TouchableOpacity>
          )}

          {/* Stats inline */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statNum}>{followersCount}</Text>
              <Text style={styles.statLabel}>Abonnés</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNum}>{followingCount}</Text>
              <Text style={styles.statLabel}>Abonnements</Text>
            </View>
            {extras && (
              <>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statNum}>{extras.chevaux}</Text>
                  <Text style={styles.statLabel}>Chevaux</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statNum}>{extras.concours}</Text>
                  <Text style={styles.statLabel}>Concours</Text>
                </View>
              </>
            )}
          </View>
        </View>

        {/* Posts (mock legacy uniquement) */}
        {extras && (
          <>
            <Text style={styles.postsTitle}>Posts</Text>
            {extras.posts.map((post) => (
              <View key={post.id} style={styles.card}>
                <Text style={styles.contenu}>{post.contenu}</Text>
                <Text style={styles.date}>{timeAgo(post.date)}</Text>
                <View style={styles.actions}>
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => setLiked({ ...liked, [post.id]: !liked[post.id] })}
                  >
                    <Text style={styles.actionIcon}>{liked[post.id] ? '❤️' : '🤍'}</Text>
                    <Text style={[styles.actionText, liked[post.id] && { color: Colors.urgent }]}>
                      {post.likes + (liked[post.id] ? 1 : 0)}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionBtn}>
                    <Text style={styles.actionIcon}>💬</Text>
                    <Text style={styles.actionText}>0</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  list: { padding: Spacing.lg, gap: Spacing.md },
  header: {
    paddingBottom: Spacing.md,
    marginBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    fontSize: FontSize.base,
    color: Colors.primary,
    fontWeight: FontWeight.semibold,
  },
  notFound: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notFoundText: {
    fontSize: FontSize.base,
    color: Colors.textTertiary,
  },
  heroSection: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    marginBottom: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    ...Shadow.card,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  avatarText: {
    color: Colors.textInverse,
    fontWeight: FontWeight.bold,
    fontSize: FontSize.xl,
  },
  name: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.extrabold,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  role: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: FontWeight.semibold,
    marginBottom: Spacing.xs,
  },
  location: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    marginBottom: Spacing.md,
  },
  followBtn: {
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.lg,
    borderWidth: 2,
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
  },
  followBtnActive: {
    backgroundColor: 'transparent',
    borderColor: Colors.border,
  },
  followBtnText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: '#fff',
  },
  followBtnTextActive: {
    color: Colors.textSecondary,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: Colors.border,
    marginHorizontal: Spacing.md,
  },
  statItem: {
    alignItems: 'center',
    minWidth: 52,
  },
  statNum: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.extrabold,
    color: Colors.primary,
  },
  statLabel: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  postsTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  card: { ...CommonStyles.card, padding: Spacing.lg },
  contenu: { fontSize: FontSize.base, color: Colors.textPrimary, lineHeight: 22, marginBottom: Spacing.md },
  date: { fontSize: FontSize.xs, color: Colors.textTertiary, marginBottom: Spacing.md },
  actions: { flexDirection: 'row', gap: Spacing.lg, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.sm },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingVertical: Spacing.xs },
  actionIcon: { fontSize: 18 },
  actionText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.semibold },
});
