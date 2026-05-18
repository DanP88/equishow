// ─────────────────────────────────────────────────────────────────────────────
// <LevelMedal /> — Médaille ronde premium pour les niveaux cavalier.
//
// Effet relief / lumière luxe :
//   - Disque metallic avec gradient diagonal (clair en haut-gauche → foncé bas-droite)
//   - Anneau extérieur (rim) qui simule la frappe / la profondeur
//   - Reflet brillant arc-en-ciel en haut (overlay blanc semi-transparent)
//   - Ombre portée subtile en dessous
//   - Icône centrale (★ Élite/Expert, point poli inférieur)
//
// 5 palettes :
//   Débutant  — bronze terne / acier brut
//   Passionné — bleu saphir poli
//   Confirmé  — vert émeraude
//   Expert    — argent / platine
//   Élite     — or massif
//
// Tailles : 'xs' 14px / 'sm' 18px / 'md' 26px / 'lg' 38px
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { UserLevel } from '../lib/badges';

type Size = 'xs' | 'sm' | 'md' | 'lg';

interface Palette {
  rim: string;          // anneau extérieur (couleur sombre)
  gradTopLeft: string;  // top-left lumière
  gradBottomRight: string; // bottom-right ombre
  inner: string;        // icone color
  highlightFrom: string; // overlay reflet haut
  highlightTo: string;
}

const PALETTE: Record<UserLevel, Palette> = {
  // Débutant — acier brut / gris froid mat
  debutant: {
    rim: '#71717A',
    gradTopLeft: '#E5E7EB',
    gradBottomRight: '#9CA3AF',
    inner: '#52525B',
    highlightFrom: 'rgba(255,255,255,0.55)',
    highlightTo:   'rgba(255,255,255,0)',
  },
  // Passionné — bleu saphir poli
  passionne: {
    rim: '#1E3A8A',
    gradTopLeft: '#93C5FD',
    gradBottomRight: '#1D4ED8',
    inner: '#FFFFFF',
    highlightFrom: 'rgba(255,255,255,0.6)',
    highlightTo:   'rgba(255,255,255,0)',
  },
  // Confirmé — vert émeraude profond
  confirme: {
    rim: '#064E3B',
    gradTopLeft: '#6EE7B7',
    gradBottomRight: '#047857',
    inner: '#FFFFFF',
    highlightFrom: 'rgba(255,255,255,0.55)',
    highlightTo:   'rgba(255,255,255,0)',
  },
  // Expert — argent / platine métallique
  expert: {
    rim: '#475569',
    gradTopLeft: '#F1F5F9',
    gradBottomRight: '#64748B',
    inner: '#334155',
    highlightFrom: 'rgba(255,255,255,0.75)',
    highlightTo:   'rgba(255,255,255,0)',
  },
  // Élite — or massif éclat 24 carats
  elite: {
    rim: '#92400E',
    gradTopLeft: '#FEF3C7',
    gradBottomRight: '#D97706',
    inner: '#78350F',
    highlightFrom: 'rgba(255,255,255,0.7)',
    highlightTo:   'rgba(255,255,255,0)',
  },
};

const SIZE_PX: Record<Size, number> = { xs: 14, sm: 18, md: 26, lg: 38 };
const ICON_FONT: Record<Size, number> = { xs: 8, sm: 10, md: 14, lg: 22 };

interface Props {
  level: UserLevel;
  size?: Size;
}

export function LevelMedal({ level, size = 'sm' }: Props) {
  const p = PALETTE[level];
  const px = SIZE_PX[size];
  const inset = Math.max(1, Math.round(px * 0.08));   // épaisseur du rim
  const innerPx = px - inset * 2;

  return (
    <View style={[styles.shadow, { width: px, height: px, borderRadius: px / 2 }]}>
      {/* Anneau extérieur (rim) — donne la profondeur */}
      <View
        style={[
          styles.rim,
          { width: px, height: px, borderRadius: px / 2, backgroundColor: p.rim },
        ]}
      >
        {/* Corps métallique avec gradient diagonal (haut-gauche → bas-droite) */}
        <LinearGradient
          colors={[p.gradTopLeft, p.gradBottomRight]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            width: innerPx,
            height: innerPx,
            borderRadius: innerPx / 2,
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          {/* Reflet supérieur — overlay vertical blanc → transparent */}
          <LinearGradient
            colors={[p.highlightFrom, p.highlightTo]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 0.55 }}
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />
          {/* Icône centrale ★ — couleur p.inner */}
          <Text
            style={{
              fontSize: ICON_FONT[size],
              color: p.inner,
              fontWeight: '900',
              lineHeight: ICON_FONT[size] * 1.05,
              textShadowColor: 'rgba(0,0,0,0.18)',
              textShadowOffset: { width: 0, height: 1 },
              textShadowRadius: 1,
            }}
          >
            ★
          </Text>
        </LinearGradient>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    // Ombre portée sous la médaille — donne le volume
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2,
    elevation: 2,
  },
  rim: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
