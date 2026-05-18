// ─────────────────────────────────────────────────────────────────────────────
// <LevelMedal /> — Cocarde équestre HAUTE COUTURE
//
// Design refined :
//   - Plis en soie (12 secteurs alternés clair/foncé pour vrai effet plissé satin)
//   - Anneau intérieur métallique doré/argenté (rim) avec hairline
//   - Médaillon central avec dégradé radial + reflet diagonal + ombre interne
//   - Étoile 5 branches polie (gradient or → ambre)
//   - Rubans à pli central + V-cut net en bas
//   - Drop shadow sous l'ensemble pour effet 3D
//
// 5 niveaux :
//   Débutant  — satin nacré
//   Passionné — bleu cobalt royal
//   Confirmé  — vert émeraude soie
//   Expert    — platine métallique
//   Élite     — or massif 24 carats
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
} from 'react-native-svg';
import { UserLevel } from '../lib/badges';

type Size = 'xs' | 'sm' | 'md' | 'lg';

interface Palette {
  // Rubans
  ribbonShadow: string;
  ribbonBase: string;
  ribbonHi: string;
  // Cocarde (plis soie)
  pleatDark: string;
  pleatLight: string;
  pleatEdge: string;
  // Anneau métallique
  rimDark: string;
  rimLight: string;
  // Médaillon central
  centerDark: string;
  centerMid: string;
  centerLight: string;
  // Étoile
  starHi: string;
  starLo: string;
  starOutline: string;
}

const GOLD = {
  rimDark: '#8C5A1A',
  rimLight: '#FFE082',
  starHi: '#FEF3C7',
  starLo: '#D97706',
  starOutline: '#78350F',
};

const SILVER = {
  rimDark: '#475569',
  rimLight: '#F1F5F9',
  starHi: '#F8FAFC',
  starLo: '#94A3B8',
  starOutline: '#334155',
};

const PALETTE: Record<UserLevel, Palette> = {
  // Débutant — jaune soleil satin
  debutant: {
    ribbonShadow: '#854D0E',
    ribbonBase: '#EAB308',
    ribbonHi: '#FEF3C7',
    pleatDark: '#CA8A04',
    pleatLight: '#FEF9C3',
    pleatEdge: '#713F12',
    centerDark: '#713F12',
    centerMid: '#FACC15',
    centerLight: '#FEF9C3',
    ...SILVER,
  },
  // Passionné — bleu cobalt royal
  passionne: {
    ribbonShadow: '#1E3A8A',
    ribbonBase: '#1D4ED8',
    ribbonHi: '#93C5FD',
    pleatDark: '#1D4ED8',
    pleatLight: '#93C5FD',
    pleatEdge: '#1E3A8A',
    centerDark: '#1E3A8A',
    centerMid: '#3B82F6',
    centerLight: '#DBEAFE',
    ...GOLD,
  },
  // Confirmé — vert émeraude soie
  confirme: {
    ribbonShadow: '#064E3B',
    ribbonBase: '#047857',
    ribbonHi: '#6EE7B7',
    pleatDark: '#047857',
    pleatLight: '#A7F3D0',
    pleatEdge: '#064E3B',
    centerDark: '#064E3B',
    centerMid: '#10B981',
    centerLight: '#D1FAE5',
    ...GOLD,
  },
  // Expert — platine métallique brossé
  expert: {
    ribbonShadow: '#334155',
    ribbonBase: '#64748B',
    ribbonHi: '#F1F5F9',
    pleatDark: '#64748B',
    pleatLight: '#F8FAFC',
    pleatEdge: '#334155',
    centerDark: '#1F2937',
    centerMid: '#94A3B8',
    centerLight: '#F8FAFC',
    rimDark: '#334155',
    rimLight: '#E2E8F0',
    starHi: '#FFFFFF',
    starLo: '#94A3B8',
    starOutline: '#475569',
  },
  // Élite — or 24 carats
  elite: {
    ribbonShadow: '#78350F',
    ribbonBase: '#B45309',
    ribbonHi: '#FDE68A',
    pleatDark: '#B45309',
    pleatLight: '#FEF3C7',
    pleatEdge: '#78350F',
    centerDark: '#78350F',
    centerMid: '#F59E0B',
    centerLight: '#FEF3C7',
    rimDark: '#92400E',
    rimLight: '#FFFBEB',
    starHi: '#FFFBEB',
    starLo: '#D97706',
    starOutline: '#7C2D12',
  },
};

