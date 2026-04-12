import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Platform } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Colors } from '../constants/colors';
import { useUserRole } from '../hooks/useUserRole';
import { useNotifications } from '../hooks/useNotifications';

export interface TabConfig {
  name: string;
  label: string;
  emoji: string;
  route: string;
}

const TABS_BY_ROLE: Record<'cavalier' | 'coach' | 'organisateur', TabConfig[]> = {
  cavalier: [
    { name: 'chevaux', label: 'Chevaux', emoji: '🐴', route: '/(tabs)/chevaux' },
    { name: 'concours', label: 'Concours', emoji: '🏆', route: '/(tabs)/concours' },
    { name: 'services', label: 'Services', emoji: '🤝', route: '/(tabs)/services' },
    { name: 'communaute', label: 'Communauté', emoji: '👥', route: '/(tabs)/communaute' },
    { name: 'profil', label: 'Profil', emoji: '👤', route: '/(tabs)/profil' },
  ],
  coach: [
    { name: 'coach-agenda', label: 'Agenda', emoji: '📅', route: '/(tabs)/coach-agenda' },
    { name: 'coach-concours', label: 'Concours', emoji: '🏆', route: '/(tabs)/coach-concours' },
    { name: 'coach-services', label: 'Services', emoji: '🎓', route: '/(tabs)/coach-services' },
    { name: 'coach-demandes', label: 'Demandes', emoji: '📬', route: '/(tabs)/coach-demandes' },
    { name: 'comm-coach', label: 'Comm Coach', emoji: '💬', route: '/(tabs)/comm_coach' },
    { name: 'communaute', label: 'Communauté', emoji: '👥', route: '/(tabs)/communaute' },
    { name: 'profil-coach', label: 'Profil', emoji: '👤', route: '/(tabs)/profil-coach' },
  ],
  organisateur: [
    { name: 'org-concours', label: 'Concours', emoji: '🏆', route: '/(tabs)/org-concours' },
    { name: 'org-services', label: 'Services', emoji: '📦', route: '/(tabs)/org-services' },
    { name: 'comm-org', label: 'Comm Org', emoji: '💬', route: '/(tabs)/comm_org' },
    { name: 'communaute', label: 'Communauté', emoji: '👥', route: '/(tabs)/communaute' },
    { name: 'profil-org', label: 'Profil', emoji: '👤', route: '/(tabs)/profil-org' },
  ],
};

export function CustomBottomBar() {
  const role = useUserRole() as 'cavalier' | 'coach' | 'organisateur';
  const router = useRouter();
  const pathname = usePathname();
  const { unreadCount } = useNotifications();

  const tabs = TABS_BY_ROLE[role] || TABS_BY_ROLE.cavalier;

  const isActive = (tabRoute: string) => {
    return pathname === tabRoute || pathname.endsWith('/' + tabRoute.split('/').pop());
  };

  // Show badge only for coach notifications tab
  const showBadge = (tab: TabConfig) => {
    return role === 'coach' && tab.name === 'coach-notifications' && unreadCount > 0;
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
          {showBadge(tab) && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {unreadCount > 9 ? '9+' : unreadCount}
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
