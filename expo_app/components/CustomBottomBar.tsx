import React, { useState, useCallback, useEffect } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Platform } from 'react-native';
import { useRouter, usePathname, useFocusEffect } from 'expo-router';
import { Colors } from '../constants/colors';
import { useUserRole } from '../hooks/useUserRole';
import { notificationsStore, userStore, stageReservationsStore, courseDemandesStore, transportReservationsStore, boxReservationsStore, totalUnreadForUser } from '../data/store';

export interface TabConfig {
  name: string;
  label: string;
  emoji: string;
  route: string;
}

const TABS_BY_ROLE: Record<'cavalier' | 'coach' | 'organisateur' | 'admin', TabConfig[]> = {
  cavalier: [
    { name: 'chevaux', label: 'Chevaux', emoji: '🐴', route: '/(tabs)/chevaux' },
    { name: 'services', label: 'Services', emoji: '🤝', route: '/(tabs)/services' },
    { name: 'cavalier-agenda', label: 'Agenda', emoji: '📅', route: '/(tabs)/cavalier-agenda' },
    { name: 'messagerie', label: 'Messages', emoji: '💬', route: '/messagerie' },
    { name: 'communaute', label: 'Communauté', emoji: '👥', route: '/(tabs)/communaute' },
    { name: 'notifications', label: 'Notifs', emoji: '🔔', route: '/(tabs)/notifications' },
    { name: 'profil', label: 'Profil', emoji: '👤', route: '/(tabs)/profil' },
  ],
  coach: [
    { name: 'coach-agenda', label: 'Agenda', emoji: '📅', route: '/(tabs)/coach-agenda' },
    { name: 'coach-concours', label: 'Concours', emoji: '🏆', route: '/(tabs)/coach-concours' },
    { name: 'coach-services', label: 'Services', emoji: '🎓', route: '/(tabs)/coach-services' },
    { name: 'coach-stages', label: 'Stages', emoji: '📚', route: '/(tabs)/coach-stages' },
    { name: 'coach-notifications', label: 'Notifs', emoji: '🔔', route: '/(tabs)/coach-notifications' },
    { name: 'coach-demandes', label: 'Demandes', emoji: '📬', route: '/(tabs)/coach-demandes' },
    { name: 'communaute', label: 'Communauté', emoji: '👥', route: '/(tabs)/communaute' },
    { name: 'profil-coach', label: 'Profil', emoji: '👤', route: '/(tabs)/profil-coach' },
  ],
  organisateur: [
    { name: 'org-concours', label: 'Concours', emoji: '🏆', route: '/(tabs)/org-concours' },
    { name: 'org-services', label: 'Services', emoji: '📦', route: '/(tabs)/org-services' },
    { name: 'communaute', label: 'Communauté', emoji: '👥', route: '/(tabs)/communaute' },
    { name: 'profil-org', label: 'Profil', emoji: '👤', route: '/(tabs)/profil-org' },
  ],
  admin: [
    { name: 'admin-settings', label: 'Paramètres', emoji: '⚙️', route: '/(tabs)/admin-settings' },
    { name: 'admin-profil', label: 'Profil', emoji: '👤', route: '/(tabs)/admin-profil' },
  ],
};

export function CustomBottomBar() {
  const role = useUserRole() as 'cavalier' | 'coach' | 'organisateur' | 'admin';
  const router = useRouter();
  const pathname = usePathname();
  const [notificationCount, setNotificationCount] = useState(0);
  const [demandCount, setDemandCount] = useState(0);
  const [agendaCount, setAgendaCount] = useState(0);
  const [msgCount, setMsgCount] = useState(0);

  // Fonction pour compter les notifications et demandes
  const updateNotificationCount = useCallback(() => {
    if (role === 'coach') {
      // Pour les coachs: notifications non lues (demandes en attente)
      const coachNotifs = notificationsStore.list.filter(
        n => (n.userId === userStore.id || n.destinataireId === userStore.id) && !n.lue && !n.lu
      ).length;
      setNotificationCount(coachNotifs);

      // Demandes en attente: cours + stages
      const pendingCourses = courseDemandesStore.list.filter(
        d => d.coachId === userStore.id && d.statut === 'pending'
      ).length;
      const pendingStages = stageReservationsStore.list.filter(
        r => r.coachId === userStore.id && r.statut === 'pending'
      ).length;
      setDemandCount(pendingCourses + pendingStages);
    } else if (role === 'cavalier') {
      const uid = userStore.id;
      // Notifications non lues
      const cavalierNotifs = notificationsStore.list.filter(
        n => n.destinataireId === uid && !n.lue && !n.lu
      ).length;
      setNotificationCount(cavalierNotifs);
      setDemandCount(0);
      // Réservations en attente dans l'agenda
      const pendingTransport = transportReservationsStore.list.filter(
        r => (r.buyerId === uid || r.sellerId === uid) && r.statut === 'pending'
      ).length;
      const pendingBox = boxReservationsStore.list.filter(
        r => (r.buyerId === uid || r.sellerId === uid) && r.statut === 'pending'
      ).length;
      const pendingStage = stageReservationsStore.list.filter(
        r => r.cavalierUserId === uid && r.statut === 'pending'
      ).length;
      const pendingCours = courseDemandesStore.list.filter(
        r => r.cavalierUserId === uid && r.statut === 'pending'
      ).length;
      setAgendaCount(pendingTransport + pendingBox + pendingStage + pendingCours);
      setMsgCount(totalUnreadForUser(uid));
    }
  }, [role]);

  // Refresh notifications count quand on revient
  useFocusEffect(useCallback(() => {
    updateNotificationCount();
  }, [updateNotificationCount]));

  // Écouter les changements en temps réel
  useEffect(() => {
    // Mettre à jour immédiatement
    updateNotificationCount();

    const interval = setInterval(() => {
      updateNotificationCount();
    }, 300); // Mettre à jour toutes les 300ms

    return () => clearInterval(interval);
  }, [updateNotificationCount]);

  const tabs = TABS_BY_ROLE[role] || TABS_BY_ROLE.cavalier;

  const isActive = (tabRoute: string) => {
    return pathname === tabRoute || pathname.endsWith('/' + tabRoute.split('/').pop());
  };

  // Get badge count for each tab
  const getBadgeCount = (tab: TabConfig): number => {
    if (role === 'coach') {
      if (tab.name === 'coach-notifications') return notificationCount;
      if (tab.name === 'coach-demandes') return demandCount;
    } else if (role === 'cavalier') {
      if (tab.name === 'notifications') return notificationCount;
      if (tab.name === 'cavalier-agenda') return agendaCount;
      if (tab.name === 'messagerie') return msgCount;
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

  return (
    <View style={getContainerStyle()}>
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
