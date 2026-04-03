import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

SupabaseClient get supabase => Supabase.instance.client;

final supabaseClientProvider = Provider<SupabaseClient>(
  (_) => supabase,
  name: 'supabaseClientProvider',
);

final authStateProvider = StreamProvider<AuthState>(
  (ref) => ref.watch(supabaseClientProvider).auth.onAuthStateChange,
  name: 'authStateProvider',
);
