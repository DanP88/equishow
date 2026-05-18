// ─────────────────────────────────────────────────────────────────────────────
// useUserBadges — niveau cavalier + badges coach pour un user_id donné.
//
// Charge :
// - users.points / users.level (cavalier progression)
// - coach_profiles.is_certified / is_boosted (si user est coach)
//
// Realtime : écoute users.points (live update progression).
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useId, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { UserLevel, isValidLevel, levelFromPoints } from '../lib/badges';

export interface UserBadges {
  userId: string;
  points: number;
  level: UserLevel;
  isCertified: boolean;
  isBoosted: boolean;
  boostExpiresAt: string | null;
}

interface UserRow {
  id: string;
  points: number | null;
  level: string | null;
}

interface CoachRow {
  user_id: string;
  is_certified: boolean | null;
  is_boosted: boolean | null;
  boost_expires_at: string | null;
}

const EMPTY = (id: string): UserBadges => ({
  userId: id,
  points: 0,
  level: 'debutant',
  isCertified: false,
  isBoosted: false,
  boostExpiresAt: null,
});

export function useUserBadges(userId?: string) {
  const channelId = useId();
  const [badges, setBadges] = useState<UserBadges | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(async () => {
    if (!userId) { setBadges(null); return; }
    setIsLoading(true);
    const [userRes, coachRes] = await Promise.all([
      supabase
        .from('users')
        .select('id,points,level')
        .eq('id', userId)
        .maybeSingle(),
      supabase
        .from('coach_profiles')
        .select('user_id,is_certified,is_boosted,boost_expires_at')
        .eq('user_id', userId)
        .maybeSingle(),
    ]);
    if (userRes.error || !userRes.data) {
      setBadges(EMPTY(userId));
      setIsLoading(false);
      return;
    }
    const u = userRes.data as UserRow;
    const c = (coachRes.data as CoachRow | null) ?? null;
    const points = u.points ?? 0;
    const level: UserLevel = isValidLevel(u.level) ? u.level : levelFromPoints(points);
    setBadges({
      userId,
      points,
      level,
      isCertified: !!c?.is_certified,
      isBoosted:   !!c?.is_boosted,
      boostExpiresAt: c?.boost_expires_at ?? null,
    });
    setIsLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`user-badges-${userId}-${channelId}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'users', filter: `id=eq.${userId}`,
      }, () => load())
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'coach_profiles', filter: `user_id=eq.${userId}`,
      }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, load, channelId]);

  return { badges, isLoading, reload: load };
}
