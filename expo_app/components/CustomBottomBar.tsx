import React, { useState, useCallback, useEffect } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Platform } from 'react-native';
import { useRouter, usePathname, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../constants/colors';
import { useUserRole } from '../hooks/useUserRole';
import { useNotifications } from '../hooks/useNotifications';
import { selectActiveNotifications } from '../hooks/useActiveNotifications';
import { useMyTransportReservations } from '../hooks/useTransports';
import { useMyBoxReservations } from '../hooks/useBoxes';
import { userStore } from '../data/store';
import { useMyCourseDemands } from '../hooks/useCourseDemands';
import { useMyStageReservations } from '../hooks/useStages';
import { selectCoachPendingDemands } from '../hooks/useCoachPendingDemands';
import { useUnreadMessagesCount } from '../hooks/useMessaging';
import { useOpenSupportCount } from '../hooks/useSupportRequests';

export interface TabConfig {
  name: string;
  label: string;
  emoji: string;
  route: string;
}

const TABS_BY_ROLE: Record<'cavalier' | 'coach' | 'organisateur' | 'admin', TabConfig[]> = {
  cavalier: [
    { name: 'accueil', label: 'Accueil', emoji: '🏠', route: '/(tabs)/accueil' },
    { name: 'chevaux', label: 'Chevaux', emoji: '🐴', route: '/(tabs)/chevaux' },
    { name: 'services', label: 'Services', emoji: '🤝', route: '/(tabs)/services' },
    { name: 'cavalier-agenda', label: 'Agenda', emoji: '📅', route: '/(tabs)/cavalier-agenda' },
    { name: 'communaute', label: 'Communauté', emoji: '👥', route: '/(tabs)/communaute' },
    { name: 'notifications', label: 'Notifs', emoji: '🔔', route: '/(tabs)/notifications' },
    { name: 'profil', label: 'Profil', emoji: '👤', route: '/(tabs)/profil' },
  ],
  coach: [
    { name: 'accueil', label: 'Accueil', emoji: '🏠', route: '/(tabs)/accueil' },
    { name: 'coach-agenda', label: 'Agenda', emoji: '📅', route: '/(tabs)/coach-agenda' },
    { name: 'coach-concours', label: 'Concours', emoji: '🏆', route: '/(tabs)/coach-concours' },
    { name: 'coach-stages', label: 'Stages', emoji: '📚', route: '/(tabs)/coach-stages' },
    { name: 'coach-demandes', label: 'Demandes', emoji: '📬', route: '/(tabs)/coach-demandes' },
    { name: 'coach-notifications', label: 'Notifs', emoji: '🔔', route: '/(tabs)/coach-notifications' },
    { name: 'communaute', label: 'Communauté', emoji: '👥', route: '/(tabs)/communaute' },
    { name: 'profil-coach', label: 'Profil', emoji: '👤', route: '/(tabs)/profil-coach' },
  ],
  organisateur: [
    { name: 'accueil', label: 'Accueil', emoji: '🏠', route: '/(tabs)/accueil' },
    { name: 'org-concours', label: 'Concours', emoji: '🏆', route: '/(tabs)/org-concours' },
    { name: 'org-services', label: 'Services', emoji: '📦', route: '/(tabs)/org-services' },
    { name: 'communaute', label: 'Communauté', emoji: '👥', route: '/(tabs)/communaute' },
    { name: 'org-notifications', label: 'Notifs', emoji: '🔔', route: '/(tabs)/org-notifications' },
    { name: 'profil-org', label: 'Profil', emoji: '👤', route: '/(tabs)/profil-org' },
  ],
  admin: [
    { name: 'accueil', label: 'Accueil', emoji: '🏠', route: '/(tabs)/accueil' },
    { name: 'import-concours', label: 'CSV Import', emoji: '📋', route: '/(tabs)/import-concours' },
    { name: 'admin-analytics', label: 'Analytics', emoji: '📊', route: '/(tabs)/admin-analytics' },
    { name: 'admin-disputes', label: 'Litiges', emoji: '⚖️', route: '/(tabs)/admin-disputes' },
    { name: 'admin-support', label: 'Réclamations', emoji: '📩', route: '/(tabs)/admin-support' },
    { name: 'admin-commissions', label: 'Commissions', emoji: '💶', route: '/(tabs)/admin-commissions' },
    { name: 'admin-notifications', label: 'Notifs', emoji: '🔔', route: '/(tabs)/admin-notifications' },
    { name: 'admin-profil', label: 'Profil', emoji: '👤', route: '/(tabs)/admin-profil' },
  ],
};

export function CustomBottomBar() {
  const insets = useSafeAreaInsets();
  const role = useUserRole() as 'cavalier' | 'coach' | 'organisateur' | 'admin';
  const router = useRouter();
  const pathname = usePathname();
  const { reservations: transportReservations } = useMyTransportReservations();
  const { reservations: boxReservations } = useMyBoxReservations();
  const { demands: courseDemands } = useMyCourseDemands();
  const { reservations: stageReservations } = useMyStageReservations();
  // Badge Notifs : notifications RÉELLEMENT actives (obsolètes filtrées via le
  // prédicat centralisé selectActiveNotifications) → le badge ne peut plus
  // afficher 1 alors que l'écran Notifications affiche 0.
  const { notifications: allNotifications } = useNotifications();
  const notificationCount = selectActiveNotifications(allNotifications, {
    courseDemands,
    stageReservations,
    viewerId: userStore.id,
  }).filter((n) => !n.lu).length;
  const [demandCount, setDemandCount] = useState(0);
  const [agendaCount, setAgendaCount] = useState(0);
  // Badge messages non lus : source Supabase unique (realtime), tous rôles.
  const msgCount = useUnreadMessagesCount();
  // Badge réclamations admin : même source que l'ancienne carte (tickets
  // open + in_progress). support_requests n'étant pas en realtime, on recompte
  // au focus (cf. updateNotificationCount ci-dessous).
  const { count: openSupportCount, refresh: refreshSupportCount } = useOpenSupportCount();

  // Tous les flux migrés sur Supabase via hooks realtime — plus de store mock.
  const updateNotificationCount = useCallback(() => {
    const uid = userStore.id;
    if (role === 'coach') {
      // Source UNIQUE, partagée avec l'accueil coach et coach-demandes.tsx.
      setDemandCount(selectCoachPendingDemands(courseDemands, stageReservations, uid).count);
    } else if (role === 'cavalier') {
      setDemandCount(0);
      const pendingTransport = transportReservations.filter(
        r => (r.buyerId === uid || r.sellerId === uid) && r.statut === 'pending'
      ).length;
      const pendingBox = boxReservations.filter(
        r => (r.buyerId === uid || r.sellerId === uid) && r.statut === 'pending'
      ).length;
      const pendingStage = stageReservations.filter(
        r => r.cavalierUserId === uid && r.statut === 'pending'
      ).length;
      const pendingCours = courseDemands.filter(
        r => r.cavalierUserId === uid && r.statut === 'pending'
      ).length;
      setAgendaCount(pendingTransport + pendingBox + pendingStage + pendingCours);
    }
  }, [role, transportReservations, boxReservations, courseDemands, stageReservations]);

  // Refresh notifications count quand on revient
  useFocusEffect(useCallback(() => {
    updateNotificationCount();
    // Le compteur de tickets support n'est pas en realtime : on recompte au
    // focus, uniquement pour l'admin (seul rôle qui affiche ce badge).
    if (role === 'admin') refreshSupportCount();
  }, [updateNotificationCount, role, refreshSupportCount]));

  // updateNotificationCount est un useCallback qui dépend des reservations/demands.
  // Quand un hook realtime push une mise à jour, leur référence change → cet effet
  // se redéclenche automatiquement. Plus besoin de setInterval 300ms (drain CPU 3Hz).
  useEffect(() => {
    updateNotificationCount();
  }, [updateNotificationCount]);

  const tabs = TABS_BY_ROLE[role] || TABS_BY_ROLE.cavalier;

  const isActive = (tabRoute: string) => {
    return pathname === tabRoute || pathname.endsWith('/' + tabRoute.split('/').pop());
  };

  // Get badge count for each tab
  const getBadgeCount = (tab: TabConfig): number => {
    // Messagerie déplacée dans l'onglet Communauté → le badge non-lus messages
    // s'affiche désormais sur « communaute » (tous rôles user).
    if (tab.name === 'communaute') return msgCount;
    if (role === 'coach') {
      if (tab.name === 'coach-notifications') return notificationCount;
      if (tab.name === 'coach-demandes') return demandCount;
    } else if (role === 'cavalier') {
      if (tab.name === 'notifications') return notificationCount;
      if (tab.name === 'cavalier-agenda') return agendaCount;
    } else if (role === 'organisateur') {
      if (tab.name === 'org-notifications') return notificationCount;
    } else if (role === 'admin') {
      if (tab.name === 'admin-support') return openSupportCount;
      if (tab.name === 'admin-notifications') return notificationCount;
    }
    return 0;
  };

  // Get role-specific styles
  const getContainerStyle = () => {
    const baseStyle = styles.container;
    if (role === 'coach') return [baseStyle, styles.containerCoach];
    if (role === 'organisateur') return [baseStyle, styles.containerOrg];
    return [baseStyle, styles.containerCavalier];
  };

  const getTabButtonStyle = () => {
    if (role === 'coach') return [styles.tabButton, styles.tabButtonCoach];
    if (role === 'organisateur') return [styles.tabButton, styles.tabButtonOrg];
    return [styles.tabButton, styles.tabButtonCavalier];
  };

  const safePadBottom = Math.max(insets.bottom, Platform.OS === 'ios' ? 12 : 8);
  // Natif : hauteur explicite = contenu (~59) + safe area dynamique. Sans elle,
  // `height: undefined` laisse Yoga effondrer la rangée d'onglets (enfants
  // `flex: 1` sans hauteur → 0) sur une build iOS native. Le web/PWA garde son
  // comportement actuel (hauteur auto, min-content CSS) : on n'y touche pas.
  const barHeight =
    Platform.OS === 'web' ? undefined : (Platform.OS === 'ios' ? 59 : 60) + safePadBottom;
  return (
    <View style={[getContainerStyle(), { paddingBottom: safePadBottom, height: barHeight }]}>
      {tabs.map((tab) => (
        <View key={tab.name} style={{ position: 'relative' }}>
          <TouchableOpacity
            style={[getTabButtonStyle(), isActive(tab.route) && styles.tabButtonActive]}
            onPress={() => router.push(tab.route)}
            activeOpacity={0.8}
          >
            <Text style={styles.emoji}>{tab.emoji}</Text>
            <Text style={[styles.label, isActive(tab.route) && styles.labelActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>

          {/* Badge for unread notifications */}
          {getBadgeCount(tab) > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {getBadgeCount(tab) > 9 ? '9+' : getBadgeCount(tab)}
              </Text>
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    height: Platform.OS === 'ios' ? 85 : 80,
    paddingTop: 6,
    paddingBottom: Platform.OS === 'ios' ? 20 : 12,
    paddingHorizontal: 2,
    gap: 2,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: 4,
    paddingHorizontal: 3,
    borderRadius: 10,
  },
  tabButtonActive: {
    backgroundColor: Colors.primaryLight,
  },
  emoji: {
    fontSize: 18,
  },
  label: {
    fontSize: 8.5,
    fontWeight: '600',
    color: Colors.textTertiary,
  },
  labelActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: 0,
    backgroundColor: '#FF4444',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.surface,
  },
  badgeText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 11,
    paddingHorizontal: 4,
  },
  // Role-specific container styles
  containerCavalier: {
    paddingHorizontal: 0,
    gap: 4,
  },
  containerCoach: {
    paddingHorizontal: 2,
    gap: 1.5,
  },
  containerOrg: {
    paddingHorizontal: 0,
    gap: 3,
  },
  // Role-specific tab button styles
  tabButtonCavalier: {
    paddingHorizontal: 5,
    gap: 3,
  },
  tabButtonCoach: {
    paddingHorizontal: 3,
    gap: 1.5,
  },
  tabButtonOrg: {
    paddingHorizontal: 5,
    gap: 2,
  },
});
