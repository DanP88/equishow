/**
 * Input Validation & Sanitization Library
 *
 * Provides:
 * - Validator functions with type-safe returns
 * - Sanitization to prevent XSS/Injection
 * - Custom error messages in French
 * - Server-side ready (can be duplicated in Edge Functions)
 */

/**
 * Validation Result Type
 */
export type ValidationResult = { isValid: true } | { isValid: false; error: string };

/**
 * Validation Rules
 */
export const validators = {
  /**
   * Required field validation
   */
  required: (value: string | undefined | null, fieldName: string = 'Ce champ'): ValidationResult => {
    if (!value || value.trim().length === 0) {
      return { isValid: false, error: `${fieldName} est requis` };
    }
    return { isValid: true };
  },

  /**
   * Email validation with RFC 5322 simplified regex
   */
  email: (email: string): ValidationResult => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return { isValid: false, error: 'Format email invalide' };
    }
    return { isValid: true };
  },

  /**
   * Password strength validation
   * - Minimum 8 characters
   * - At least one uppercase letter
   * - At least one lowercase letter
   * - At least one number
   * - At least one special character
   */
  password: (password: string): ValidationResult => {
    if (password.length < 8) {
      return { isValid: false, error: 'Le mot de passe doit contenir au moins 8 caractères' };
    }
    if (!/[A-Z]/.test(password)) {
      return { isValid: false, error: 'Le mot de passe doit contenir une majuscule' };
    }
    if (!/[a-z]/.test(password)) {
      return { isValid: false, error: 'Le mot de passe doit contenir une minuscule' };
    }
    if (!/\d/.test(password)) {
      return { isValid: false, error: 'Le mot de passe doit contenir un chiffre' };
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      return { isValid: false, error: 'Le mot de passe doit contenir un caractère spécial' };
    }
    return { isValid: true };
  },

  /**
   * Minimum length validation
   */
  minLength: (value: string, min: number, fieldName: string = 'Ce champ'): ValidationResult => {
    if (value.length < min) {
      return { isValid: false, error: `${fieldName} doit contenir au moins ${min} caractères` };
    }
    return { isValid: true };
  },

  /**
   * Maximum length validation
   */
  maxLength: (value: string, max: number, fieldName: string = 'Ce champ'): ValidationResult => {
    if (value.length > max) {
      return { isValid: false, error: `${fieldName} ne doit pas dépasser ${max} caractères` };
    }
    return { isValid: true };
  },

  /**
   * French name validation (letters, spaces, hyphens, accents)
   */
  frenchName: (name: string, fieldName: string = 'Ce champ'): ValidationResult => {
    const nameRegex = /^[a-zA-ZÀ-ÿ\s\-']{2,50}$/;
    if (!nameRegex.test(name.trim())) {
      return {
        isValid: false,
        error: `${fieldName} doit contenir uniquement des lettres (2-50 caractères)`,
      };
    }
    return { isValid: true };
  },

  /**
   * Phone number validation (international format)
   */
  phone: (phone: string): ValidationResult => {
    const phoneRegex = /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/;
    if (!phoneRegex.test(phone.trim())) {
      return { isValid: false, error: 'Format téléphone invalide' };
    }
    return { isValid: true };
  },

  /**
   * Number validation (integer or float)
   */
  number: (value: string, min?: number, max?: number): ValidationResult => {
    const num = Number(value);
    if (isNaN(num)) {
      return { isValid: false, error: 'Doit être un nombre' };
    }
    if (min !== undefined && num < min) {
      return { isValid: false, error: `Doit être >= ${min}` };
    }
    if (max !== undefined && num > max) {
      return { isValid: false, error: `Doit être <= ${max}` };
    }
    return { isValid: true };
  },

  /**
   * Rating validation (1-5 stars)
   */
  rating: (value: number): ValidationResult => {
    if (!Number.isInteger(value) || value < 1 || value > 5) {
      return { isValid: false, error: 'La note doit être entre 1 et 5' };
    }
    return { isValid: true };
  },

  /**
   * Date validation (not in past)
   */
  futureDate: (dateString: string): ValidationResult => {
    const date = new Date(dateString);
    const now = new Date();
    if (isNaN(date.getTime())) {
      return { isValid: false, error: 'Format date invalide' };
    }
    if (date < now) {
      return { isValid: false, error: 'La date doit être dans le futur' };
    }
    return { isValid: true };
  },

  /**
   * URL validation
   */
  url: (url: string): ValidationResult => {
    try {
      new URL(url);
      return { isValid: true };
    } catch {
      return { isValid: false, error: 'URL invalide' };
    }
  },

  /**
   * Compound validation (run multiple validators)
   */
  compose: (...validators: ValidationResult[]): ValidationResult => {
    for (const result of validators) {
      if (!result.isValid) {
        return result;
      }
    }
    return { isValid: true };
  },
};

