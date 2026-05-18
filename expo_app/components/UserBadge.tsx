// ─────────────────────────────────────────────────────────────────────────────
// <UserBadge /> — pill compact niveau cavalier + badges coach.
//
// Variantes :
//   - variant='pill' (default) — pill avec label texte + couleur du niveau
//   - variant='icon'           — étoile ★ collée au nom (tous les niveaux,
//                                 y compris Débutant, pas de hideIfDebutant)
//
// Props :
//   - userId        : string requis
//   - variant       : 'pill' | 'icon' (default 'pill')
//   - showLevel     : afficher niveau (default true)
//   - showCertified : badge Coach Certifié (default true)
//   - showBoost     : badge Boost (default true)
//   - size          : 'xs' | 'sm' | 'md' (default 'sm')
//   - hideIfDebutant: pour variant=pill (default true)
//
// Couleurs ★ par niveau :
//   Débutant  → gris clair
//   Passionné → bleu
//   Confirmé  → vert
//   Expert    → argent
//   Élite     → or
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LEVEL_STYLE, LEVEL_ICON, COACH_BADGES } from '../lib/badges';
import { useUserBadges } from '../hooks/useUserBadges';

type Size = 'xs' | 'sm' | 'md';
type Variant = 'pill' | 'icon';

interface Props {
  userId?: string;
  variant?: Variant;
  showLevel?: boolean;
  showCertified?: boolean;
  showBoost?: boolean;
  size?: Size;
  hideIfDebutant?: boolean;
}

export function UserBadge({
  userId,
  variant = 'pill',
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

  // ── Variante "icon" : étoile colorée collée au nom ────────────────────
  if (variant === 'icon') {
    if (showLevel) {
      const s = LEVEL_STYLE[badges.level];
      items.push(
        <Text
          key="lvl-icon"
          style={[styles.starIcon, { color: s.fg, fontSize: ICON_SIZE[size] }]}
          accessibilityLabel={`Niveau ${s.label}`}
        >
          {LEVEL_ICON}
        </Text>,
      );
    }
    if (showCertified && badges.isCertified) {
      items.push(
        <Text key="cert-icon" style={[styles.starIcon, { color: COACH_BADGES.certified.fg, fontSize: ICON_SIZE[size] }]}>
          ✓
        </Text>,
      );
    }
    if (showBoost && badges.isBoosted) {
      items.push(
        <Text key="boost-icon" style={[styles.starIcon, { color: COACH_BADGES.boost.fg, fontSize: ICON_SIZE[size] }]}>
          🚀
        </Text>,
      );
    }
    if (items.length === 0) return null;
    return <View style={styles.iconRow}>{items}</View>;
  }

  // ── Variante "pill" (par défaut) ──────────────────────────────────────
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
            <Text style={{ color: s.fg }}>{LEVEL_ICON} </Text>{s.label}
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

const ICON_SIZE: Record<Size, number> = { xs: 13, sm: 15, md: 18 };

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, alignItems: 'center' },
  iconRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  pill: { alignSelf: 'flex-start' },
  text: { fontWeight: '600' },
  starIcon: { fontWeight: '700', textShadowColor: 'rgba(0,0,0,0.08)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 1 },
});
