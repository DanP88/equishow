// ─────────────────────────────────────────────────────────────────────────────
// Badges & niveaux — design tokens + helpers
//
// Source de vérité backend : public.level_thresholds + public.points_config.
// Côté front on duplique les seuils en fallback si la table n'a pas répondu.
// Les composants <UserBadge /> consomment ces tokens.
// ─────────────────────────────────────────────────────────────────────────────

export type UserLevel = 'debutant' | 'passionne' | 'confirme' | 'expert' | 'elite';

export interface LevelStyle {
  bg: string;
  fg: string;
  label: string;
  minPoints: number;
}

// Fallback côté front (en cas de fetch level_thresholds échoué)
export const LEVEL_STYLE: Record<UserLevel, LevelStyle> = {
  debutant:  { bg: '#F3F4F6', fg: '#6B7280', label: 'Débutant',  minPoints: 0    },
  passionne: { bg: '#DBEAFE', fg: '#1D4ED8', label: 'Passionné', minPoints: 100  },
  confirme:  { bg: '#DCFCE7', fg: '#15803D', label: 'Confirmé',  minPoints: 300  },
  expert:    { bg: '#FEF3C7', fg: '#B45309', label: 'Expert',    minPoints: 700  },
  elite:     { bg: '#FCE7F3', fg: '#9D174D', label: 'Élite',     minPoints: 1500 },
};

export const LEVELS_ORDER: UserLevel[] = [
  'debutant', 'passionne', 'confirme', 'expert', 'elite',
];

export function isValidLevel(s: string | null | undefined): s is UserLevel {
  return !!s && (LEVELS_ORDER as string[]).includes(s);
}

// Calcule la progression vers le niveau suivant. Renvoie 1.0 si elite (max).
export function getLevelProgress(
  points: number,
  level: UserLevel,
): { nextLevel: UserLevel | null; nextMin: number; progressPct: number } {
  const idx = LEVELS_ORDER.indexOf(level);
  const next = LEVELS_ORDER[idx + 1] ?? null;
  if (!next) {
    return { nextLevel: null, nextMin: LEVEL_STYLE[level].minPoints, progressPct: 1 };
  }
  const curMin = LEVEL_STYLE[level].minPoints;
  const nextMin = LEVEL_STYLE[next].minPoints;
  const span = Math.max(1, nextMin - curMin);
  const within = Math.max(0, points - curMin);
  const pct = Math.min(1, within / span);
  return { nextLevel: next, nextMin, progressPct: pct };
}

// Détermine le niveau depuis un total de points (fallback si users.level absent)
export function levelFromPoints(points: number): UserLevel {
  let result: UserLevel = 'debutant';
  for (const lvl of LEVELS_ORDER) {
    if (points >= LEVEL_STYLE[lvl].minPoints) result = lvl;
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Badges coach
// ─────────────────────────────────────────────────────────────────────────────

export interface CoachBadgeStyle {
  bg: string;
  fg: string;
  border: string;
  label: string;
  icon: string;
}

export const COACH_BADGES: Record<'certified' | 'boost', CoachBadgeStyle> = {
  certified: {
    bg:     '#DBEAFE',
    fg:     '#1E40AF',
    border: '#93C5FD',
    label:  'Coach Certifié',
    icon:   '✓',
  },
  boost: {
    bg:     '#FEF3C7',
    fg:     '#92400E',
    border: '#F59E0B',
    label:  'Boost',
    icon:   '⭐',
  },
};
