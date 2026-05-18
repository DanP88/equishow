import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, FontWeight } from '../../constants/theme';
import { userStore } from '../../data/store';
import { AvisSection } from '../../components/AvisSection';
import { useFollow } from '../../hooks/useFollow';
import { useAvisStats } from '../../hooks/useAvis';
import { useCoachProfile } from '../../hooks/useCoachProfiles';
import { UserBadge } from '../../components/UserBadge';

export default function ViewCoachScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const { coach, isLoading } = useCoachProfile(id);

  if (isLoading && !coach) {
    return (
      <SafeAreaView style={s.root}>
        <View style={s.center}>
          <Text style={{ color: Colors.textTertiary }}>Chargement…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!coach) {
    return (
      <SafeAreaView style={s.root}>
        <View style={s.center}>
          <Text style={{ color: Colors.textTertiary, marginBottom: 16 }}>Coach non trouvé</Text>
          <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/')}>
            <Text style={{ color: Colors.primary }}>← Retour</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const coachUserId = coach.auteurId ?? coach.id;
  const isOwnProfile = coachUserId === userStore.id;
  const { average: avgRating } = useAvisStats(coachUserId);

  return (
    <SafeAreaView style={s.root}>
      <ScrollView contentContainerStyle={s.container}>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/')}>
          <Text style={{ color: Colors.primary, fontSize: 16, fontWeight: '600', marginBottom: 16 }}>← Retour</Text>
        </TouchableOpacity>

        {/* Hero */}
        <View style={s.hero}>
          <View style={[s.avatar, { backgroundColor: coach.couleur }]}>
            <Text style={s.avatarText}>{coach.initiales}</Text>
          </View>
          <Text style={s.name}>{coach.prenom} {coach.nom}</Text>
          <Text style={s.pseudo}>@{coach.pseudo}</Text>
          <View style={{ marginTop: 8 }}>
            <UserBadge userId={coachUserId} size="md" />
          </View>
          {!coach.disponible && (
            <View style={s.indispoBadge}><Text style={s.indispoText}>Indisponible</Text></View>
          )}
          {avgRating > 0 && (
            <Text style={s.ratingText}>⭐ {avgRating.toFixed(1)} / 5</Text>
          )}

          {/* Follow button */}
          {!isOwnProfile && <FollowButton targetId={coachUserId} />}
        </View>

        {/* Stats */}
        <FollowStats targetId={coachUserId} />

        {/* Infos */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Infos</Text>
          {coach.region && <InfoRow label="Région" value={coach.region} />}
          {coach.disciplines && coach.disciplines.length > 0 && (
            <InfoRow label="Disciplines" value={coach.disciplines.join(', ')} />
          )}
          {coach.niveaux && coach.niveaux.length > 0 && (
            <InfoRow label="Niveaux" value={coach.niveaux.join(', ')} />
          )}
          <InfoRow label="Tarif" value={`${coach.tarifHeure}€/h HT`} />
          {coach.specialites && coach.specialites.length > 0 && (
            <InfoRow label="Spécialités" value={coach.specialites.join(', ')} />
          )}
        </View>

        {/* Bio */}
        {coach.bio ? (
          <View style={s.section}>
            <Text style={s.sectionTitle}>À propos</Text>
            <Text style={s.bioText}>{coach.bio}</Text>
          </View>
        ) : null}

        {/* CTA */}
        {!isOwnProfile && (
          <TouchableOpacity
            style={s.ctaBtn}
            onPress={() => router.push({
              pathname: '/messagerie',
              params: {
                otherId: coachUserId,
                otherNom: `${coach.prenom} ${coach.nom}`,
                otherPseudo: coach.pseudo,
                otherCouleur: coach.couleur,
                otherInitiales: coach.initiales,
                sujet: `🎓 Coach ${coach.prenom} ${coach.nom}`,
              },
            } as any)}
          >
            <Text style={s.ctaBtnText}>💬 Contacter ce coach</Text>
          </TouchableOpacity>
        )}

        {/* Avis */}
        <AvisSection userId={coachUserId} />

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function FollowButton({ targetId }: { targetId: string }) {
  const { following, toggle } = useFollow(targetId);
  return (
    <TouchableOpacity
      style={[s.followBtn, following && s.followBtnActive]}
      onPress={toggle}
      activeOpacity={0.8}
    >
      <Text style={[s.followBtnText, following && s.followBtnTextActive]}>
        {following ? '✓ Abonné' : '+ Suivre'}
      </Text>
    </TouchableOpacity>
  );
}

function FollowStats({ targetId }: { targetId: string }) {
  const { followersCount, followingCount } = useFollow(targetId);
  return (
    <View style={s.followStats}>
      <View style={s.followStatItem}>
        <Text style={s.followStatNum}>{followersCount}</Text>
        <Text style={s.followStatLabel}>Abonnés</Text>
      </View>
      <View style={s.followStatDivider} />
      <View style={s.followStatItem}>
        <Text style={s.followStatNum}>{followingCount}</Text>
        <Text style={s.followStatLabel}>Abonnements</Text>
      </View>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.infoRow}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={s.infoValue}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  container: { padding: Spacing.lg, paddingBottom: 100 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  hero: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
    gap: 6,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  avatarText: { fontSize: 32, fontWeight: FontWeight.extrabold, color: '#fff' },
  name: { fontSize: FontSize.xl, fontWeight: FontWeight.extrabold, color: Colors.textPrimary },
  pseudo: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.semibold },
  indispoBadge: { backgroundColor: Colors.surfaceVariant, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 3 },
  indispoText: { fontSize: FontSize.xs, color: Colors.textTertiary },
  ratingText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: '#92400E' },
  followBtn: {
    marginTop: 4,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.lg,
    backgroundColor: Colors.primary,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  followBtnActive: { backgroundColor: 'transparent', borderColor: Colors.border },
  followBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: '#fff' },
  followBtnTextActive: { color: Colors.textSecondary },
  followStats: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
    padding: Spacing.lg,
    justifyContent: 'center',
    gap: 0,
  },
  followStatItem: { flex: 1, alignItems: 'center' },
  followStatDivider: { width: 1, backgroundColor: Colors.border, marginHorizontal: Spacing.lg },
  followStatNum: { fontSize: FontSize.xl, fontWeight: FontWeight.extrabold, color: Colors.primary },
  followStatLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  section: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
    overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  infoLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  infoValue: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textPrimary, maxWidth: '60%', textAlign: 'right' },
  bioText: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 22, padding: Spacing.lg },
  ctaBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.xl,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  ctaBtnText: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: '#fff' },
});
