/**
 * Server-side Input Validation Edge Function
 *
 * Validates user input on the server to prevent:
 * - Client-side validation bypass
 * - XSS attacks via malicious input
 * - SQL injection attempts
 * - Constraint violations
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// ============================================================================
// VALIDATION TYPES
// ============================================================================

interface ValidationRequest {
  type: "signup" | "profile" | "avis" | "concours" | "coachAnnonce" | "custom";
  data: Record<string, any>;
  rules?: Record<string, string>;
}

interface ValidationResponse {
  valid: boolean;
  errors: Record<string, string>;
  sanitized?: Record<string, any>;
}

// ============================================================================
// SANITIZATION FUNCTIONS
// ============================================================================

/**
 * Remove HTML tags and dangerous characters
 */
function sanitizeText(value: string, maxLength: number = 500): string {
  if (!value || typeof value !== "string") return "";
  return value
    .trim()
    .replace(/<[^>]*>/g, "") // Remove HTML tags
    .replace(/[<>]/g, "") // Remove remaining angle brackets
    .slice(0, maxLength);
}

/**
 * Sanitize email
 */
function sanitizeEmail(value: string): string {
  if (!value || typeof value !== "string") return "";
  return value.trim().toLowerCase().slice(0, 255);
}

/**
 * Sanitize name (allow accents, hyphens, apostrophes)
 */
