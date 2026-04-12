import { View, Text, ScrollView, StyleSheet, SafeAreaView } from 'react-native';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../../constants/theme';

const POSTS = [
  {
    id: '1',
    auteur: 'Marc Dubois',
    role: '🎓 Coach CSO',
    titre: 'Progression pour jeunes cavaliers',
    desc: 'Partagez vos techniques pour débuter la CSO avec des enfants. Quel est votre approche pour la confiance?',
    aime: 24,
    comm: 8,
    date: '2 avr',
  },
  {
    id: '2',
    auteur: 'Sophie Laurent',
    role: '🎓 Coach Dressage',
    titre: 'Période de transition hivernale',
    desc: 'Comment maintenez-vous la forme physique pendant l\'hiver? Routines d\'entraînement en manège?',
    aime: 18,
    comm: 12,
    date: '1 avr',
  },
  {
    id: '3',
    auteur: 'Equishow Team',
    role: '📢 Annonce',
    titre: '🎉 Nouvelle fonctionnalité: Plans de progression',
    desc: 'Créez et partagez des plans d\'entraînement avec vos élèves. Disponible cette semaine!',
    aime: 45,
    comm: 15,
    date: '31 mar',
  },
  {
    id: '4',
    auteur: 'Jean Moreau',
    role: '🎓 Coach Hunter',
    titre: 'Gestion des cavaliers timides',
    desc: 'Quels sont vos meilleurs conseils pour aider un cavalier anxieux? Expériences et retours bienvenus.',
    aime: 32,
    comm: 11,
    date: '30 mar',
  },
  {
    id: '5',
    auteur: 'Pauline Chevrier',
    role: '🎓 Coach Polyvalente',
    titre: 'Équipement et budget',
    desc: 'Comment conseillez-vous vos élèves sur le choix de l\'équipement sans exploser le budget?',
    aime: 28,
    comm: 14,
    date: '29 mar',
  },
];

export default function CommunauteCoachScreen() {
  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <Text style={s.headerTitle}>👥 Communauté Coachs</Text>
        <Text style={s.headerSubtitle}>Partages, conseils et discussions entre coachs</Text>
      </View>

      <ScrollView contentContainerStyle={s.container}>
        {POSTS.map((post) => (
          <View key={post.id} style={s.postCard}>
            <View style={s.postHeader}>
              <View>
                <Text style={s.postAuteur}>{post.auteur}</Text>
                <Text style={s.postRole}>{post.role}</Text>
              </View>
              <Text style={s.postDate}>{post.date}</Text>
            </View>

            <Text style={s.postTitre}>{post.titre}</Text>
            <Text style={s.postDesc}>{post.desc}</Text>

            <View style={s.postFooter}>
              <View style={s.statBadge}>
                <Text style={s.statText}>❤️ {post.aime}</Text>
              </View>
              <View style={s.statBadge}>
                <Text style={s.statText}>💬 {post.comm}</Text>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: { padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.surface },
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.xs },
  headerSubtitle: { fontSize: FontSize.sm, color: Colors.textSecondary },
  container: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 100 },
  postCard: { backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, ...Shadow.card, gap: Spacing.sm },
  postHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.sm },
  postAuteur: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  postRole: { fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: Spacing.xs },
  postDate: { fontSize: FontSize.xs, color: Colors.textTertiary },
  postTitre: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.xs },
  postDesc: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  postFooter: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.md, paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border },
  statBadge: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.xs, paddingHorizontal: Spacing.sm, borderRadius: Radius.sm, backgroundColor: Colors.background },
  statText: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.semibold },
});
