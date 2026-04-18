import React from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../constants/colors';
import { Spacing, FontSize, FontWeight } from '../constants/theme';
import { userStore } from '../data/store';

export function CustomTopBar() {
  const router = useRouter();

  // Get initials from userStore
  const getInitials = () => {
    const prenom = userStore.prenom || '';
    const nom = userStore.nom || '';

    const prenomInit = prenom.trim().charAt(0).toUpperCase();
    const nomInit = nom.trim().charAt(0).toUpperCase();

    // Use prenom+nom initials
    if (prenomInit && nomInit) {
      return `${prenomInit}${nomInit}`;
    }

    return 'US'; // Fallback si manque les initiales
  };

  const initials = getInitials();

  const handleProfilePress = () => {
    if (userStore.role === 'coach') {
      router.push('/(tabs)/profil-coach');
    } else if (userStore.role === 'organisateur') {
      router.push('/(tabs)/profil-org');
    } else if (userStore.role === 'admin') {
      router.push('/(tabs)/admin-profil');
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
});
