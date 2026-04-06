# 🔒 Rate Limiting Implementation Guide

Comprehensive guide to implementing and configuring rate limiting across the Equishow platform.

---

## Overview

Rate limiting protects the application from:
- **Brute force attacks** on authentication endpoints
- **Account enumeration** attacks
- **API abuse** and DoS attacks
- **Spam submissions**
- **Resource exhaustion**

```
User Action
    ↓
Client-Side Check (RateLimiter)
    ↓
Server-Side Check (Edge Function)
    ↓
Allow/Block with Response Headers
    ↓
Log Security Event
```

---

## Architecture

### Client-Side (expo_app/lib/rateLimiter.ts)

- **Purpose**: Immediate feedback, prevent submission
- **Storage**: AsyncStorage (persistent across app restarts)
- **Scope**: Per-device, per-action tracking
- **Lockout**: Temporary lockout with countdown

### Server-Side (supabase/functions/rate-limit/)

- **Purpose**: Prevent API bypass, distributed tracking
- **Storage**: Supabase or Redis (production)
- **Scope**: Per-identifier (email, IP) tracking
- **Enforcement**: HTTP 429 response code

### Database (security_events table)

- **Purpose**: Security monitoring and abuse tracking
- **Data**: Failed attempts, patterns, automatic blocks
- **Retention**: 90 days for analysis

---

## Configuration

### Default Limits

```typescript
const LIMITS = {
  login: {
    maxAttempts: 5,
    windowMs: 15 * 60 * 1000,      // 15 minutes
    lockoutMs: 5 * 60 * 1000,       // 5 minute additional lockout
  },
  signup: {
    maxAttempts: 3,
    windowMs: 60 * 60 * 1000,       // 1 hour
    lockoutMs: 10 * 60 * 1000,      // 10 minute lockout
  },
  passwordReset: {
    maxAttempts: 3,
    windowMs: 60 * 60 * 1000,       // 1 hour
    lockoutMs: 15 * 60 * 1000,      // 15 minute lockout
  },
  api: {
    maxAttempts: 100,
    windowMs: 60 * 1000,            // 1 minute per 100 requests
  },
};
```

### Customizing Limits

```typescript
import { createRateLimiter } from '../lib/rateLimiter';

// Create custom limiter for specific feature
const invoiceLimiter = createRateLimiter('invoice_download', {
  maxAttempts: 10,
  windowMs: 60 * 1000,        // 10 per minute
  lockoutMs: 60 * 1000,       // 1 minute lockout
});
```

---

## Integration Guide

### 1. Login Screen Integration

**File**: `expo_app/screens/LoginScreen.tsx`

```tsx
import { loginLimiter } from '../lib/rateLimiter';
import useRateLimit from '../hooks/useRateLimit';
import { errorHandler } from '../lib/errorHandler';

export function LoginScreen() {
  const emailRef = useRef<string>('');
  const rateLimit = useRateLimit({
    limiter: loginLimiter,
    identifier: emailRef.current,
    onLimited: (resetAt) => {
      errorHandler.log({
        level: 'warn',
        feature: 'auth',
        message: `Login attempt rate limited until ${new Date(resetAt).toLocaleTimeString()}`
      });
    }
  });

  const handleLogin = async (email: string, password: string) => {
    emailRef.current = email;

    // Check rate limit first
    const allowed = await rateLimit.check();
    if (!allowed) {
      Alert.alert(
        'Trop de tentatives',
        rateLimit.message || 'Veuillez réessayer plus tard',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      
      if (error) {
        // Record failure for rate limiting
        await rateLimit.recordFailure();
        throw error;
      }

      // Success - reset rate limit
      await rateLimit.reset();
      navigateTo('Home');
    } catch (error) {
      errorHandler.handle(error, {
        feature: 'auth',
        action: 'login_failed',
        userId: email
      });
    }
  };

  return (
    <View>
      {/* Display countdown if rate limited */}
      {!rateLimit.isAllowed && (
        <View style={{ padding: 12, backgroundColor: '#fee' }}>
          <Text style={{ color: '#c33' }}>
            🔒 Trop de tentatives. Réessayez dans {rateLimit.resetCountdown}
          </Text>
        </View>
      )}

      <FormField
        label="Email"
        value={email}
        onChangeValue={setEmail}
        disabled={rateLimit.isLoading}
      />

      <FormField
        label="Mot de passe"
        value={password}
        onChangeValue={setPassword}
        secureTextEntry
        disabled={rateLimit.isLoading}
      />

      <Button
        onPress={() => handleLogin(email, password)}
        disabled={!rateLimit.isAllowed || rateLimit.isLoading}
        title={
          rateLimit.isLoading 
            ? 'Vérification...' 
            : rateLimit.isAllowed
            ? 'Se connecter'
            : `Connecter (dans ${rateLimit.minutesUntilReset}m)`
        }
      />
    </View>
  );
}
```

### 2. Signup Screen Integration

