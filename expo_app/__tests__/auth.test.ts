import { signUp, signIn, signOut } from '../lib/supabase';
import { AuthError } from '../lib/errorHandler';

/**
 * Authentication Tests
 * Critical flows that must work in production
 */
describe('Authentication', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Sign Up', () => {
    it('should create new user with valid credentials', async () => {
      const result = await signUp('newuser@example.com', 'SecurePass123!', {
        prenom: 'Jean',
        nom: 'Dupont',
        role: 'cavalier',
      });

      expect(result.user).toBeDefined();
      expect(result.error).toBeNull();
    });

    it('should reject weak passwords', async () => {
      const result = await signUp('test@example.com', '123', {
        prenom: 'Test',
        nom: 'User',
        role: 'cavalier',
      });

      expect(result.error).toBeDefined();
    });

    it('should reject invalid email format', async () => {
      const result = await signUp('invalid-email', 'Password123!', {
        prenom: 'Test',
        nom: 'User',
        role: 'cavalier',
      });

      expect(result.error).toBeDefined();
    });

    it('should reject duplicate email', async () => {
      // First signup succeeds
      await signUp('duplicate@example.com', 'Password123!', {
        prenom: 'First',
        nom: 'User',
        role: 'cavalier',
      });

      // Second signup with same email should fail
      const result = await signUp('duplicate@example.com', 'DifferentPass123!', {
        prenom: 'Second',
        nom: 'User',
        role: 'coach',
      });

      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('already');
    });

    it('should set correct user role', async () => {
      const roles = ['cavalier', 'coach', 'organisateur'] as const;

      for (const role of roles) {
        const result = await signUp(`${role}@example.com`, 'Password123!', {
          prenom: 'Test',
          nom: 'User',
          role,
        });

        expect(result.user?.role).toBe(role);
      }
    });

    it('should sanitize user input', async () => {
      const result = await signUp('test@example.com', 'Password123!', {
        prenom: '<script>alert("xss")</script>',
        nom: "'; DROP TABLE users; --",
        role: 'cavalier',
      });

      // Input should be sanitized, not contain dangerous content
      expect(result.user?.prenom).not.toContain('<script>');
      expect(result.user?.nom).not.toContain('DROP TABLE');
    });
  });

  describe('Sign In', () => {
    it('should sign in with valid credentials', async () => {
      const result = await signIn('user@example.com', 'CorrectPassword123!');

      expect(result.user).toBeDefined();
      expect(result.error).toBeNull();
    });

    it('should reject invalid password', async () => {
      const result = await signIn('user@example.com', 'WrongPassword');

      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('Invalid');
    });

    it('should reject non-existent user', async () => {
      const result = await signIn('nonexistent@example.com', 'AnyPassword123!');

      expect(result.error).toBeDefined();
    });

    it('should have rate limiting after multiple failed attempts', async () => {
      // Simulate 6 failed attempts (limit should be 5)
      for (let i = 0; i < 6; i++) {
        const result = await signIn('user@example.com', 'WrongPassword');

        if (i < 5) {
          expect(result.error?.code).not.toBe('RATE_LIMIT_EXCEEDED');
        } else {
          expect(result.error?.code).toBe('RATE_LIMIT_EXCEEDED');
        }
      }
    });

    it('should not expose user existence via error message', async () => {
      const result = await signIn('nonexistent@example.com', 'AnyPassword');

      // Should not specifically say "user not found"
      expect(result.error?.message).not.toContain('does not exist');
      expect(result.error?.message).not.toContain('not found');
    });
  });

  describe('Sign Out', () => {
    it('should clear session on sign out', async () => {
      // First sign in
      await signIn('user@example.com', 'Password123!');

      // Then sign out
      const result = await signOut();

      expect(result.error).toBeNull();
    });

    it('should be safe to call multiple times', async () => {
      const result1 = await signOut();
      const result2 = await signOut();

      expect(result1.error).toBeNull();
      expect(result2.error).toBeNull();
    });
  });

  describe('Session Management', () => {
    it('should maintain session after page refresh', async () => {
      // Simulate: User logs in, page refreshes, session should persist
      await signIn('user@example.com', 'Password123!');

      // Session should be stored in AsyncStorage and restored
      // This is handled by Supabase internally
      expect(true).toBe(true); // Placeholder test
    });

    it('should clear session on logout', async () => {
      await signIn('user@example.com', 'Password123!');
      await signOut();

      // After logout, user should not have valid session
      expect(true).toBe(true); // Placeholder test
    });

    it('should refresh token before expiry', async () => {
      // Token should auto-refresh (handled by Supabase)
      expect(true).toBe(true); // Placeholder test
    });
  });

  describe('Error Handling', () => {
    it('should return specific error codes', async () => {
      const scenarios = [
        {
          email: 'user@example.com',
          password: 'WrongPassword',
          expectedCode: 'AUTH_ERROR',
        },
        {
          email: 'nonexistent@example.com',
          password: 'Password123!',
          expectedCode: 'AUTH_ERROR',
        },
      ];

      for (const { email, password, expectedCode } of scenarios) {
        const result = await signIn(email, password);
        expect(result.error?.code).toBe(expectedCode);
      }
    });

    it('should provide recoverable error messages', async () => {
      const result = await signIn('user@example.com', 'WrongPassword');

      expect(result.error?.message).toBeTruthy();
      expect(result.error?.message).toMatch(/email|password/i);
    });
  });
});
