import { useState, useCallback } from 'react';
import {
  View, Text, Modal, TouchableOpacity, ScrollView, StyleSheet,
} from 'react-native';
import { Colors } from '../constants/colors';
import { Spacing, Radius, FontSize, FontWeight } from '../constants/theme';
import {
  getFollowers, getFollowing, getUserInfo, isFollowing, toggleFollow, userStore,
} from '../data/store';

interface Props {
  visible: boolean;
  onClose: () => void;
  userId: string;
  type: 'followers' | 'following';
}

const ROLE_LABEL: Record<string, string> = {
  cavalier: 'Cavalier',
  coach: 'Coach',
  organisateur: 'Organisateur',
  admin: 'Admin',
};

export function FollowListModal({ visible, onClose, userId, type }: Props) {
  const [tick, setTick] = useState(0);

  const items = type === 'followers'
    ? getFollowers(userId).map(f => f.followerId)
    : getFollowing(userId).map(f => f.followedId);

  const handleToggle = useCallback((targetId: string) => {
    toggleFollow(userStore.id, targetId);
    setTick(t => t + 1);
  }, []);

  const title = type === 'followers' ? 'Abonnés' : 'Abonnements';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={s.sheet}>
          {/* Header */}
          <View style={s.header}>
            <Text style={s.title}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={s.closeBtn}>
              <Text style={s.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          {items.length === 0 ? (
            <View style={s.empty}>
              <Text style={s.emptyText}>
                {type === 'followers' ? 'Aucun abonné pour l\'instant.' : 'Vous ne suivez personne encore.'}
              </Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={s.list} showsVerticalScrollIndicator={false}>
              {items.map(id => {
                const info = getUserInfo(id);
                const isSelf = id === userStore.id;
                const followed = isFollowing(userStore.id, id);
                return (
                  <View key={id + tick} style={s.row}>
                    {/* Avatar */}
                    <View style={[s.avatar, { backgroundColor: info.couleur }]}>
                      <Text style={s.avatarText}>{info.initiales}</Text>
                    </View>
                    {/* Info */}
                    <View style={s.info}>
                      <Text style={s.nom}>{info.nom}</Text>
                      <Text style={s.meta}>@{info.pseudo} · {ROLE_LABEL[info.role] ?? info.role}</Text>
                    </View>
                    {/* Bouton Suivre (pas sur soi-même) */}
                    {!isSelf && (
                      <TouchableOpacity
                        style={[s.followBtn, followed && s.followBtnActive]}
                        onPress={() => handleToggle(id)}
                        activeOpacity={0.8}
                      >
                        <Text style={[s.followBtnText, followed && s.followBtnTextActive]}>
                          {followed ? 'Abonné' : '+ Suivre'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
              <View style={{ height: 20 }} />
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xxl,
    borderTopRightRadius: Radius.xxl,
    maxHeight: '70%',
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.extrabold,
    color: Colors.textPrimary,
  },
  closeBtn: {
    width: 32, height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.bold },
  empty: {
    padding: Spacing.xl,
    alignItems: 'center',
  },
  emptyText: { fontSize: FontSize.sm, color: Colors.textTertiary },
  list: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.md,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: {
    color: '#fff',
    fontSize: FontSize.sm,
    fontWeight: FontWeight.extrabold,
  },
  info: { flex: 1 },
  nom: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  meta: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  followBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.lg,
    backgroundColor: Colors.primary,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  followBtnActive: {
    backgroundColor: 'transparent',
    borderColor: Colors.border,
  },
  followBtnText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: '#fff',
  },
  followBtnTextActive: {
    color: Colors.textSecondary,
  },
});
