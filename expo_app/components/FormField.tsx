/**
 * FormField Component
 *
 * Reusable form field with integrated validation, sanitization, and error handling
 * Works with both React Native and Web platforms
 * Integrates with validation.ts for client-side validation
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  KeyboardTypeOptions,
  Platform,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { ValidationResult, sanitize, validators } from '../lib/validation';

interface FormFieldProps {
  /**
   * Unique field identifier
   */
  name: string;

  /**
   * Field label displayed above input
   */
  label: string;

  /**
   * Current field value
   */
  value: string;

  /**
   * Callback when value changes
   */
  onChangeValue: (name: string, value: string) => void;

  /**
   * Callback when field is validated
   */
  onValidate?: (name: string, result: ValidationResult) => void;

  /**
   * Validation function to run on the field
   */
  validator?: (value: string) => ValidationResult;

  /**
   * Type of sanitization to apply
   */
  sanitizeType?: 'text' | 'email' | 'name' | 'phone' | 'url' | 'bio' | 'none';

  /**
   * TextInput type
   */
  inputType?: 'default' | 'email-address' | 'phone-pad' | 'numeric' | 'decimal-pad';

  /**
   * Whether input is required
   */
  required?: boolean;

  /**
   * Whether password input (masks text)
   */
  secureTextEntry?: boolean;

  /**
   * Placeholder text
   */
  placeholder?: string;

  /**
   * Maximum character length
   */
  maxLength?: number;

  /**
   * Number of text input lines (mobile)
   */
  numberOfLines?: number;

  /**
   * Whether to validate on blur or change
   */
  validateOnBlur?: boolean;

  /**
   * Whether field has been touched (for conditional error display)
   */
  touched?: boolean;

  /**
   * Custom container style
   */
  containerStyle?: ViewStyle;

  /**
   * Custom input style
   */
  inputStyle?: TextStyle;

  /**
   * Custom error text style
   */
  errorStyle?: TextStyle;

  /**
   * Help text displayed below field
   */
  helpText?: string;

  /**
   * Whether to show character count
   */
  showCharCount?: boolean;

  /**
   * Disabled state
   */
  disabled?: boolean;

  /**
   * Auto-focus
   */
  autoFocus?: boolean;
}

