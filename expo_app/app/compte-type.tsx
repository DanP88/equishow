import { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView,
} from 'react-native';
import { router } from 'expo-router';

const PREVIEW_ROUTES: Partial<Record<string, string>> = {
  coach: '/preview-coach',
  organisateur: '/preview-organisateur',
};
import { Colors } from '../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../constants/theme';
import { userStore } from '../data/store';

type Role = 'cavalier' | 'coach' | 'organisateur';

const ROLES: {
  id: Role;
  icon: string;
  title: string;
  subtitle: string;
  color: string;
  features: string[];
}[] = [
  {
    id: 'cavalier',
    icon: '🏇',
    title: 'Cavalier',
    subtitle: 'Gérez vos chevaux, participez aux concours',
    color: '#F97316',
    features: [
      'Fiche complète pour chaque cheval',
      'Inscription aux concours en ligne',
      'Réservation de coach à la séance',
      'Co-transport : proposez ou trouvez une place',
      'Partage de box sur site',
      'Flux communauté et actualités',
    ],
  },
  {
    id: 'coach',
    icon: '🎓',
    title: 'Coach',
    subtitle: 'Proposez vos services, suivez vos élèves',
    color: '#7C3AED',
    features: [
      'Profil coach public et visible',
      'Proposez des créneaux de coaching',
      'Recevez des demandes de cavaliers',
      'Notifié des concours dans votre discipline',
      'Messagerie intégrée avec vos élèves',
      'Suivi des paiements (commission 9%)',
    ],
  },
  {
    id: 'organisateur',
    icon: '🏟️',
    title: 'Organisateur',
    subtitle: 'Publiez et gérez vos concours',
    color: '#0369A1',
    features: [
      'Créez et publiez des concours',
      'Taggez discipline, date, région',
      'Notifiez automatiquement coaches et cavaliers',
      'Gérez les inscriptions et les paiements',
      'Proposez des boxes à la location',
      'Tableau de bord organisateur complet',
    ],
  },
];

export default function CompteTypeScreen() {
  const [selected, setSelected] = useState<Role>(userStore.role);

  function confirm() {
    userStore.role = selected;
    router.back();
  }

  return (
    <SafeAreaView style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Text style={s.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Type de compte</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.container}>
        <Text style={s.intro}>
          Choisissez le type de compte qui correspond à votre activité. Vous pouvez changer à tout moment.
        </Text>

        {ROLES.map((role) => {
          const isActive = selected === role.id;
          return (
            <TouchableOpacity
              key={role.id}
              style={[s.card, isActive && { borderColor: role.color, borderWidth: 2 }]}
              onPress={() => setSelected(role.id)}
              activeOpacity={0.85}
            >
              {/* Card header */}
              <View style={s.cardHeader}>
                <View style={[s.iconWrap, { backgroundColor: role.color + '22' }]}>
                  <Text style={s.cardIcon}>{role.icon}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.cardTitle, isActive && { color: role.color }]}>{role.title}</Text>
                  <Text style={s.cardSubtitle}>{role.subtitle}</Text>
                </View>
                <View style={[s.radio, isActive && { borderColor: role.color }]}>
                  {isActive && <View style={[s.radioDot, { backgroundColor: role.color }]} />}
                </View>
              </View>

              {/* Features */}
              <View style={s.featureList}>
                {role.features.map((f) => (
                  <View key={f} style={s.featureRow}>
                    <Text style={[s.featureCheck, isActive && { color: role.color }]}>✓</Text>
                    <Text style={s.featureText}>{f}</Text>
                  </View>
                ))}
              </View>

              {/* Actions */}
              <View style={s.cardFooter}>
                {userStore.role === role.id && (
                  <View style={[s.currentBadge, { backgroundColor: role.color + '22', borderColor: role.color + '66' }]}>
                    <Text style={[s.currentBadgeText, { color: role.color }]}>Compte actuel</Text>
                  </View>
                )}
                {PREVIEW_ROUTES[role.id] && (
                  <TouchableOpacity
                    style={[s.previewBtn, { borderColor: role.color }]}
                    onPress={() => router.push(PREVIEW_ROUTES[role.id] as any)}
                    activeOpacity={0.8}
                  >
                    <Text style={[s.previewBtnText, { color: role.color }]}>👁 Voir l'interface</Text>
                  </TouchableOpacity>
                )}
              </View>
            </TouchableOpacity>
          );
        })}

        <View style={s.commissionNote}>
          <Text style={s.commissionIcon}>💳</Text>
          <Text style={s.commissionText}>
            Une commission de 9% est prélevée sur chaque paiement effectué via la plateforme (coaching, transport, box).
          </Text>
        </View>
      </ScrollView>

      <View style={s.footer}>
        <TouchableOpacity
          style={[s.confirmBtn, selected !== userStore.role && s.confirmBtnActive]}
          onPress={confirm}
          disabled={selected === userStore.role}
        >
          <Text style={s.confirmText}>
            {selected === userStore.role ? 'Aucun changement' : `Passer en compte ${ROLES.find(r => r.id === selected)?.title}`}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surfaceVariant, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 24, color: Colors.textPrimary, lineHeight: 28 },
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },

  container: { padding: Spacing.lg, paddingBottom: 120, gap: Spacing.md },

  intro: { fontSize: FontSize.base, color: Colors.textSecondary, lineHeight: 22, marginBottom: Spacing.sm },

  card: { backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, ...Shadow.card },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.md },
  iconWrap: { width: 52, height: 52, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center' },
  cardIcon: { fontSize: 26 },
  cardTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  cardSubtitle: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: Colors.borderMedium, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5 },

  featureList: { gap: Spacing.xs },
  featureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  featureCheck: { fontSize: FontSize.sm, color: Colors.textTertiary, fontWeight: FontWeight.bold, width: 16 },
  featureText: { fontSize: FontSize.sm, color: Colors.textSecondary, flex: 1, lineHeight: 20 },

  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.md, flexWrap: 'wrap', gap: Spacing.sm },
  currentBadge: { borderRadius: Radius.sm, borderWidth: 1, paddingVertical: Spacing.xs, paddingHorizontal: Spacing.md },
  currentBadgeText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  previewBtn: { borderWidth: 1, borderRadius: Radius.sm, paddingVertical: Spacing.xs, paddingHorizontal: Spacing.md },
  previewBtnText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold },

  commissionNote: { flexDirection: 'row', gap: Spacing.sm, backgroundColor: Colors.surfaceVariant, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'flex-start' },
  commissionIcon: { fontSize: 18 },
  commissionText: { fontSize: FontSize.sm, color: Colors.textSecondary, flex: 1, lineHeight: 20 },

  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: Spacing.lg, paddingBottom: 32, backgroundColor: Colors.surface, borderTopWidth: 1, borderTopColor: Colors.border },
  confirmBtn: { backgroundColor: Colors.borderMedium, borderRadius: Radius.lg, paddingVertical: Spacing.md + 2, alignItems: 'center' },
  confirmBtnActive: { backgroundColor: Colors.primary },
  confirmText: { color: Colors.textInverse, fontWeight: FontWeight.bold, fontSize: FontSize.base },
});