```tsx
import { signupLimiter } from '../lib/rateLimiter';
import useRateLimit from '../hooks/useRateLimit';

export function SignupScreen() {
  const emailRef = useRef<string>('');
  const rateLimit = useRateLimit({
    limiter: signupLimiter,
    identifier: emailRef.current,
  });

  const handleSignup = async (email: string, password: string, prenom: string, nom: string) => {
    emailRef.current = email;

    // Check rate limit
    const allowed = await rateLimit.check();
    if (!allowed) {
      Alert.alert('Limitation', rateLimit.message);
      return;
    }

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { prenom, nom } }
      });

      if (error) {
        await rateLimit.recordFailure();
        throw error;
      }

      await rateLimit.reset();
      // Navigate to verification
    } catch (error) {
      // Handle error
    }
  };

  return (
    // Form UI with rate limit state
  );
}
```

### 3. Password Reset Integration

```tsx
import { passwordResetLimiter } from '../lib/rateLimiter';

export function PasswordResetScreen() {
  const emailRef = useRef<string>('');
  const rateLimit = useRateLimit({
    limiter: passwordResetLimiter,
    identifier: emailRef.current,
  });

  const handleSendReset = async (email: string) => {
    emailRef.current = email;

    if (!await rateLimit.check()) {
      Alert.alert('Trop de demandes', rateLimit.message);
      return;
    }

    try {
      await supabase.auth.resetPasswordForEmail(email);
      await rateLimit.reset();
      Alert.alert('Email envoyé', 'Vérifiez votre boîte mail');
    } catch (error) {
      await rateLimit.recordFailure();
      // Handle error
    }
  };

  return (
    // Form UI
  );
}
```

### 4. API Endpoint Protection

```tsx
import { apiLimiter } from '../lib/rateLimiter';

// Fetch wrapper with rate limiting
async function apiCall<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  // Check rate limit
  const allowed = await apiLimiter.check();
  if (!allowed) {
    throw new RateLimitError('Too many requests');
  }

  try {
    const response = await fetch(endpoint, options);
    
    if (response.status === 429) {
      await apiLimiter.recordFailure();
      throw new RateLimitError('Server rate limited');
    }

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  } catch (error) {
    await apiLimiter.recordFailure();
    throw error;
  }
}
```

---

## Monitoring & Alerts

### Security Events Table

```sql
CREATE TABLE security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL, -- 'rate_limit_failure', 'login_attempt', etc
  action TEXT NOT NULL,     -- 'login', 'signup', 'api'
  identifier TEXT NOT NULL, -- email or IP
  attempt_count INT,
  user_id UUID,
  severity TEXT,            -- 'low', 'medium', 'high', 'critical'
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_identifier (identifier),
  INDEX idx_event_type (event_type),
  INDEX idx_created_at (created_at DESC)
);
```

### Alert Thresholds

```typescript
// Auto-block after N consecutive failures
const AUTO_BLOCK_THRESHOLD = 10;

// Escalate to security team after N events in time window
const SECURITY_ESCALATION_THRESHOLD = 20;

// Alert on pattern: same email, multiple IPs
const SUSPICIOUS_IP_THRESHOLD = 3;
```

### Monitoring Query

```sql
-- Recent rate limit failures
SELECT 
  identifier,
  COUNT(*) as failure_count,
  MAX(created_at) as last_attempt
FROM security_events
WHERE event_type = 'rate_limit_failure'
  AND created_at > NOW() - INTERVAL '1 hour'
GROUP BY identifier
HAVING COUNT(*) > 5
ORDER BY failure_count DESC;

-- Suspicious IP patterns
SELECT
  identifier,
  COUNT(DISTINCT metadata->>'client_ip') as unique_ips,
  COUNT(*) as attempts
FROM security_events
WHERE event_type = 'rate_limit_failure'
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY identifier
HAVING COUNT(DISTINCT metadata->>'client_ip') > 2;
```

---

## Testing

### Unit Tests

```typescript
import { RateLimiter } from '../lib/rateLimiter';

describe('RateLimiter', () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter('test', {
      maxAttempts: 3,
      windowMs: 60000
    });
  });

  it('should allow first few attempts', async () => {
    const r1 = await limiter.check();
    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(2);

    const r2 = await limiter.check();
    expect(r2.allowed).toBe(true);
    expect(r2.remaining).toBe(1);
  });

  it('should block after max attempts', async () => {
    await limiter.check();
    await limiter.check();
    await limiter.check();

    const result = await limiter.check();
    expect(result.allowed).toBe(false);
    expect(result.message).toBeDefined();
  });

  it('should reset after window expires', async () => {
    // Set artificially old timestamp
    const record = {
      count: 3,
      firstAttempt: Date.now() - 70000, // 70 seconds ago
      lastAttempt: Date.now() - 70000,
      locked: false
    };

    const result = await limiter.check();
    expect(result.allowed).toBe(true); // Window expired, reset
  });

  it('should persist state in AsyncStorage', async () => {
    await limiter.check();
    const state1 = await limiter.getState();

    // Create new instance
    const limiter2 = new RateLimiter('test');
    const state2 = await limiter2.getState();

    expect(state2.attempts).toBe(state1.attempts);
  });
});
```

