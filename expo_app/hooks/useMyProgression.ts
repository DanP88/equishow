// ─────────────────────────────────────────────────────────────────────────────
// useMyProgression — points/niveau + progression du user courant.
//
// Pour affichage barre de progression dans le profil cavalier.
// Renvoie aussi nextLevel + pct + delta restant pour next.
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo } from 'react';
import { useAuth } from './useAuth';
import { useUserBadges } from './useUserBadges';
import { LEVEL_STYLE, getLevelProgress } from '../lib/badges';

export function useMyProgression() {
  const { profile } = useAuth();
  const { badges, isLoading } = useUserBadges(profile?.id);

  return useMemo(() => {
    if (!badges) {
      return {
        isLoading,
        points: 0,
        level: 'debutant' as const,
        levelLabel: LEVEL_STYLE.debutant.label,
        nextLevel: 'passionne' as const,
        nextLevelLabel: LEVEL_STYLE.passionne.label,
        nextMin: LEVEL_STYLE.passionne.minPoints,
        progressPct: 0,
        pointsToNext: LEVEL_STYLE.passionne.minPoints,
      };
    }
    const { nextLevel, nextMin, progressPct } = getLevelProgress(badges.points, badges.level);
    return {
      isLoading,
      points: badges.points,
      level: badges.level,
      levelLabel: LEVEL_STYLE[badges.level].label,
      nextLevel,
      nextLevelLabel: nextLevel ? LEVEL_STYLE[nextLevel].label : null,
      nextMin,
      progressPct,
      pointsToNext: nextLevel ? Math.max(0, nextMin - badges.points) : 0,
    };
  }, [badges, isLoading]);
}
