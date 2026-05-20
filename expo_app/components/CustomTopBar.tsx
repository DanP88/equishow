import React from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  Image,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../constants/colors';
import { Spacing, FontSize, FontWeight } from '../constants/theme';
import { userStore } from '../data/store';

// Logo identitaire Equishow — wordmark "EquiShow" (IMG_4555.jpg rogné des
// marges blanches → logo-wordmark.png). En haut à gauche, clic = home du rôle.
const LOGO_SRC = require('../assets/logo-wordmark.png');

const HOME_ROUTE_BY_ROLE: Record<string, string> = {
  cavalier: '/(tabs)/chevaux',
  coach: '/(tabs)/coach-agenda',
  organisateur: '/(tabs)/org-concours',
  admin: '/(tabs)/admin-settings',
};

export function CustomTopBar() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

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

  const handleLogoPress = () => {
    const target = HOME_ROUTE_BY_ROLE[userStore.role ?? 'cavalier'] ?? '/(tabs)/chevaux';
    router.push(target as any);
  };

  return (
    <>
      <View style={[s.container, { paddingTop: insets.top + Spacing.sm }]}>
        {/* Logo Equishow — clic renvoie à la home du rôle */}
        <TouchableOpacity style={s.logoBtn} onPress={handleLogoPress} activeOpacity={0.7}>
          <Image source={LOGO_SRC} style={s.logo} resizeMode="contain" />
        </TouchableOpacity>

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
  logoBtn: {
    padding: Spacing.xs,
  },
  logoCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
  },
  logo: {
    width: 138,
    height: 44,
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