### Integration Tests

```typescript
describe('Rate Limiting Integration', () => {
  it('should block login after 5 failed attempts', async () => {
    for (let i = 0; i < 5; i++) {
      await attemptLogin('test@example.com', 'wrong');
      // Should get errors but not rate limited
    }

    // 6th attempt should be rate limited
    const result = await attemptLogin('test@example.com', 'wrong');
    expect(result.rateLimited).toBe(true);
  });

  it('should allow retry after lockout expires', async () => {
    // Trigger rate limit
    for (let i = 0; i < 5; i++) {
      await attemptLogin('test@example.com', 'wrong');
    }

    // Should be blocked
    let result = await attemptLogin('test@example.com', 'correct');
    expect(result.rateLimited).toBe(true);

    // Advance time by lockout period
    jest.useFakeTimers();
    jest.advanceTimersByTime(5 * 60 * 1000); // 5 minutes

    // Should now be allowed
    result = await attemptLogin('test@example.com', 'correct');
    expect(result.rateLimited).toBe(false);

    jest.useRealTimers();
  });
});
```

---

## Production Deployment

### 1. Deploy Edge Function

```bash
# Deploy rate limiting function
supabase functions deploy rate-limit

# Verify deployment
supabase functions list
```

### 2. Create security_events Table

```bash
supabase db push
```

### 3. Configure GitHub Secrets

```
RATE_LIMIT_ENABLED=true
RATE_LIMIT_REDIS_URL=redis://...  # Optional, for distributed caching
```

### 4. Monitor First Week

- Track login attempt patterns
- Watch for false positives (legitimate users hitting limits)
- Adjust thresholds if needed
- Set up Slack alerts for suspicious patterns

### 5. Escalation Procedures

```typescript
// Example: Auto-escalate if pattern detected
async function checkSuspiciousPatterns() {
  const recentFailures = await supabase
    .from('security_events')
    .select('*')
    .where('event_type', 'eq', 'rate_limit_failure')
    .gte('created_at', 'now - 1 hour');

  if (recentFailures.length > 20) {
    // Send alert to security team
    await notifySecurityTeam({
      severity: 'high',
      message: `${recentFailures.length} failed attempts in last hour`
    });
  }
}
```

---

## Performance Considerations

### Client-Side Performance

```typescript
// AsyncStorage operations are async but fast
const start = Date.now();
const allowed = await rateLimit.check();
console.log(`Rate limit check: ${Date.now() - start}ms`);
// Typical: 1-5ms on modern devices
```

### Server-Side Performance

```typescript
// Edge Functions latency
// Typical: 10-50ms including network
// Redis backend: <5ms
// Database backend: 20-50ms
```

### Optimization

- Use Redis for distributed rate limiting (production)
- Cache rate limit checks client-side (already done)
- Batch security events instead of individual inserts
- Archive old events after 90 days

---

## Troubleshooting

### Users Reporting "Too Many Attempts" But No Failed Logins

**Cause**: Browser/app cache showing old limit state

**Solution**:
```tsx
// Add reset button in settings
<Button onPress={() => resetAllLimiters()}>
  Reset Rate Limits
</Button>
```

### Rate Limiting Not Blocking Attacks

**Cause**: Server-side check not enforced

**Solution**: Ensure Edge Function is called before every sensitive operation

### Legitimate Users Blocked During Testing

**Solution**: 
```typescript
// Clear limits for test users
await loginLimiter.reset(); // client-side
// Server-side: delete from rate_limit_store where email = 'test@example.com'
```

### Rate Limit State Not Persisting

**Cause**: AsyncStorage permissions or clearing on app update

**Solution**: Also track server-side and sync state on app launch

---

## Security Best Practices

✅ **DO**:
- Always check rate limits before sensitive operations
- Log security events for monitoring
- Use exponential backoff for retries
- Show user-friendly error messages
- Reset limits after successful operations
- Monitor for attack patterns
- Test with malicious inputs

❌ **DON'T**:
- Expose exact retry times (could help attacker)
- Use only client-side limiting (can be bypassed)
- Block users permanently (always have unlock mechanism)
- Log sensitive data (passwords, tokens)
- Ignore patterns of abuse

---

## Checklist

- [ ] Deploy rate-limit Edge Function
- [ ] Create security_events table
- [ ] Integrate loginLimiter in login screen
- [ ] Integrate signupLimiter in signup screen
- [ ] Integrate passwordResetLimiter in password reset
- [ ] Add API rate limiting to fetch calls
- [ ] Configure monitoring queries
- [ ] Set up Slack alerts
- [ ] Test with malicious inputs
- [ ] Document procedures for security team
- [ ] Monitor first week post-launch
- [ ] Adjust thresholds based on real traffic
- [ ] Archive old security events (90+ days)

---

**Last Updated**: 2026-04-06
**Status**: Production Ready
**Components**: RateLimiter class, useRateLimit hook, rate-limit Edge Function, security monitoring
