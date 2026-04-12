/**
 * useRateLimit Hook
 *
 * Manages rate limiting state and UI feedback for rate-limited operations
 * Integrates with RateLimiter for persistent and server-side limits
 */

import { useState, useCallback, useEffect } from 'react';
import { RateLimiter } from '../lib/rateLimiter';

export interface UsRateLimitOptions {
  /**
   * Limiter instance to use
   */
  limiter: RateLimiter;

  /**
   * Optional identifier (email, IP, etc)
   */
  identifier?: string;

  /**
   * Called when rate limit is exceeded
   */
  onLimited?: (resetAt: number) => void;

  /**
   * Called when limit is reset
   */
  onReset?: () => void;
}

export interface UseRateLimitState {
  /**
   * Whether the action is currently allowed
   */
  isAllowed: boolean;

  /**
   * Number of attempts remaining
   */
  remaining: number;

  /**
   * Timestamp when limit resets
   */
  resetAt: number;

  /**
   * Error message if limited
   */
  message?: string;

  /**
   * Whether currently checking limit
   */
  isLoading: boolean;

  /**
   * Check if action is allowed
   */
  check: () => Promise<boolean>;

  /**
   * Record a failure (increment counter)
   */
  recordFailure: () => Promise<void>;

  /**
   * Reset the counter (call after success)
   */
  reset: () => Promise<void>;

  /**
   * Get current state
   */
  getState: () => Promise<{
    attempts: number;
    remaining: number;
    resetAt: number;
    locked: boolean;
  }>;

  /**
   * Minutes until reset
   */
  minutesUntilReset: number;

  /**
   * Countdown timer as formatted string
   */
  resetCountdown: string;
}

export const useRateLimit = (options: UsRateLimitOptions): UseRateLimitState => {
  const { limiter, identifier, onLimited, onReset } = options;

  const [isAllowed, setIsAllowed] = useState(true);
  const [remaining, setRemaining] = useState(0);
  const [resetAt, setResetAt] = useState(0);
  const [message, setMessage] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [minutesUntilReset, setMinutesUntilReset] = useState(0);
  const [resetCountdown, setResetCountdown] = useState('');

  /**
   * Check if action is allowed
   */
  const check = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await limiter.check(identifier);

      setIsAllowed(result.allowed);
      setRemaining(result.remaining);
      setResetAt(result.resetAt);
      setMessage(result.message);

      if (!result.allowed && onLimited) {
        onLimited(result.resetAt);
      }

      return result.allowed;
    } finally {
      setIsLoading(false);
    }
  }, [limiter, identifier, onLimited]);

  /**
   * Record a failed attempt
   */
  const recordFailure = useCallback(async () => {
    if (identifier) {
      await limiter.recordFailure(identifier);
    }
  }, [limiter, identifier]);

  /**
   * Reset the counter
   */
  const reset = useCallback(async () => {
    await limiter.reset();
    setIsAllowed(true);
    setRemaining(0);
    setMessage(undefined);
    if (onReset) onReset();
  }, [limiter, onReset]);

  /**
   * Get current state without modifying
   */
  const getState = useCallback(() => limiter.getState(), [limiter]);

  /**
   * Update countdown timer
   */
  useEffect(() => {
    if (!resetAt || isAllowed) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const diff = Math.max(0, resetAt - now);
      const minutes = Math.ceil(diff / 60000);

      setMinutesUntilReset(minutes);

      if (diff <= 0) {
        setIsAllowed(true);
        setMessage(undefined);
        clearInterval(interval);
      } else {
        // Format as HH:MM:SS or MM:SS
        const seconds = Math.floor((diff / 1000) % 60);
        const mins = Math.floor((diff / 60000) % 60);
        const hours = Math.floor(diff / 3600000);

        if (hours > 0) {
          setResetCountdown(`${hours}h ${mins}m ${seconds}s`);
        } else if (mins > 0) {
          setResetCountdown(`${mins}m ${seconds}s`);
        } else {
          setResetCountdown(`${seconds}s`);
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [resetAt, isAllowed]);

  return {
    isAllowed,
    remaining,
    resetAt,
    message,
    isLoading,
    check,
    recordFailure,
    reset,
    getState,
    minutesUntilReset,
    resetCountdown,
  };
};

export default useRateLimit;