function sanitizeName(value: string): string {
  if (!value || typeof value !== "string") return "";
  return value
    .trim()
    .replace(/[^a-zA-ZÀ-ÿ\s\-']/g, "")
    .slice(0, 50);
}

/**
 * Sanitize phone
 */
function sanitizePhone(value: string): string {
  if (!value || typeof value !== "string") return "";
  return value.replace(/[^\d+\-().\s]/g, "").slice(0, 20);
}

/**
 * Sanitize URL
 */
function sanitizeUrl(value: string): string {
  if (!value || typeof value !== "string") return "";
  return value.trim().slice(0, 2048);
}

/**
 * Sanitize bio/comment
 */
function sanitizeBio(value: string, maxLength: number = 1000): string {
  if (!value || typeof value !== "string") return "";
  return value
    .trim()
    .replace(/<[^>]*>/g, "") // Remove HTML tags
    .replace(/[<>]/g, "") // Remove angle brackets
    .slice(0, maxLength);
}

// ============================================================================
// VALIDATOR FUNCTIONS
// ============================================================================

/**
 * Required field validation
 */
function validateRequired(
  value: string | undefined | null,
  fieldName: string
): string | null {
  if (!value || (typeof value === "string" && value.trim().length === 0)) {
    return `${fieldName} est requis`;
  }
  return null;
}

/**
 * Email validation
 */
function validateEmail(email: string): string | null {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    return "Format email invalide";
  }
  return null;
}

/**
 * Password strength validation
 */
function validatePassword(password: string): string | null {
  if (!password) return "Le mot de passe est requis";
  if (password.length < 8) {
    return "Le mot de passe doit contenir au moins 8 caractères";
  }
  if (!/[A-Z]/.test(password)) {
    return "Le mot de passe doit contenir une majuscule";
  }
  if (!/[a-z]/.test(password)) {
    return "Le mot de passe doit contenir une minuscule";
  }
  if (!/\d/.test(password)) {
    return "Le mot de passe doit contenir un chiffre";
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return "Le mot de passe doit contenir un caractère spécial";
  }
  return null;
}

/**
 * String length validation
 */
function validateLength(
  value: string,
  min: number,
  max: number,
  fieldName: string
): string | null {
  if (value.length < min) {
    return `${fieldName} doit contenir au moins ${min} caractères`;
  }
  if (value.length > max) {
    return `${fieldName} ne doit pas dépasser ${max} caractères`;
  }
  return null;
}

/**
 * French name validation
 */
function validateFrenchName(name: string, fieldName: string): string | null {
  const nameRegex = /^[a-zA-ZÀ-ÿ\s\-']{2,50}$/;
  if (!nameRegex.test(name.trim())) {
    return `${fieldName} doit contenir uniquement des lettres (2-50 caractères)`;
  }
  return null;
}

/**
 * Phone validation
 */
function validatePhone(phone: string): string | null {
  const phoneRegex = /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/;
  if (!phoneRegex.test(phone.trim())) {
    return "Format téléphone invalide";
  }
  return null;
}

/**
 * Rating validation (1-5 stars)
 */
function validateRating(value: number): string | null {
  if (!Number.isInteger(value) || value < 1 || value > 5) {
    return "La note doit être entre 1 et 5";
  }
  return null;
}

/**
 * Date validation (must be in future)
 */
function validateFutureDate(dateString: string): string | null {
  const date = new Date(dateString);
  const now = new Date();
  if (isNaN(date.getTime())) {
    return "Format date invalide";
  }
  if (date < now) {
    return "La date doit être dans le futur";
  }
  return null;
}

/**
 * URL validation
 */
function validateUrl(url: string): string | null {
  try {
    new URL(url);
    return null;
  } catch {
    return "URL invalide";
  }
}

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const validationSchemas = {
  signup: (data: any) => {
    const errors: Record<string, string> = {};
    const sanitized: Record<string, any> = {};

    // Email validation
    if (data.email) {
      const emailError = validateRequired(data.email, "Email");
      if (emailError) errors.email = emailError;
      else {
        const emailValidError = validateEmail(data.email);
        if (emailValidError) errors.email = emailValidError;
        else sanitized.email = sanitizeEmail(data.email);
      }
    }

    // Password validation
    if (data.password) {
      const passwordError = validatePassword(data.password);
      if (passwordError) errors.password = passwordError;
      else sanitized.password = data.password; // Don't sanitize passwords
    }

    // Prenom validation
    if (data.prenom) {
      const prenomError = validateRequired(data.prenom, "Prénom");
      if (!prenomError) {
        const lengthError = validateLength(data.prenom, 2, 50, "Prénom");
        if (lengthError) errors.prenom = lengthError;
        else {
          const nameError = validateFrenchName(data.prenom, "Prénom");
          if (nameError) errors.prenom = nameError;
          else sanitized.prenom = sanitizeName(data.prenom);
        }
      } else {
        errors.prenom = prenomError;
      }
    }

    // Nom validation
    if (data.nom) {
      const nomError = validateRequired(data.nom, "Nom");
      if (!nomError) {
        const lengthError = validateLength(data.nom, 2, 50, "Nom");
        if (lengthError) errors.nom = lengthError;
        else {
          const nameError = validateFrenchName(data.nom, "Nom");
          if (nameError) errors.nom = nameError;
          else sanitized.nom = sanitizeName(data.nom);
        }
      } else {
        errors.nom = nomError;
      }
    }

    return { sanitized, errors };
  },

  profile: (data: any) => {
    const errors: Record<string, string> = {};
    const sanitized: Record<string, any> = {};

    // Region validation
    if (data.region) {
      const regionError = validateRequired(data.region, "Région");
      if (!regionError) {
        const lengthError = validateLength(data.region, 1, 100, "Région");
        if (lengthError) errors.region = lengthError;
        else sanitized.region = sanitizeText(data.region, 100);
      } else {
        errors.region = regionError;
      }
    }

    // Bio validation
    if (data.bio !== undefined && data.bio !== null) {
      const lengthError = validateLength(data.bio, 0, 1000, "Bio");
      if (lengthError) errors.bio = lengthError;
      else sanitized.bio = sanitizeBio(data.bio, 1000);
    }

    return { sanitized, errors };
  },

  avis: (data: any) => {
    const errors: Record<string, string> = {};
    const sanitized: Record<string, any> = {};

    // Note validation
    if (data.note !== undefined) {
      const noteError = validateRating(data.note);
      if (noteError) errors.note = noteError;
      else sanitized.note = data.note;
    }

    // Commentaire validation
    if (data.commentaire !== undefined && data.commentaire !== null) {
      const lengthError = validateLength(data.commentaire, 0, 1000, "Commentaire");
      if (lengthError) errors.commentaire = lengthError;
      else sanitized.commentaire = sanitizeText(data.commentaire, 1000);
    }

    return { sanitized, errors };
  },

  concours: (data: any) => {
    const errors: Record<string, string> = {};
    const sanitized: Record<string, any> = {};

    // Nom validation
    if (data.nom) {
      const nomError = validateRequired(data.nom, "Nom du concours");
      if (!nomError) {
        const lengthError = validateLength(data.nom, 1, 255, "Nom");
        if (lengthError) errors.nom = lengthError;
        else sanitized.nom = sanitizeText(data.nom, 255);
      } else {
        errors.nom = nomError;
      }
    }

    // Lieu validation
    if (data.lieu) {
      const lieuError = validateRequired(data.lieu, "Lieu");
      if (!lieuError) {
        const lengthError = validateLength(data.lieu, 1, 255, "Lieu");
        if (lengthError) errors.lieu = lengthError;
        else sanitized.lieu = sanitizeText(data.lieu, 255);
      } else {
        errors.lieu = lieuError;
      }
    }

    // Date validation
    if (data.date_debut) {
      const dateError = validateRequired(data.date_debut, "Date de début");
      if (!dateError) {
        const futureError = validateFutureDate(data.date_debut);
        if (futureError) errors.date_debut = futureError;
        else sanitized.date_debut = data.date_debut;
      } else {
        errors.date_debut = dateError;
      }
    }

    return { sanitized, errors };
  },

  coachAnnonce: (data: any) => {
    const errors: Record<string, string> = {};
    const sanitized: Record<string, any> = {};

    // Titre validation
    if (data.titre) {
      const titreError = validateRequired(data.titre, "Titre");
      if (!titreError) {
        const lengthError = validateLength(data.titre, 1, 255, "Titre");
        if (lengthError) errors.titre = lengthError;
        else sanitized.titre = sanitizeText(data.titre, 255);
      } else {
        errors.titre = titreError;
      }
    }

    // Description validation
    if (data.description !== undefined && data.description !== null) {
      const lengthError = validateLength(data.description, 0, 2000, "Description");
      if (lengthError) errors.description = lengthError;
      else sanitized.description = sanitizeBio(data.description, 2000);
    }

    return { sanitized, errors };
  },
};

// ============================================================================
// MAIN HANDLER
// ============================================================================

Deno.serve(async (req: Request) => {
  // Only allow POST requests
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body = (await req.json()) as ValidationRequest;

    const { type, data } = body;

    // Validate schema exists
    if (!validationSchemas[type as keyof typeof validationSchemas]) {
      return new Response(
        JSON.stringify({
          valid: false,
          errors: { _form: "Schéma de validation inconnu" },
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Run validation schema
    const schema =
      validationSchemas[type as keyof typeof validationSchemas];
    const { sanitized, errors } = schema(data);

    // Return validation result
    const response: ValidationResponse = {
      valid: Object.keys(errors).length === 0,
      errors,
      ...(Object.keys(errors).length === 0 && { sanitized }),
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Validation error:", error);
    return new Response(
      JSON.stringify({
        valid: false,
        errors: { _form: "Erreur lors de la validation" },
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});
