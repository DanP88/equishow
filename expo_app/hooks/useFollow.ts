import { useState, useCallback } from 'react';
import { userStore } from '../data/store';
import { isFollowing, getFollowers, getFollowing, toggleFollow } from '../data/store';

export function useFollow(targetUserId: string) {
  const [, setTick] = useState(0);

  const following = isFollowing(userStore.id, targetUserId);
  const followersCount = getFollowers(targetUserId).length;
  const followingCount = getFollowing(targetUserId).length;

  const toggle = useCallback(() => {
    toggleFollow(userStore.id, targetUserId);
    setTick(t => t + 1);
  }, [targetUserId]);

  return { following, toggle, followersCount, followingCount };
}

/** Pour le profil propre de l'utilisateur */
export function useMyFollowStats() {
  const followers = getFollowers(userStore.id).length;
  const following = getFollowing(userStore.id).length;
  return { followers, following };
}
