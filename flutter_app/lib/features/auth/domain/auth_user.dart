import 'package:supabase_flutter/supabase_flutter.dart' show User;

class AuthUser {
  const AuthUser({
    required this.id,
    required this.email,
    this.fullName,
    this.phone,
    this.avatarUrl,
    this.ffeNumber,
  });

  final String  id;
  final String  email;
  final String? fullName;
  final String? phone;
  final String? avatarUrl;
  final String? ffeNumber;  // Numéro de licence FFE

  factory AuthUser.fromSupabase(User user) => AuthUser(
        id:        user.id,
        email:     user.email ?? '',
        fullName:  user.userMetadata?['full_name'] as String?,
        phone:     user.phone,
        avatarUrl: user.userMetadata?['avatar_url'] as String?,
        ffeNumber: user.userMetadata?['ffe_number'] as String?,
      );

  @override
  String toString() => 'AuthUser(id: $id, email: $email)';
}
