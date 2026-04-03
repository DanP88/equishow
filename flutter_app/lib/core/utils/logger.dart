import 'package:flutter/foundation.dart';
import '../config/env.dart';

abstract final class AppLogger {
  static void info(String tag, String message) {
    if (!Env.isProduction) _log('ℹ️  [$tag]', message);
  }

  static void warning(String tag, String message) {
    if (!Env.isProduction) _log('⚠️  [$tag]', message);
    // TODO(prod): envoyer vers Sentry
  }

  static void error(String tag, String message, [Object? error, StackTrace? stack]) {
    _log('🔴 [$tag]', message);
    if (error != null && !Env.isProduction) debugPrint('   error: $error');
    if (stack != null && !Env.isProduction) debugPrint('   stack: $stack');
    // TODO(prod): envoyer vers Sentry
  }

  static void _log(String prefix, String message) => debugPrint('$prefix $message');
}