const FormField: React.FC<FormFieldProps> = ({
  name,
  label,
  value,
  onChangeValue,
  onValidate,
  validator,
  sanitizeType = 'text',
  inputType = 'default',
  required = false,
  secureTextEntry = false,
  placeholder,
  maxLength,
  numberOfLines,
  validateOnBlur = true,
  touched = false,
  containerStyle,
  inputStyle,
  errorStyle,
  helpText,
  showCharCount = false,
  disabled = false,
  autoFocus = false,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult>({ isValid: true });

  /**
   * Validate field value
   */
  const validateField = useCallback(
    (fieldValue: string) => {
      let result: ValidationResult = { isValid: true };

      // Required field check first
      if (required && validators.required(fieldValue, label).isValid === false) {
        result = validators.required(fieldValue, label);
      } else if (validator) {
        // Run custom validator if provided
        result = validator(fieldValue);
      }

      setValidationResult(result);
      onValidate?.(name, result);
      return result;
    },
    [required, validator, name, label, onValidate]
  );

  /**
   * Handle value change with sanitization
   */
  const handleChangeText = useCallback(
    (text: string) => {
      let sanitized = text;

      // Apply sanitization based on type
      if (sanitizeType !== 'none') {
        if (sanitizeType === 'text') sanitized = sanitize.text(text, maxLength || 500);
        else if (sanitizeType === 'email') sanitized = sanitize.email(text);
        else if (sanitizeType === 'name') sanitized = sanitize.name(text);
        else if (sanitizeType === 'phone') sanitized = sanitize.phone(text);
        else if (sanitizeType === 'url') sanitized = sanitize.url(text);
        else if (sanitizeType === 'bio') sanitized = sanitize.bio(text, maxLength || 1000);
      }

      // Update parent with sanitized value
      onChangeValue(name, sanitized);

      // Validate on change if not validateOnBlur
      if (!validateOnBlur && validator) {
        validateField(sanitized);
      }
    },
    [name, onChangeValue, sanitizeType, maxLength, validateOnBlur, validator, validateField]
  );

  /**
   * Handle focus event
   */
  const handleFocus = useCallback(() => {
    setIsFocused(true);
  }, []);

  /**
   * Handle blur event - validate if validateOnBlur is true
   */
  const handleBlur = useCallback(() => {
    setIsFocused(false);
    if (validateOnBlur && validator) {
      validateField(value);
    }
  }, [validateOnBlur, validator, value, validateField]);

  // Show error only if field was touched or validated
  const showError = touched || validationResult.isValid === false;
  const errorMessage = validationResult.isValid === false ? validationResult.error : null;

  const styles = StyleSheet.create({
    container: {
      marginBottom: 16,
    },
    labelContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 6,
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
      color: '#2c3e50',
    },
    requiredIndicator: {
      color: '#e74c3c',
      fontSize: 14,
      fontWeight: 'bold',
    },
    charCount: {
      fontSize: 12,
      color: '#7f8c8d',
    },
    inputWrapper: {
      borderRadius: 8,
      borderWidth: 1,
      borderColor: isFocused ? '#3498db' : errorMessage ? '#e74c3c' : '#bdc3c7',
      backgroundColor: disabled ? '#ecf0f1' : '#ffffff',
      paddingHorizontal: 12,
      paddingVertical: 10,
      minHeight: 44,
    },
    input: {
      fontSize: 16,
      color: '#2c3e50',
      fontFamily: Platform.OS === 'ios' ? 'System' : undefined,
    },
    inputFocused: {
      borderColor: '#3498db',
    },
    inputError: {
      borderColor: '#e74c3c',
    },
    errorText: {
      marginTop: 6,
      fontSize: 12,
      color: '#e74c3c',
      fontWeight: '500',
    },
    helpText: {
      marginTop: 6,
      fontSize: 12,
      color: '#7f8c8d',
    },
    successIndicator: {
      fontSize: 16,
      color: '#27ae60',
    },
  });

  return (
    <View style={[styles.container, containerStyle]}>
      {/* Label */}
      <View style={styles.labelContainer}>
        <Text style={styles.label}>
          {label}
          {required && <Text style={styles.requiredIndicator}> *</Text>}
        </Text>
        {showCharCount && maxLength && (
          <Text style={styles.charCount}>
            {value.length}/{maxLength}
          </Text>
        )}
      </View>

      {/* Input Field */}
      <View
        style={[
          styles.inputWrapper,
          isFocused && styles.inputFocused,
          errorMessage && styles.inputError,
        ]}
      >
        <TextInput
          style={[styles.input, inputStyle]}
          value={value}
          onChangeText={handleChangeText}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          placeholderTextColor="#95a5a6"
          keyboardType={inputType as KeyboardTypeOptions}
          secureTextEntry={secureTextEntry}
          maxLength={maxLength}
          numberOfLines={numberOfLines}
          editable={!disabled}
          autoFocus={autoFocus}
          accessibilityLabel={label}
          accessibilityHint={helpText}
          testID={`field-${name}`}
        />
      </View>

      {/* Error Message */}
      {showError && errorMessage && <Text style={[styles.errorText, errorStyle]}>{errorMessage}</Text>}

      {/* Success Indicator */}
      {touched && validationResult.isValid && (
        <Text style={[styles.errorText, styles.successIndicator]}>✓</Text>
      )}

      {/* Help Text */}
      {helpText && !errorMessage && <Text style={styles.helpText}>{helpText}</Text>}
    </View>
  );
};

export default FormField;
