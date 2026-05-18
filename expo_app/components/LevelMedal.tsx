// ─────────────────────────────────────────────────────────────────────────────
// <LevelMedal /> — Cocarde équestre stylisée pour les niveaux cavalier.
//
// Inspiré des rosettes de concours hippique françaises.
// Structure :
//   - 2 rubans (tails) en bas (V inversé qui dépasse)
//   - cocarde plissée extérieure (anneau radial)
//   - bouton central métallique avec gradient + reflet
//   - étoile dorée au centre (or sur tous niveaux, l'or de la victoire)
//
// 5 niveaux = 5 couleurs de ruban et de cocarde :
//   Débutant  — gris perle / blanc cassé
//   Passionné — bleu cobalt
//   Confirmé  — vert émeraude
//   Expert    — argent / platine (métallique)
//   Élite     — or 24 carats
//
// Implémenté avec react-native-svg → vraie qualité vectorielle, gradient
// radial, ombres, reflet, peu importe la taille (xs → lg).
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, {
  Defs,
  RadialGradient,
  LinearGradient as SvgLinearGradient,
  Stop,
  Circle,
  Path,
  G,
  Polygon,
  Ellipse,
  Line,
} from 'react-native-svg';
import { UserLevel } from '../lib/badges';

type Size = 'xs' | 'sm' | 'md' | 'lg';

interface Palette {
  ribbonDark: string;
  ribbonLight: string;
  cocardeDark: string;
  cocardeMid: string;
  cocardeLight: string;
  centerDark: string;
  centerLight: string;
  star: string;        // couleur étoile
  starOutline: string;
}

const PALETTE: Record<UserLevel, Palette> = {
  // Débutant — gris perle / nacré
  debutant: {
    ribbonDark: '#94A3B8',
    ribbonLight: '#E2E8F0',
    cocardeDark: '#64748B',
    cocardeMid: '#CBD5E1',
    cocardeLight: '#F1F5F9',
    centerDark: '#475569',
    centerLight: '#E2E8F0',
    star: '#94A3B8',
    starOutline: '#475569',
  },
  // Passionné — bleu cobalt profond
  passionne: {
    ribbonDark: '#1E3A8A',
    ribbonLight: '#60A5FA',
    cocardeDark: '#1D4ED8',
    cocardeMid: '#3B82F6',
    cocardeLight: '#93C5FD',
    centerDark: '#1E3A8A',
    centerLight: '#DBEAFE',
    star: '#FBBF24',
    starOutline: '#92400E',
  },
  // Confirmé — vert émeraude
  confirme: {
    ribbonDark: '#065F46',
    ribbonLight: '#34D399',
    cocardeDark: '#047857',
    cocardeMid: '#10B981',
    cocardeLight: '#6EE7B7',
    centerDark: '#064E3B',
    centerLight: '#D1FAE5',
    star: '#FBBF24',
    starOutline: '#92400E',
  },
  // Expert — argent / platine métallique
  expert: {
    ribbonDark: '#475569',
    ribbonLight: '#CBD5E1',
    cocardeDark: '#334155',
    cocardeMid: '#94A3B8',
    cocardeLight: '#F1F5F9',
    centerDark: '#1F2937',
    centerLight: '#F1F5F9',
    star: '#F8FAFC',
    starOutline: '#475569',
  },
  // Élite — or 24 carats
  elite: {
    ribbonDark: '#92400E',
    ribbonLight: '#FCD34D',
    cocardeDark: '#B45309',
    cocardeMid: '#F59E0B',
    cocardeLight: '#FEF3C7',
    centerDark: '#78350F',
    centerLight: '#FEF3C7',
    star: '#FFFBEB',
    starOutline: '#92400E',
  },
};

const SIZE_PX: Record<Size, number> = { xs: 18, sm: 22, md: 32, lg: 48 };

interface Props {
  level: UserLevel;
  size?: Size;
}

// Étoile 5 branches centrée sur (cx, cy) de rayon r (extérieur)
function starPoints(cx: number, cy: number, r: number): string {
  const inner = r * 0.45;
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const radius = i % 2 === 0 ? r : inner;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    pts.push(`${cx + radius * Math.cos(a)},${cy + radius * Math.sin(a)}`);
  }
  return pts.join(' ');
}

