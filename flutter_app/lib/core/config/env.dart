/// Configuration d'environnement — injectée via --dart-define au build.
///
/// Usage :
///   flutter run \
///     --dart-define=SUPABASE_URL=https://xxx.supabase.co \
///     --dart-define=SUPABASE_ANON_KEY=eyJ... \
///     --dart-define=APP_ENV=development
abstract final class Env {
  static const supabaseUrl     = String.fromEnvironment('SUPABASE_URL');
  static const supabaseAnonKey = String.fromEnvironment('SUPABASE_ANON_KEY');
  static const appEnv = String.fromEnvironment('APP_ENV', defaultValue: 'development');

  static bool get isProduction  => appEnv == 'production';
  static bool get isStaging     => appEnv == 'staging';
  static bool get isDevelopment => appEnv == 'development';

  /// Appeler dans main() avant toute initialisation.
  static void assertValid() {
    assert(supabaseUrl.isNotEmpty,
        'SUPABASE_URL manquant — passer --dart-define=SUPABASE_URL=...');
    assert(supabaseAnonKey.isNotEmpty,
        'SUPABASE_ANON_KEY manquant — passer --dart-define=SUPABASE_ANON_KEY=...');
  }
}