const SIZE_PX: Record<Size, number> = { xs: 18, sm: 24, md: 36, lg: 56 };

interface Props {
  level: UserLevel;
  size?: Size;
}

// Étoile 5 branches centrée
function starPoints(cx: number, cy: number, r: number): string {
  const inner = r * 0.42;
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const radius = i % 2 === 0 ? r : inner;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    pts.push(`${cx + radius * Math.cos(a)},${cy + radius * Math.sin(a)}`);
  }
  return pts.join(' ');
}

// Construit le path d'un secteur (pleat) de la cocarde
function sectorPath(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const x0 = cx + r * Math.cos(a0);
  const y0 = cy + r * Math.sin(a0);
  const x1 = cx + r * Math.cos(a1);
  const y1 = cy + r * Math.sin(a1);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} Z`;
}

export function LevelMedal({ level, size = 'sm' }: Props) {
  const p = PALETTE[level];
  const px = SIZE_PX[size];

  // Viewbox 100×144 : cocarde 100×100 + rubans 44px
  const W = 100;
  const H = 144;
  const cx = 50;
  const cy = 50;
  const rOuter = 42; // cocarde plissée
  const rRim   = 26; // anneau métallique
  const rCenter = 22; // disque central
  const rStar = rCenter * 0.68;

  // 12 secteurs alternés
  const N_PLEATS = 12;
  const sectors = Array.from({ length: N_PLEATS }, (_, i) => {
    const a0 = (i / N_PLEATS) * Math.PI * 2 - Math.PI / 2;
    const a1 = ((i + 1) / N_PLEATS) * Math.PI * 2 - Math.PI / 2;
    return { a0, a1, light: i % 2 === 0 };
  });

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
          {/* Ruban : gradient longitudinal avec hi-light central */}
          <SvgLinearGradient id={`${gid}-ribbon`} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={p.ribbonShadow} />
            <Stop offset="0.45" stopColor={p.ribbonHi} />
            <Stop offset="0.55" stopColor={p.ribbonHi} />
            <Stop offset="1" stopColor={p.ribbonShadow} />
          </SvgLinearGradient>

          {/* Pleat light → highlight diagonal */}
          <SvgLinearGradient id={`${gid}-pleat-light`} x1="0" y1="0" x2="0.5" y2="1">
            <Stop offset="0" stopColor={p.pleatLight} />
            <Stop offset="1" stopColor={p.pleatDark} />
          </SvgLinearGradient>
          <SvgLinearGradient id={`${gid}-pleat-dark`} x1="0" y1="0" x2="0.5" y2="1">
            <Stop offset="0" stopColor={p.pleatDark} />
            <Stop offset="1" stopColor={p.pleatEdge} />
          </SvgLinearGradient>

          {/* Anneau métallique (or / argent) — radial dégradé */}
          <RadialGradient id={`${gid}-rim`} cx="0.5" cy="0.35" r="0.65">
            <Stop offset="0" stopColor={p.rimLight} />
            <Stop offset="0.7" stopColor={p.rimLight} stopOpacity="0.7" />
            <Stop offset="1" stopColor={p.rimDark} />
          </RadialGradient>

          {/* Médaillon central — radial profond */}
          <RadialGradient id={`${gid}-center`} cx="0.4" cy="0.3" r="0.75">
            <Stop offset="0" stopColor={p.centerLight} />
            <Stop offset="0.55" stopColor={p.centerMid} />
            <Stop offset="1" stopColor={p.centerDark} />
          </RadialGradient>

          {/* Reflet diagonal lumineux */}
          <SvgLinearGradient id={`${gid}-shine`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.6" />
            <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity="0.12" />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
          </SvgLinearGradient>

          {/* Étoile — gradient diagonal lumineux */}
          <SvgLinearGradient id={`${gid}-star`} x1="0.2" y1="0" x2="0.8" y2="1">
            <Stop offset="0" stopColor={p.starHi} />
            <Stop offset="1" stopColor={p.starLo} />
          </SvgLinearGradient>

          {/* Ombre portée subtile (sous tout l'ensemble) */}
          <RadialGradient id={`${gid}-shadow`} cx="0.5" cy="0.5" r="0.5">
            <Stop offset="0" stopColor="#000" stopOpacity="0.28" />
            <Stop offset="1" stopColor="#000" stopOpacity="0" />
          </RadialGradient>
        </Defs>

        {/* Ombre portée */}
        <Ellipse cx={cx} cy={H - 6} rx={26} ry={4} fill={`url(#${gid}-shadow)`} />

        {/* ── RUBANS du bas ───────────────────────────────────────────── */}
        {/* Tail gauche (avec pli central) */}
        <Path
          d="M 38 78 L 50 78 L 47 100 L 43 140 L 27 134 L 35 100 Z"
          fill={`url(#${gid}-ribbon)`}
          stroke={p.ribbonShadow}
          strokeWidth="0.6"
          strokeLinejoin="round"
        />
        {/* V-cut en bas du ruban gauche (ombre interne) */}
        <Polygon points="27,134 35,128 43,140" fill={p.ribbonShadow} opacity="0.5" />

        {/* Tail droite */}
        <Path
          d="M 50 78 L 62 78 L 65 100 L 73 134 L 57 140 L 53 100 Z"
          fill={`url(#${gid}-ribbon)`}
          stroke={p.ribbonShadow}
          strokeWidth="0.6"
          strokeLinejoin="round"
        />
        <Polygon points="73,134 65,128 57,140" fill={p.ribbonShadow} opacity="0.5" />

        {/* Nœud central (le pli qui maintient les rubans) */}
        <Path
          d="M 40 76 L 60 76 L 56 92 L 44 92 Z"
          fill={p.ribbonShadow}
          opacity="0.85"
        />
        <Path
          d="M 41 76 L 59 76 L 56 80 L 44 80 Z"
          fill={p.ribbonHi}
          opacity="0.7"
        />

        {/* ── COCARDE plissée extérieure ─────────────────────────────── */}
        {/* 12 secteurs alternés (effet plissé satin) */}
        <G>
          {sectors.map((s, i) => (
            <Path
              key={`sec-${i}`}
              d={sectorPath(cx, cy, rOuter, s.a0, s.a1)}
              fill={s.light ? `url(#${gid}-pleat-light)` : `url(#${gid}-pleat-dark)`}
            />
          ))}
        </G>
        {/* Cercle bordure cocarde */}
        <Circle
          cx={cx}
          cy={cy}
          r={rOuter}
          fill="none"
          stroke={p.pleatEdge}
          strokeWidth="1.2"
        />
        {/* Reflet supérieur sur cocarde (ellipse douce) */}
        <Ellipse
          cx={cx}
          cy={cy - rOuter * 0.55}
          rx={rOuter * 0.65}
          ry={rOuter * 0.18}
          fill={`url(#${gid}-shine)`}
        />

        {/* ── ANNEAU MÉTALLIQUE intérieur (or/argent) ─────────────────── */}
        <Circle
          cx={cx}
          cy={cy}
          r={rRim}
          fill={`url(#${gid}-rim)`}
          stroke={p.rimDark}
          strokeWidth="0.8"
        />
        {/* Hairline lumineuse interne du rim */}
        <Circle
          cx={cx}
          cy={cy}
          r={rRim - 1.6}
          fill="none"
          stroke={p.rimLight}
          strokeWidth="0.35"
          opacity="0.8"
        />

        {/* ── MÉDAILLON central ──────────────────────────────────────── */}
        <Circle
          cx={cx}
          cy={cy}
          r={rCenter}
          fill={`url(#${gid}-center)`}
          stroke={p.centerDark}
          strokeWidth="0.8"
        />
        {/* Reflet supérieur (ellipse blanc translucide) */}
        <Ellipse
          cx={cx - 2}
          cy={cy - rCenter * 0.42}
          rx={rCenter * 0.55}
          ry={rCenter * 0.28}
          fill={`url(#${gid}-shine)`}
        />

        {/* ── ÉTOILE centrale polie ─────────────────────────────────── */}
        <Polygon
          points={starPoints(cx, cy, rStar)}
          fill={`url(#${gid}-star)`}
          stroke={p.starOutline}
          strokeWidth="0.6"
          strokeLinejoin="round"
        />
        {/* Reflet sur l'étoile (mini ellipse) */}
        <Ellipse
          cx={cx - rStar * 0.3}
          cy={cy - rStar * 0.4}
          rx={rStar * 0.3}
          ry={rStar * 0.15}
          fill="#FFFFFF"
          opacity="0.5"
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