export function LevelMedal({ level, size = 'sm' }: Props) {
  const p = PALETTE[level];
  const px = SIZE_PX[size];

  // Viewbox 100x140 (cocarde 100x100 + rubans qui dépassent 40px en bas)
  const W = 100;
  const H = 140;
  const cx = 50;
  const cyCocarde = 48;
  const rOuter = 38;   // cocarde plissée
  const rInner = 24;   // bouton central

  // Suffixe d'id unique par niveau pour éviter collision SVG defs
  const gid = `lvm-${level}`;

  return (
    <View
      style={[
        styles.container,
        { width: px, height: Math.round(px * (H / W)) },
      ]}
    >
      <Svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <Defs>
          {/* Gradient rubans (vertical, clair au milieu) */}
          <SvgLinearGradient id={`${gid}-ribbon`} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={p.ribbonDark} />
            <Stop offset="0.5" stopColor={p.ribbonLight} />
            <Stop offset="1" stopColor={p.ribbonDark} />
          </SvgLinearGradient>
          {/* Gradient cocarde plissée (radial, foncé bord → clair centre) */}
          <RadialGradient id={`${gid}-cocarde`} cx="0.5" cy="0.4" r="0.7" fx="0.4" fy="0.3">
            <Stop offset="0" stopColor={p.cocardeLight} />
            <Stop offset="0.6" stopColor={p.cocardeMid} />
            <Stop offset="1" stopColor={p.cocardeDark} />
          </RadialGradient>
          {/* Gradient bouton central — métallique 3D */}
          <RadialGradient id={`${gid}-center`} cx="0.4" cy="0.3" r="0.7">
            <Stop offset="0" stopColor={p.centerLight} />
            <Stop offset="0.6" stopColor={p.cocardeMid} />
            <Stop offset="1" stopColor={p.centerDark} />
          </RadialGradient>
          {/* Reflet lumineux (overlay haut blanc → transparent) */}
          <SvgLinearGradient id={`${gid}-shine`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.55" />
            <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity="0.1" />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
          </SvgLinearGradient>
        </Defs>

        {/* ── RUBANS du bas (2 tails inversés en V) ──────────────────── */}
        {/* Tail gauche */}
        <Polygon
          points={`40,80 50,80 38,135 26,128`}
          fill={`url(#${gid}-ribbon)`}
          stroke={p.ribbonDark}
          strokeWidth="0.8"
        />
        {/* Tail droite */}
        <Polygon
          points={`50,80 60,80 74,128 62,135`}
          fill={`url(#${gid}-ribbon)`}
          stroke={p.ribbonDark}
          strokeWidth="0.8"
        />
        {/* Encoche centrale (les 2 rubans se rejoignent sous la cocarde) */}
        <Polygon
          points={`44,75 56,75 52,90 48,90`}
          fill={p.ribbonDark}
          opacity="0.5"
        />

        {/* ── COCARDE plissée extérieure ──────────────────────────────── */}
        {/* Plis (rays) — 16 traits radiaux qui simulent le plissé */}
        <G>
          {Array.from({ length: 16 }).map((_, i) => {
            const a = (i * Math.PI * 2) / 16;
            const x2 = cx + rOuter * Math.cos(a);
            const y2 = cyCocarde + rOuter * Math.sin(a);
            return (
              <Line
                key={`pli-${i}`}
                x1={cx}
                y1={cyCocarde}
                x2={x2}
                y2={y2}
                stroke={p.cocardeDark}
                strokeWidth="0.4"
                opacity="0.5"
              />
            );
          })}
        </G>
        {/* Disque cocarde (gradient radial) */}
        <Circle
          cx={cx}
          cy={cyCocarde}
          r={rOuter}
          fill={`url(#${gid}-cocarde)`}
          stroke={p.cocardeDark}
          strokeWidth="1.4"
        />
        {/* Pli en zig-zag (anneau crénelé) — approximation via cercle dashed */}
        <Circle
          cx={cx}
          cy={cyCocarde}
          r={rOuter - 1}
          fill="none"
          stroke={p.cocardeLight}
          strokeWidth="0.6"
          opacity="0.65"
          strokeDasharray="2,1.5"
        />

        {/* ── BOUTON central métallique ──────────────────────────────── */}
        <Circle
          cx={cx}
          cy={cyCocarde}
          r={rInner}
          fill={`url(#${gid}-center)`}
          stroke={p.centerDark}
          strokeWidth="1.2"
        />
        {/* Reflet supérieur — ellipse claire */}
        <Ellipse
          cx={cx - 2}
          cy={cyCocarde - 8}
          rx={rInner * 0.55}
          ry={rInner * 0.32}
          fill={`url(#${gid}-shine)`}
        />

        {/* ── ÉTOILE centrale ─────────────────────────────────────────── */}
        <Polygon
          points={starPoints(cx, cyCocarde, rInner * 0.7)}
          fill={p.star}
          stroke={p.starOutline}
          strokeWidth="0.8"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
