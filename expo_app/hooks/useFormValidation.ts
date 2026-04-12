/**
 * useFormValidation Hook
 *
 * Manages form state with client-side and server-side validation
 * Provides comprehensive form validation, sanitization, and error handling
 */

import { useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { ValidationResult } from '../lib/validation';

export interface FormErrors {
  [key: string]: string | null | undefined;
}

export interface FormData {
  [key: string]: any;
}

export interface UseFormValidationOptions {
  /**
   * Validation schema type for server validation
   */
  validationSchema?: 'signup' | 'profile' | 'avis' | 'concours' | 'coachAnnonce';

  /**
   * Whether to validate on submit only
   */
  validateOnChange?: boolean;

  /**
   * Called before form submission
   */
  onBeforeSubmit?: (data: FormData) => Promise<boolean>;

  /**
   * Called after successful submission
   */
  onSubmit?: (data: FormData) => Promise<void>;

  /**
   * Called on validation error
   */
  onError?: (errors: FormErrors) => void;
}

export const useFormValidation = (
  initialData: FormData,
  options: UseFormValidationOptions = {}
) => {
  const [values, setValues] = useState<FormData>(initialData);
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<{ [key: string]: boolean }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const { validationSchema, validateOnChange = true, onBeforeSubmit, onSubmit, onError } = options;

  const clientValidatorsRef = useRef<Record<string, (value: any) => ValidationResult>>({});

  /**
   * Set client-side validators for fields
   */
  const setValidator = useCallback(
    (fieldName: string, validator: (value: any) => ValidationResult) => {
      clientValidatorsRef.current[fieldName] = validator;
    },
    []
  );

  /**
   * Validate a single field client-side
   */
  const validateField = useCallback((fieldName: string, value: any): string | null => {
    const validator = clientValidatorsRef.current[fieldName];
    if (!validator) return null;

    const result = validator(value);
    return result.isValid ? null : result.error;
  }, []);

  /**
   * Validate all fields with server-side validation
   */
  const validateForm = useCallback(async (): Promise<boolean> => {
    setIsValidating(true);
    const newErrors: FormErrors = {};

    try {
      // Client-side validation first
      Object.keys(clientValidatorsRef.current).forEach((fieldName) => {
        const error = validateField(fieldName, values[fieldName]);
        if (error) {
          newErrors[fieldName] = error;
        }
      });

      // If client validation passed and server schema defined, validate server-side
      if (Object.keys(newErrors).length === 0 && validationSchema) {
        const { data, error } = await supabase.functions.invoke('validate-input', {
          body: {
            type: validationSchema,
            data: values,
          },
        });

        if (error) {
          console.error('Server validation error:', error);
          newErrors._form = 'Erreur lors de la validation du serveur';
        } else if (!data.valid) {
          Object.assign(newErrors, data.errors);
        } else if (data.sanitized) {
          // Update values with sanitized versions from server
          setValues((prev) => ({ ...prev, ...data.sanitized }));
        }
      }

      setErrors(newErrors);
      onError?.(newErrors);
      return Object.keys(newErrors).length === 0;
    } finally {
      setIsValidating(false);
    }
  }, [values, validationSchema, validateField, onError]);

  /**
   * Update field value
   */
  const handleChange = useCallback(
    (fieldName: string, value: any) => {
      setValues((prev) => ({ ...prev, [fieldName]: value }));

      // Mark field as touched
      setTouched((prev) => ({ ...prev, [fieldName]: true }));

      // Client-side validation if enabled
      if (validateOnChange) {
        const error = validateField(fieldName, value);
        setErrors((prev) => ({
          ...prev,
          [fieldName]: error,
        }));
      }
    },
    [validateOnChange, validateField]
  );

  /**
   * Mark field as touched
   */
  const handleBlur = useCallback((fieldName: string) => {
    setTouched((prev) => ({ ...prev, [fieldName]: true }));
  }, []);

  /**
   * Reset form to initial state
   */
  const resetForm = useCallback(() => {
    setValues(initialData);
    setErrors({});
    setTouched({});
  }, [initialData]);

  /**
   * Handle form submission
   */
  const handleSubmit = useCallback(async () => {
    setIsSubmitting(true);
    try {
      // Pre-submit hook
      if (onBeforeSubmit) {
        const shouldContinue = await onBeforeSubmit(values);
        if (!shouldContinue) {
          setIsSubmitting(false);
          return;
        }
      }

      // Validate form
      const isValid = await validateForm();
      if (!isValid) {
        setIsSubmitting(false);
        return;
      }

      // Submit form
      if (onSubmit) {
        await onSubmit(values);
      }
    } catch (error) {
      console.error('Form submission error:', error);
      setErrors((prev) => ({
        ...prev,
        _form: error instanceof Error ? error.message : 'Une erreur est survenue',
      }));
    } finally {
      setIsSubmitting(false);
    }
  }, [values, onBeforeSubmit, onSubmit, validateForm]);

  /**
   * Manually set field value and errors
   */
  const setFieldValue = useCallback((fieldName: string, value: any) => {
    setValues((prev) => ({ ...prev, [fieldName]: value }));
  }, []);

  const setFieldError = useCallback((fieldName: string, error: string | null) => {
    setErrors((prev) => ({
      ...prev,
      [fieldName]: error,
    }));
  }, []);

  return {
    // State
    values,
    errors,
    touched,
    isSubmitting,
    isValidating,

    // Methods
    handleChange,
    handleBlur,
    handleSubmit,
    resetForm,
    setValidator,
    setFieldValue,
    setFieldError,
    validateField,
    validateForm,

    // Utility
    getFieldProps: (fieldName: string) => ({
      name: fieldName,
      value: values[fieldName] ?? '',
      onChangeValue: handleChange,
      onBlur: handleBlur,
      error: errors[fieldName],
      touched: touched[fieldName],
    }),
  };
};

export default useFormValidation;