/**
 * Sanitization Functions
 * Remove/escape dangerous content
 */
export const sanitize = {
  /**
   * Sanitize text: remove HTML tags, trim, limit length
   */
  text: (value: string, maxLength: number = 500): string => {
    return value
      .trim()
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/[<>]/g, '') // Remove remaining angle brackets
      .slice(0, maxLength);
  },

  /**
   * Sanitize email: lowercase, trim
   */
  email: (value: string): string => {
    return value.trim().toLowerCase().slice(0, 255);
  },

  /**
   * Sanitize name: trim, remove special chars except hyphens/apostrophes
   */
  name: (value: string): string => {
    return value
      .trim()
      .replace(/[^a-zA-ZÀ-ÿ\s\-']/g, '')
      .slice(0, 50);
  },

  /**
   * Sanitize phone: keep only digits and basic formatting
   */
  phone: (value: string): string => {
    return value.replace(/[^\d+\-().\s]/g, '').slice(0, 20);
  },

  /**
   * Sanitize URL: trim, validate format
   */
  url: (value: string): string => {
    return value.trim().slice(0, 2048);
  },

  /**
   * Sanitize bio/comment: remove HTML, limit length
   */
  bio: (value: string, maxLength: number = 1000): string => {
    return value
      .trim()
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/[<>]/g, '') // Remove angle brackets
      .slice(0, maxLength);
  },

  /**
   * Sanitize all standard user inputs
   */
  user: (input: {
    prenom?: string;
    nom?: string;
    email?: string;
    bio?: string;
    region?: string;
  }) => {
    return {
      prenom: input.prenom ? sanitize.name(input.prenom) : undefined,
      nom: input.nom ? sanitize.name(input.nom) : undefined,
      email: input.email ? sanitize.email(input.email) : undefined,
      bio: input.bio ? sanitize.bio(input.bio) : undefined,
      region: input.region ? sanitize.text(input.region, 100) : undefined,
    };
  },
};

/**
 * Validation Schema for Forms
 * Define all validations in one place
 */
export const validationSchemas = {
  signup: {
    email: (value: string) => validators.compose(
      validators.required(value, 'Email'),
      validators.email(value)
    ),
    password: (value: string) => validators.compose(
      validators.required(value, 'Mot de passe'),
      validators.password(value)
    ),
    prenom: (value: string) => validators.compose(
      validators.required(value, 'Prénom'),
      validators.minLength(value, 2, 'Prénom'),
      validators.maxLength(value, 50, 'Prénom'),
      validators.frenchName(value, 'Prénom')
    ),
    nom: (value: string) => validators.compose(
      validators.required(value, 'Nom'),
      validators.minLength(value, 2, 'Nom'),
      validators.maxLength(value, 50, 'Nom'),
      validators.frenchName(value, 'Nom')
    ),
  },

  profile: {
    region: (value: string) => validators.compose(
      validators.required(value, 'Région'),
      validators.maxLength(value, 100, 'Région')
    ),
    bio: (value: string) => validators.compose(
      validators.maxLength(value, 1000, 'Bio')
    ),
  },

  avis: {
    note: (value: number) => validators.rating(value),
    commentaire: (value: string) => validators.compose(
      validators.maxLength(value, 1000, 'Commentaire')
    ),
  },

  concours: {
    nom: (value: string) => validators.compose(
      validators.required(value, 'Nom du concours'),
      validators.maxLength(value, 255, 'Nom')
    ),
    lieu: (value: string) => validators.compose(
      validators.required(value, 'Lieu'),
      validators.maxLength(value, 255, 'Lieu')
    ),
    date_debut: (value: string) => validators.compose(
      validators.required(value, 'Date de début'),
      validators.futureDate(value)
    ),
  },

  coachAnnonce: {
    titre: (value: string) => validators.compose(
      validators.required(value, 'Titre'),
      validators.maxLength(value, 255, 'Titre')
    ),
    description: (value: string) => validators.compose(
      validators.maxLength(value, 2000, 'Description')
    ),
  },
};

/**
 * Type-safe validation results
 */
export const isValid = (result: ValidationResult): result is { isValid: true } => {
  return result.isValid === true;
};

export const getError = (result: ValidationResult): string | null => {
  return result.isValid ? null : result.error;
};
