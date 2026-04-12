import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../constants/colors';
import { Spacing, Radius, FontSize, FontWeight } from '../constants/theme';
import * as Sentry from '@sentry/react-native';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  errorId: string;
}

/**
 * Global Error Boundary Component
 * Catches any errors in the component tree and displays user-friendly error screen
 * instead of crashing the entire app
 */
export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: '',
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Generate unique error ID for tracking
    const errorId = Math.random().toString(36).substr(2, 9);

    this.setState({
      errorInfo,
      errorId,
    });

    // Log to Sentry for production monitoring
    if (process.env.APP_ENV === 'production') {
      Sentry.captureException(error, {
        contexts: {
          react: {
            componentStack: errorInfo.componentStack,
          },
        },
        tags: {
          errorId,
          errorType: 'AppError',
        },
      });
    }

    // Also log locally for debugging
    console.error(
      `💥 App Error Caught [${errorId}]:`,
      error.message,
      '\nStack:',
      error.stack,
      '\nComponent Stack:',
      errorInfo.componentStack
    );
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: '',
    });
  };

  handleGoHome = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: '',
    });
    router.replace('/(tabs)');
  };

  render() {
    if (this.state.hasError) {
      return (
        <SafeAreaView style={styles.root}>
          <ScrollView
            contentContainerStyle={styles.container}
            showsVerticalScrollIndicator={false}
          >
            {/* Error Icon */}
            <View style={styles.iconContainer}>
              <Text style={styles.icon}>⚠️</Text>
            </View>

            {/* Error Title */}
            <Text style={styles.title}>Oups, quelque chose s'est mal passé</Text>

            {/* Error Description */}
            <Text style={styles.description}>
              Nous avons rencontré un problème inattendu. Notre équipe a été
              notifiée et nous travaillons pour corriger cela.
            </Text>

            {/* Error Message (if appropriate) */}
            {this.state.error?.message && (
              <View style={styles.errorMessageBox}>
                <Text style={styles.errorMessageLabel}>Détails de l'erreur:</Text>
                <Text style={styles.errorMessage}>
                  {this.state.error.message.substring(0, 200)}
                </Text>
              </View>
            )}

            {/* Dev Info (development only) */}
            {process.env.APP_ENV === 'development' && this.state.errorInfo && (
              <View style={styles.devInfoBox}>
                <Text style={styles.devInfoLabel}>🔧 Info Développeur</Text>
                <ScrollView
                  style={styles.stackTraceContainer}
                  showsVerticalScrollIndicator={false}
                >
                  <Text style={styles.stackTrace}>
                    {this.state.errorInfo.componentStack}
                  </Text>
                </ScrollView>
              </View>
            )}

            {/* Error ID for tracking */}
            <View style={styles.errorIdBox}>
              <Text style={styles.errorIdLabel}>ID d'erreur:</Text>
              <Text style={styles.errorId}>{this.state.errorId}</Text>
              <Text style={styles.errorIdHint}>
                Partagez cet ID si vous contactez le support
              </Text>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionsContainer}>
              <TouchableOpacity
                style={[styles.button, styles.retryButton]}
                onPress={this.handleRetry}
              >
                <Text style={styles.retryButtonText}>Réessayer</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.homeButton]}
                onPress={this.handleGoHome}
              >
                <Text style={styles.homeButtonText}>Retour à l'accueil</Text>
              </TouchableOpacity>
            </View>

            {/* Help Text */}
            <Text style={styles.helpText}>
              Si le problème persiste, veuillez redémarrer l'application ou
              contacter le support.
            </Text>
          </ScrollView>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flexGrow: 1,
    padding: Spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Icon & Title
  iconContainer: {
    marginBottom: Spacing.lg,
  },
  icon: {
    fontSize: 64,
  },
  title: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },

  // Description
  description: {
    fontSize: FontSize.base,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.lg,
    lineHeight: 22,
  },

  // Error Message Box
  errorMessageBox: {
    width: '100%',
    backgroundColor: Colors.urgentBg,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: Colors.urgent,
  },
  errorMessageLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.urgent,
    textTransform: 'uppercase',
    marginBottom: Spacing.xs,
  },
  errorMessage: {
    fontSize: FontSize.sm,
    color: Colors.urgent,
    fontFamily: 'Courier New',
  },

  // Dev Info Box (development only)
  devInfoBox: {
    width: '100%',
    backgroundColor: '#1a1a1a',
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: '#333',
    maxHeight: 200,
  },
  devInfoLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: '#00ff00',
    marginBottom: Spacing.xs,
  },
  stackTraceContainer: {
    maxHeight: 150,
  },
  stackTrace: {
    fontSize: 10,
    color: '#00ff00',
    fontFamily: 'Courier New',
    lineHeight: 14,
  },

  // Error ID
  errorIdBox: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  errorIdLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    marginBottom: Spacing.xs,
  },
  errorId: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
    fontFamily: 'Courier New',
    marginBottom: Spacing.xs,
  },
  errorIdHint: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    fontStyle: 'italic',
  },

  // Action Buttons
  actionsContainer: {
    width: '100%',
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  button: {
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryButton: {
    backgroundColor: Colors.primary,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
  },
  homeButton: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  homeButtonText: {
    color: Colors.primary,
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
  },

  // Help Text
  helpText: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
