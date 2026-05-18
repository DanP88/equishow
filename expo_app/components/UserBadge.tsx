// ─────────────────────────────────────────────────────────────────────────────
// <UserBadge /> — pill compact niveau cavalier + badges coach.
//
// Props :
//   - userId      : string requis
//   - showLevel   : afficher la pill niveau (default true)
//   - showCertified : afficher badge Coach Certifié si applicable (default true)
//   - showBoost   : afficher badge Boost si applicable (default true)
//   - size        : 'xs' | 'sm' | 'md' (default 'sm')
//
// Usage :
//   <UserBadge userId={post.auteurId} />           // pill discrète à côté pseudo
//   <UserBadge userId={x} size="md" />             // hero profil
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LEVEL_STYLE, COACH_BADGES } from '../lib/badges';
import { useUserBadges } from '../hooks/useUserBadges';

type Size = 'xs' | 'sm' | 'md';

interface Props {
  userId?: string;
  showLevel?: boolean;
  showCertified?: boolean;
  showBoost?: boolean;
  size?: Size;
  hideIfDebutant?: boolean; // ne pas afficher pill "Débutant" pour réduire bruit
}

export function UserBadge({
  userId,
  showLevel = true,
  showCertified = true,
  showBoost = true,
  size = 'sm',
  hideIfDebutant = true,
}: Props) {
  const { badges } = useUserBadges(userId);
  if (!badges) return null;

  const dims = SIZE[size];
  const items: React.ReactNode[] = [];

  if (showBoost && badges.isBoosted) {
    const s = COACH_BADGES.boost;
    items.push(
      <View key="boost" style={[styles.pill, dims.pill, { backgroundColor: s.bg, borderColor: s.border, borderWidth: 1 }]}>
        <Text style={[styles.text, dims.text, { color: s.fg }]} numberOfLines={1}>
          {s.icon} {s.label}
        </Text>
      </View>,
    );
  }

  if (showCertified && badges.isCertified) {
    const s = COACH_BADGES.certified;
    items.push(
      <View key="cert" style={[styles.pill, dims.pill, { backgroundColor: s.bg, borderColor: s.border, borderWidth: 1 }]}>
        <Text style={[styles.text, dims.text, { color: s.fg }]} numberOfLines={1}>
          {s.icon} {s.label}
        </Text>
      </View>,
    );
  }

  if (showLevel) {
    const skip = hideIfDebutant && badges.level === 'debutant';
    if (!skip) {
      const s = LEVEL_STYLE[badges.level];
      items.push(
        <View key="lvl" style={[styles.pill, dims.pill, { backgroundColor: s.bg }]}>
          <Text style={[styles.text, dims.text, { color: s.fg }]} numberOfLines={1}>
            {s.label}
          </Text>
        </View>,
      );
    }
  }

  if (items.length === 0) return null;
  return <View style={styles.row}>{items}</View>;
}

const SIZE: Record<Size, { pill: any; text: any }> = {
  xs: { pill: { paddingHorizontal: 6,  paddingVertical: 1, borderRadius: 6  }, text: { fontSize: 10 } },
  sm: { pill: { paddingHorizontal: 8,  paddingVertical: 2, borderRadius: 8  }, text: { fontSize: 11 } },
  md: { pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 }, text: { fontSize: 13 } },
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    alignItems: 'center',
  },
  pill: {
    alignSelf: 'flex-start',
  },
  text: {
    fontWeight: '600',
  },
});
