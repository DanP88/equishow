// ─────────────────────────────────────────────────────────────────────────────
// useFollow — graphe social (PR1, mig 088 public.user_follows).
//
// Follow ASYMÉTRIQUE type Instagram : suivre = INSERT, désuivre = DELETE, pas
// de demande/acceptation. Persistance Supabase (remplace l'ancien mock store).
//
// API rétro-compatible avec les écrans existants (view-coach / user-profile) :
//   { following, toggle, followersCount, followingCount }
// + API explicite demandée : { isFollowing, loading, follow, unfollow, toggleFollow }.
//
// Robustesse : pas de crash si non connecté (no-op), et si targetUserId n'est
// pas un UUID réel (écran encore sur ID mock) → no-op gracieux (DETTE : câbler
// les écrans profil sur de vrais users.id pour persister le follow).
//
// Ne touche NI payments NI escrow NI Stripe.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import { trackCta } from '../lib/analytics';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function countRows(column: 'follower_id' | 'followee_id', userId: string): Promise<number> {
  const { count } = await supabase
    .from('user_follows')
    .select('*', { count: 'exact', head: true })
    .eq(column, userId);
  return count ?? 0;
}

export function useFollow(targetUserId: string) {
  const { authUser } = useAuth();
  const myId = authUser?.id ?? null;

  const validTarget = typeof targetUserId === 'string' && UUID_RE.test(targetUserId);
  const isSelf = !!myId && myId === targetUserId;

  const [following, setFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!validTarget) {
      setFollowing(false);
      setFollowersCount(0);
      setFollowingCount(0);
      return;
    }
    try {
      // Suis-je déjà la cible ?
      if (myId && !isSelf) {
        const { data } = await supabase
          .from('user_follows')
          .select('followee_id')
          .eq('follower_id', myId)
          .eq('followee_id', targetUserId)
          .maybeSingle();
        setFollowing(!!data);
      } else {
        setFollowing(false);
      }
      // Compteurs du profil cible.
      setFollowersCount(await countRows('followee_id', targetUserId)); // qui suit la cible
      setFollowingCount(await countRows('follower_id', targetUserId)); // qui la cible suit
    } catch {
      /* lecture best-effort : on n'altère pas l'UI en cas d'erreur réseau */
    }
  }, [myId, targetUserId, validTarget, isSelf]);

  useEffect(() => {
    void load();
  }, [load]);

  const follow = useCallback(async () => {
    if (!myId || !validTarget || isSelf || following) return;
    setLoading(true);
    setFollowing(true);
    setFollowersCount((c) => c + 1); // optimistic
    trackCta('follow', 'follow_click', { target: targetUserId });
    const { error } = await supabase
      .from('user_follows')
      .insert({ follower_id: myId, followee_id: targetUserId });
    if (error) {
      setFollowing(false);
      setFollowersCount((c) => Math.max(0, c - 1)); // rollback
    }
    setLoading(false);
  }, [myId, targetUserId, validTarget, isSelf, following]);

  const unfollow = useCallback(async () => {
    if (!myId || !validTarget || !following) return;
    setLoading(true);
    setFollowing(false);
    setFollowersCount((c) => Math.max(0, c - 1)); // optimistic
    trackCta('follow', 'unfollow_click', { target: targetUserId });
    const { error } = await supabase
      .from('user_follows')
      .delete()
      .eq('follower_id', myId)
      .eq('followee_id', targetUserId);
    if (error) {
      setFollowing(true);
      setFollowersCount((c) => c + 1); // rollback
    }
    setLoading(false);
  }, [myId, targetUserId, validTarget, following]);

  const toggleFollow = useCallback(() => {
    return following ? unfollow() : follow();
  }, [following, follow, unfollow]);

  return {
    // état
    following,
    isFollowing: following,
    followersCount,
    followingCount,
    loading,
    isSelf,
    canFollow: !!myId && validTarget && !isSelf,
    // actions
    follow,
    unfollow,
    toggleFollow,
    toggle: toggleFollow, // alias rétro-compatible (écrans existants)
  };
}

/** Stats follow de l'utilisateur courant (followers / following). */
export function useMyFollowStats() {
  const { authUser } = useAuth();
  const myId = authUser?.id ?? null;
  const [followers, setFollowers] = useState(0);
  const [following, setFollowing] = useState(0);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!myId) {
        if (active) {
          setFollowers(0);
          setFollowing(0);
        }
        return;
      }
      const f = await countRows('followee_id', myId);
      const g = await countRows('follower_id', myId);
      if (active) {
        setFollowers(f);
        setFollowing(g);
      }
    })();
    return () => {
      active = false;
    };
  }, [myId]);

  return { followers, following };
}
