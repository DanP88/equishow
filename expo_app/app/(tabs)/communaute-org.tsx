import { View, Text, ScrollView, StyleSheet, SafeAreaView } from 'react-native';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../../constants/theme';

const POSTS = [
  {
    id: '1',
    auteur: 'Club du Léman',
    role: '🏟️ Organisateur Établi',
    titre: 'Gestion des inscriptions en ligne',
    desc: 'Quel système utilisez-vous pour les inscriptions? Avez-vous des retours sur la plateforme Equishow?',
    aime: 32,
    comm: 18,
    date: '3 avr',
  },
  {
    id: '2',
    auteur: 'Equishow Team',
    role: '📢 Équipe',
    titre: '🎉 Nouvelles fonctionnalités de gestion d\'événements',
    desc: 'Planification automatique, gestion des jury, tableaux en temps réel. En déploiement cette semaine!',
    aime: 58,
    comm: 24,
    date: '2 avr',
  },
  {
    id: '3',
    auteur: 'Centre Équestre de Lyon',
    role: '🏟️ Organisateur',
    titre: 'Logistique pour concours outdoor',
    desc: 'Comment gérez-vous le climat et les conditions météo? Retours d\'expérience bienvenus!',
    aime: 27,
    comm: 14,
    date: '1 avr',
  },
  {
    id: '4',
    auteur: 'Pôle Équestre des Alpes',
    role: '🏟️ Organisateur',
    titre: 'Communication avec les cavaliers',
    desc: 'Calendrier, modifications, mises à jour... Comment restez-vous en contact efficacement?',
    aime: 41,
    comm: 16,
    date: '31 mar',
  },
  {
    id: '5',
    auteur: 'FFCE Support',
    role: '📚 Ressource',
    titre: 'Conformité et réglementations',
    desc: 'Mise à jour des normes 2026. Retrouvez le guide complet et la checklist d\'organisation.',
    aime: 35,
    comm: 9,
    date: '30 mar',
  },
];

export default function CommunauteOrgScreen() {
  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <Text style={s.headerTitle}>👥 Communauté Organisateurs</Text>
        <Text style={s.headerSubtitle}>Partages et bonnes pratiques d\'organisation</Text>
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
