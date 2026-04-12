import * as Sentry from '@sentry/react-native';
import { Toast } from 'react-native-toast-notifications';

/**
 * Custom Error Types
 */
export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public context?: Record<string, any>
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class NetworkError extends AppError {
  constructor(message: string = 'Network error. Please check your connection.') {
    super(message, 'NETWORK_ERROR', 0);
    this.name = 'NetworkError';
  }
}

export class AuthError extends AppError {
  constructor(message: string = 'Authentication failed') {
    super(message, 'AUTH_ERROR', 401);
    this.name = 'AuthError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string = 'Invalid input', public fields?: Record<string, string>) {
    super(message, 'VALIDATION_ERROR', 400);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, 'NOT_FOUND', 404);
    this.name = 'NotFoundError';
  }
}

export class RateLimitError extends AppError {
  constructor(retryAfter: number = 60) {
    super(
      `Trop de requêtes. Réessayez dans ${retryAfter}s.`,
      'RATE_LIMIT_EXCEEDED',
      429
    );
    this.name = 'RateLimitError';
  }
}

/**
 * User-friendly error messages
 */
const ERROR_MESSAGES: Record<string, string> = {
  NETWORK_ERROR: 'Connexion perdue. Vérifiez votre réseau et réessayez.',
  AUTH_ERROR: 'Authentification échouée. Reconnectez-vous.',
  SESSION_EXPIRED: 'Votre session a expiré. Reconnectez-vous.',
  VALIDATION_ERROR: 'Les données saisies ne sont pas valides.',
  NOT_FOUND: 'La ressource n\'a pas été trouvée.',
  RATE_LIMIT_EXCEEDED: 'Trop de requêtes. Attendez avant de réessayer.',
  DATABASE_ERROR: 'Erreur de base de données. Réessayez plus tard.',
  UNKNOWN_ERROR: 'Une erreur inattendue est survenue.',
  PERMISSION_DENIED: 'Vous n\'avez pas la permission pour cette action.',
  INVALID_INPUT: 'Les données saisies sont invalides.',
};

/**
 * Central Error Handler Service
 */
export const ErrorHandler = {
  /**
   * Format error for user display
   */
  getUserMessage(error: Error | AppError): string {
    if (error instanceof AppError) {
      return ERROR_MESSAGES[error.code] || error.message;
    }

    // Handle Supabase errors
    if (error.message.includes('policy')) {
      return ERROR_MESSAGES.PERMISSION_DENIED;
    }

    if (error.message.includes('connection') || error.message.includes('network')) {
      return ERROR_MESSAGES.NETWORK_ERROR;
    }

    return ERROR_MESSAGES.UNKNOWN_ERROR;
  },

  /**
   * Log error for debugging/monitoring
   */
  log(
    error: Error | AppError,
    context: {
      feature?: string;
      action?: string;
      userId?: string;
      severity?: 'info' | 'warning' | 'error' | 'fatal';
      extra?: Record<string, any>;
    } = {}
  ) {
    const severity = context.severity || 'error';
    const contextInfo = {
      feature: context.feature,
      action: context.action,
      userId: context.userId,
      ...context.extra,
    };

    // Log locally
    const logLevel = severity === 'fatal' ? console.error : console.warn;
    logLevel(
      `[${severity.toUpperCase()}] ${context.feature}/${context.action}:`,
      error.message,
      contextInfo
    );

    // Send to Sentry (production only)
    if (process.env.APP_ENV === 'production') {
      Sentry.captureException(error, {
        level: severity,
        tags: {
          feature: context.feature || 'unknown',
          action: context.action || 'unknown',
        },
        contexts: {
          app: contextInfo,
        },
      });
    }
  },

  /**
   * Handle error with user feedback
   */
  async handle(
    error: Error | AppError,
    options: {
      showToast?: boolean;
      logContext?: {
        feature?: string;
        action?: string;
        userId?: string;
        severity?: 'info' | 'warning' | 'error' | 'fatal';
        extra?: Record<string, any>;
      };
      onRetry?: () => Promise<void>;
      throwError?: boolean;
    } = {}
  ) {
    const {
      showToast = true,
      logContext = {},
      onRetry,
      throwError = false,
    } = options;

    // Log the error
    this.log(error, logContext);

    // Show toast notification
    if (showToast) {
      const message = this.getUserMessage(error);
      Toast.show({
        type: 'danger',
        text1: 'Erreur',
        text2: message,
        duration: 3000,
      });
    }

    // Throw if requested
    if (throwError) {
      throw error;
    }
  },

  /**
   * Retry logic with exponential backoff
   */
  async retry<T>(
    fn: () => Promise<T>,
    options: {
      maxAttempts?: number;
      delayMs?: number;
      backoffFactor?: number;
      onRetry?: (attempt: number, error: Error) => void;
    } = {}
  ): Promise<T> {
    const {
      maxAttempts = 3,
      delayMs = 1000,
      backoffFactor = 2,
      onRetry,
    } = options;

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt === maxAttempts) {
          break;
        }

        // Notify retry attempt
        onRetry?.(attempt, lastError);

        // Calculate delay with exponential backoff
        const delay = delayMs * Math.pow(backoffFactor, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError || new Error('Max retry attempts exceeded');
  },

  /**
   * Handle network errors specifically
   */
  handleNetworkError(error: Error): AppError {
    if (error.message.includes('Network') || error.message.includes('timeout')) {
      return new NetworkError();
    }
    return new AppError(error.message, 'NETWORK_ERROR', 0);
  },

  /**
   * Handle authentication errors
   */
  handleAuthError(error: Error): AppError {
    if (error.message.includes('Invalid login')) {
      return new AuthError('Email ou mot de passe incorrect');
    }
    if (error.message.includes('Email not confirmed')) {
      return new AuthError('Veuillez confirmer votre email');
    }
    if (error.message.includes('User already registered')) {
      return new AuthError('Cet email est déjà utilisé');
    }
    return new AuthError(error.message);
  },

  /**
   * Handle database errors
   */
  handleDatabaseError(error: any): AppError {
    const message = error?.message || 'Erreur de base de données';

    if (message.includes('policy')) {
      return new AppError(
        'Vous n\'avez pas la permission pour cette action',
        'PERMISSION_DENIED',
        403
      );
    }

    if (message.includes('unique')) {
      return new ValidationError('Cette donnée existe déjà');
    }

    if (message.includes('foreign key')) {
      return new ValidationError('Référence invalide');
    }

    return new AppError(message, 'DATABASE_ERROR', 500);
  },

  /**
   * Wrap async function with error handling
   */
  async wrap<T>(
    fn: () => Promise<T>,
    context: { feature: string; action: string }
  ): Promise<{ data: T | null; error: AppError | null }> {
    try {
      const data = await fn();
      return { data, error: null };
    } catch (err) {
      const error = this.handleDatabaseError(err as Error);
      this.log(error, {
        feature: context.feature,
        action: context.action,
        severity: 'warning',
      });
      return { data: null, error };
    }
  },
};

/**
 * Type-safe error result (for functional style)
 */
export type Result<T, E = AppError> =
  | { success: true; data: T }
  | { success: false; error: E };

/**
 * Create result helper
 */
export const createResult = {
  ok<T>(data: T): Result<T> {
    return { success: true, data };
  },
  err<E extends AppError>(error: E): Result<never, E> {
    return { success: false, error };
  },
};
