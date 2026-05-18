// ─────────────────────────────────────────────────────────────────────────────
// <CertifiedSeal /> — Sceau de certification "Coach Certifié"
//
// Distinct de LevelMedal (cocarde rosette) pour qu'on ne confonde jamais :
//   - LevelMedal  = mérite progressif (rosette + ruban)
//   - CertifiedSeal = sceau de validation (sceau rond cranté or + bleu)
//
// Style : sceau notarial / médaille d'authentification.
//   - Bord cranté or (effet "sceau" tamponné)
//   - Anneau bleu cobalt profond
//   - Disque central bleu marine avec checkmark blanc en relief
//   - 5 petites étoiles dorées en couronne (référence cavalerie)
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

type Size = 'xs' | 'sm' | 'md' | 'lg';
const SIZE_PX: Record<Size, number> = { xs: 13, sm: 17, md: 28, lg: 50 };

interface Props {
  size?: Size;
}

// Couronne crantée (notch border) — 24 dents
function crenelatedPath(cx: number, cy: number, rOut: number, rIn: number, teeth = 24): string {
  const pts: string[] = [];
  for (let i = 0; i < teeth * 2; i++) {
    const r = i % 2 === 0 ? rOut : rIn;
    const a = (i * Math.PI) / teeth - Math.PI / 2;
    pts.push(`${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`);
  }
  return pts.join(' ');
}

// Étoile 5 branches
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

export function CertifiedSeal({ size = 'sm' }: Props) {
  const px = SIZE_PX[size];
  const W = 100;
  const cx = 50;
  const cy = 50;

  return (
    <View style={[styles.container, { width: px, height: px }]}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${W}`}>
        <Defs>
          {/* Or massif pour bord cranté */}
          <RadialGradient id="cs-gold" cx="0.4" cy="0.3" r="0.7">
            <Stop offset="0" stopColor="#FEF3C7" />
            <Stop offset="0.55" stopColor="#F59E0B" />
            <Stop offset="1" stopColor="#92400E" />
          </RadialGradient>

          {/* Anneau bleu cobalt */}
          <RadialGradient id="cs-blue-ring" cx="0.5" cy="0.3" r="0.7">
            <Stop offset="0" stopColor="#60A5FA" />
            <Stop offset="0.5" stopColor="#2563EB" />
            <Stop offset="1" stopColor="#1E3A8A" />
          </RadialGradient>

          {/* Disque central marine profond */}
          <RadialGradient id="cs-center" cx="0.4" cy="0.3" r="0.75">
            <Stop offset="0" stopColor="#3B82F6" />
            <Stop offset="0.55" stopColor="#1D4ED8" />
            <Stop offset="1" stopColor="#1E3A8A" />
          </RadialGradient>

          {/* Reflet vertical haut */}
          <SvgLinearGradient id="cs-shine" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.65" />
            <Stop offset="0.55" stopColor="#FFFFFF" stopOpacity="0.08" />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
          </SvgLinearGradient>

          {/* Ombre portée subtile */}
          <RadialGradient id="cs-shadow" cx="0.5" cy="0.5" r="0.5">
            <Stop offset="0" stopColor="#000" stopOpacity="0.28" />
            <Stop offset="1" stopColor="#000" stopOpacity="0" />
          </RadialGradient>
        </Defs>

        {/* Ombre portée */}
        <Ellipse cx={cx} cy={94} rx={26} ry={3} fill="url(#cs-shadow)" />

        {/* ── BORD CRANTÉ OR (sceau tamponné) ─────────────────────────── */}
        <Polygon
          points={crenelatedPath(cx, cy, 46, 41, 24)}
          fill="url(#cs-gold)"
          stroke="#78350F"
          strokeWidth="0.6"
        />

        {/* ── ANNEAU BLEU ──────────────────────────────────────────── */}
        <Circle cx={cx} cy={cy} r="36" fill="url(#cs-blue-ring)" stroke="#1E3A8A" strokeWidth="1" />

        {/* ── COURONNE D'ÉTOILES OR (5 petites) ──────────────────────── */}
        <G>
          {[0, 1, 2, 3, 4].map((i) => {
            // Disposées en arc inférieur (-50° à +50° du bas)
            const angle = (-Math.PI / 2) + Math.PI + ((i - 2) * (Math.PI / 7));
            const r = 31;
            const sx = cx + r * Math.cos(angle);
            const sy = cy + r * Math.sin(angle);
            return (
              <Polygon
                key={i}
                points={starPoints(sx, sy, 3)}
                fill="#FCD34D"
                stroke="#92400E"
                strokeWidth="0.3"
              />
            );
          })}
        </G>

        {/* ── DISQUE CENTRAL marine ──────────────────────────────────── */}
        <Circle cx={cx} cy={cy} r="26" fill="url(#cs-center)" stroke="#1E3A8A" strokeWidth="0.8" />

        {/* Reflet supérieur du disque */}
        <Ellipse cx={cx - 2} cy={cy - 10} rx={16} ry={8} fill="url(#cs-shine)" />

        {/* ── CHECKMARK central blanc ─────────────────────────────────── */}
        <Path
          d="M 36 50 L 46 60 L 64 40"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Ombre fine sur le checkmark pour relief */}
        <Path
          d="M 36 50 L 46 60 L 64 40"
          fill="none"
          stroke="#1E3A8A"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.25"
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
