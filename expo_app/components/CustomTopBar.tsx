import React, { useState } from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  Modal,
  FlatList,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../hooks/useAuth';
import { useNotifications } from '../hooks/useNotifications';
import { Colors } from '../constants/colors';
import { Spacing, FontSize, FontWeight, Radius } from '../constants/theme';

export function CustomTopBar() {
  const router = useRouter();
  const { profile } = useAuth();
  const { unreadCount, notifications } = useNotifications();
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);

  // Get initials from user profile (prenom and nom from database)
  const getInitials = () => {
    if (!profile) return '?';

    const prenom = profile.prenom || '';
    const nom = profile.nom || '';

    const prenomInit = prenom.trim().charAt(0).toUpperCase();
    const nomInit = nom.trim().charAt(0).toUpperCase();

    // Use prenom+nom initials if both exist
    if (prenomInit && nomInit) {
      return `${prenomInit}${nomInit}`;
    }

    // Fallback: extract initials from email
    if (profile.email) {
      const emailPart = profile.email.split('@')[0]; // e.g., "julien.mercier" or "jmercier"
      const parts = emailPart.split(/[.\-_]/); // Split by dot, dash, or underscore

      if (parts.length >= 2) {
        // e.g., "julien.mercier" → JM
        return `${parts[0].charAt(0).toUpperCase()}${parts[1].charAt(0).toUpperCase()}`;
      } else if (parts[0].length >= 2) {
        // e.g., "jmercier" → Take first and second letters
        return `${parts[0].charAt(0).toUpperCase()}${parts[0].charAt(1).toUpperCase()}`;
      }
    }

    return '?';
  };

  const initials = getInitials();

  const handleNotificationPress = () => {
    setShowNotificationsModal(true);
  };

  const handleProfilePress = () => {
    if (profile?.role === 'coach') {
      router.push('/(tabs)/profil-coach');
    } else if (profile?.role === 'organisateur') {
      router.push('/(tabs)/profil-org');
    } else {
      router.push('/(tabs)/profil');
    }
  };

  return (
    <>
      <View style={s.container}>
        {/* Spacer */}
        <View style={{ flex: 1 }} />

        {/* Right side icons */}
        <View style={s.rightIcons}>
          {/* Notifications Bell */}
          <TouchableOpacity
            style={s.notificationBtn}
            onPress={handleNotificationPress}
          >
            <Text style={s.bellIcon}>🔔</Text>
            {unreadCount > 0 && (
              <View style={s.badge}>
                <Text style={s.badgeText}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Account Avatar */}
          <TouchableOpacity
            style={s.accountBtn}
            onPress={handleProfilePress}
          >
            <View style={s.avatar}>
              <Text style={s.avatarText}>{initials}</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Notifications Modal */}
      <Modal
        visible={showNotificationsModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowNotificationsModal(false)}
      >
        <TouchableOpacity
          style={s.backdrop}
          activeOpacity={1}
          onPress={() => setShowNotificationsModal(false)}
        >
          <SafeAreaView style={s.modalContainer}>
            <TouchableOpacity activeOpacity={1} style={s.modalContent}>
              <View style={s.modalHeader}>
                <Text style={s.modalTitle}>Mes notifications</Text>
                <TouchableOpacity
                  onPress={() => setShowNotificationsModal(false)}
                >
                  <Text style={s.closeBtn}>✕</Text>
                </TouchableOpacity>
              </View>

              {notifications && notifications.length > 0 ? (
                <FlatList
                  data={notifications}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => (
                    <View style={s.notificationItem}>
                      <View style={s.notificationContent}>
                        <Text style={s.notificationTitle}>{item.title}</Text>
                        <Text style={s.notificationMessage}>{item.message}</Text>
                        <Text style={s.notificationDate}>
                          {new Date(item.timestamp).toLocaleDateString('fr-FR')}
                        </Text>
                      </View>
                      {!item.read && <View style={s.unreadDot} />}
                    </View>
                  )}
                  scrollEnabled={true}
                  contentContainerStyle={s.listContent}
                  showsVerticalScrollIndicator={false}
                />
              ) : (
                <View style={s.emptyContainer}>
                  <Text style={s.emptyText}>Aucune notification</Text>
                </View>
              )}
            </TouchableOpacity>
          </SafeAreaView>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  rightIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  notificationBtn: {
    position: 'relative',
    padding: Spacing.xs,
  },
  bellIcon: {
    fontSize: 22,
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#FF4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.surface,
  },
  badgeText: {
    color: '#FFF',
    fontWeight: FontWeight.bold,
    fontSize: 10,
    paddingHorizontal: 2,
  },
  accountBtn: {
    padding: Spacing.xs,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.primaryLight,
  },
  avatarText: {
    color: Colors.textInverse,
    fontWeight: FontWeight.bold,
    fontSize: FontSize.base,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    maxHeight: '80%',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  closeBtn: {
    fontSize: 20,
    color: Colors.textTertiary,
    fontWeight: FontWeight.bold,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  notificationItem: {
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  notificationMessage: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
    lineHeight: 18,
  },
  notificationDate: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
  emptyContainer: {
    paddingVertical: Spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
});
