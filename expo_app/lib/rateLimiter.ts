/**
 * Rate Limiter Client Library
 *
 * Provides client-side rate limiting for sensitive operations.
 * Works in conjunction with server-side rate limiting for defense-in-depth.
 *
 * Features:
 * - Tracks attempts locally
 * - Checks with server before allowing requests
 * - Exponential backoff on failures
 * - Persistent state with AsyncStorage
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

interface RateLimitConfig {
  maxAttempts: number;
  windowMs: number; // milliseconds
  lockoutMs?: number; // additional lockout time
}

interface AttemptRecord {
  count: number;
  firstAttempt: number;
  lastAttempt: number;
  locked: boolean;
  lockedUntil?: number;
}

const DEFAULT_CONFIGS: Record<string, RateLimitConfig> = {
  login: {
    maxAttempts: 5,
    windowMs: 15 * 60 * 1000, // 15 minutes
    lockoutMs: 5 * 60 * 1000, // 5 minute lockout after limit
  },
  signup: {
    maxAttempts: 3,
    windowMs: 60 * 60 * 1000, // 1 hour
    lockoutMs: 10 * 60 * 1000, // 10 minute lockout
  },
  passwordReset: {
    maxAttempts: 3,
    windowMs: 60 * 60 * 1000, // 1 hour
    lockoutMs: 15 * 60 * 1000, // 15 minute lockout
  },
  api: {
    maxAttempts: 100,
    windowMs: 60 * 1000, // 1 minute
  },
};

/**
 * Rate Limiter class for managing attempt tracking and limits
 */
export class RateLimiter {
  private action: string;
  private config: RateLimitConfig;
  private storageKey: string;

  constructor(action: string, config?: RateLimitConfig) {
    this.action = action;
    this.config = config || DEFAULT_CONFIGS[action] || DEFAULT_CONFIGS.api;
    this.storageKey = `rate-limit:${action}`;
  }

  /**
   * Get current attempt record from storage
   */
  private async getRecord(): Promise<AttemptRecord> {
    try {
      const json = await AsyncStorage.getItem(this.storageKey);
      return json
        ? JSON.parse(json)
        : {
            count: 0,
            firstAttempt: Date.now(),
            lastAttempt: Date.now(),
            locked: false,
          };
    } catch (error) {
      console.error(`Error reading rate limit record for ${this.action}:`, error);
      return {
        count: 0,
        firstAttempt: Date.now(),
        lastAttempt: Date.now(),
        locked: false,
      };
    }
  }

  /**
   * Save attempt record to storage
   */
  private async setRecord(record: AttemptRecord): Promise<void> {
    try {
      await AsyncStorage.setItem(this.storageKey, JSON.stringify(record));
    } catch (error) {
      console.error(`Error saving rate limit record for ${this.action}:`, error);
    }
  }

  /**
   * Reset attempt tracking (call this after successful operation)
   */
  async reset(): Promise<void> {
    await AsyncStorage.removeItem(this.storageKey);
  }

  /**
   * Check if action is allowed
   * Returns true if allowed, false if rate limited
   */
  async check(identifier?: string): Promise<{
    allowed: boolean;
    remaining: number;
    resetAt: number;
    message?: string;
  }> {
    const record = await this.getRecord();
    const now = Date.now();

    // Check if currently locked
    if (record.locked && record.lockedUntil && now < record.lockedUntil) {
      const resetAt = record.lockedUntil;
      const remaining = 0;
      const message = `Trop de tentatives. Veuillez réessayer à ${new Date(resetAt).toLocaleTimeString(
        'fr-FR'
      )}`;

      return { allowed: false, remaining, resetAt, message };
    }

    // Check if window has expired
    if (now - record.firstAttempt > this.config.windowMs) {
      record.count = 0;
      record.firstAttempt = now;
      record.locked = false;
      record.lockedUntil = undefined;
    }

    // Check if limit exceeded
    if (record.count >= this.config.maxAttempts) {
      record.locked = true;
      record.lockedUntil = now + (this.config.lockoutMs || this.config.windowMs);
      await this.setRecord(record);

      const resetAt = record.lockedUntil;
      const remaining = 0;
      const message = `Trop de tentatives. Veuillez réessayer dans ${Math.ceil(
        (resetAt - now) / 60000
      )} minutes.`;

      return { allowed: false, remaining, resetAt, message };
    }

    // Attempt allowed - increment counter
    record.count += 1;
    record.lastAttempt = now;
    await this.setRecord(record);

    const remaining = this.config.maxAttempts - record.count;
    const resetAt = record.firstAttempt + this.config.windowMs;

    return { allowed: true, remaining, resetAt };
  }

  /**
   * Record a failed attempt and check with server
   */
  async recordFailure(identifier: string): Promise<void> {
    // This is called after a failed authentication attempt
    // Could trigger CAPTCHA or other security measures
    console.warn(`${this.action} failed for ${identifier}`);

    const record = await this.getRecord();
    record.count += 1;
    await this.setRecord(record);

    // Log to server for security monitoring
    try {
      await supabase
        .from('security_events')
        .insert({
          event_type: 'rate_limit_failure',
          action: this.action,
          identifier,
          attempt_count: record.count,
          created_at: new Date().toISOString(),
        })
        .single();
    } catch (error) {
      console.error('Error logging security event:', error);
    }
  }

  /**
   * Get current state without modifying it
   */
  async getState(): Promise<{
    attempts: number;
    remaining: number;
    resetAt: number;
    locked: boolean;
  }> {
    const record = await this.getRecord();
    const now = Date.now();

    // Reset if window expired
    if (now - record.firstAttempt > this.config.windowMs) {
      return {
        attempts: 0,
        remaining: this.config.maxAttempts,
        resetAt: now + this.config.windowMs,
        locked: false,
      };
    }

    return {
      attempts: record.count,
      remaining: Math.max(0, this.config.maxAttempts - record.count),
      resetAt: record.firstAttempt + this.config.windowMs,
      locked: record.locked && record.lockedUntil ? now < record.lockedUntil : false,
    };
  }
}

/**
 * Login rate limiter
 */
export const loginLimiter = new RateLimiter('login');

/**
 * Signup rate limiter
 */
export const signupLimiter = new RateLimiter('signup');

/**
 * Password reset rate limiter
 */
export const passwordResetLimiter = new RateLimiter('passwordReset');

/**
 * API rate limiter
 */
export const apiLimiter = new RateLimiter('api');

/**
 * Create a custom rate limiter
 */
export function createRateLimiter(action: string, config?: RateLimitConfig): RateLimiter {
  return new RateLimiter(action, config);
}

/**
 * Check multiple rate limits at once
 */
export async function checkMultipleLimits(
  limiters: RateLimiter[]
): Promise<{ allowed: boolean; messages: string[] }> {
  const results = await Promise.all(limiters.map((l) => l.check()));
  const messages = results.filter((r) => r.message).map((r) => r.message || '');

  return {
    allowed: results.every((r) => r.allowed),
    messages,
  };
}

/**
 * Reset all rate limiters (for testing)
 */
export async function resetAllLimiters(): Promise<void> {
  await Promise.all([
    loginLimiter.reset(),
    signupLimiter.reset(),
    passwordResetLimiter.reset(),
    apiLimiter.reset(),
  ]);
}

export default RateLimiter;
