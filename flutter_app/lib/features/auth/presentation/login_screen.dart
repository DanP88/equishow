import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../domain/user_auth.dart';
import '../providers/auth_provider.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/eq_button.dart';
import '../../../core/widgets/eq_states.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _emailCtrl    = TextEditingController();
  final _passwordCtrl = TextEditingController();
  final _formKey      = GlobalKey<FormState>();
  bool _obscure = true;

  @override
  void dispose() {
    _emailCtrl.dispose();
    _passwordCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    await ref.read(authProvider.notifier).login(
      email: _emailCtrl.text.trim(),
      password: _passwordCtrl.text,
    );
  }

  @override
  Widget build(BuildContext context) {
    final isLoading = ref.watch(isLoadingAuthProvider);
    final authState = ref.watch(authProvider);

    // Afficher erreur si présente
    if (authState is AuthError) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        EQSnackbar.show(context, message: authState.message, isSuccess: false);
      });
    }

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SizedBox(height: 40),

                // ── Logo + titre ──────────────────────────
                Center(
                  child: Column(
                    children: [
                      Container(
                        width: 72, height: 72,
                        decoration: BoxDecoration(
                          gradient: const LinearGradient(
                            colors: [AppColors.primary, AppColors.primaryDark],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          ),
                          borderRadius: BorderRadius.circular(20),
                          boxShadow: AppTheme.shadowFab,
                        ),
                        child: const Center(
                          child: Text('🏆', style: TextStyle(fontSize: 32)),
                        ),
                      ),
                      const SizedBox(height: 16),
                      const Text(
                        'Equishow',
                        style: TextStyle(fontSize: 28, fontWeight: FontWeight.w900, color: AppColors.textPrimary, letterSpacing: -0.5),
                      ),
                      const SizedBox(height: 4),
                      const Text(
                        'Votre compagnon de concours',
                        style: TextStyle(fontSize: 14, color: AppColors.textSecondary),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 40),

                // ── SSO Buttons ───────────────────────────
                _SSOButton(
                  label: 'Continuer avec Apple',
                  icon: Icons.apple_rounded,
                  onPressed: isLoading ? null : () => ref.read(authProvider.notifier).loginWithApple(),
                ),
                const SizedBox(height: 10),
                _SSOButton(
                  label: 'Continuer avec Google',
                  iconAsset: 'G',
                  onPressed: isLoading ? null : () => ref.read(authProvider.notifier).loginWithGoogle(),
                ),
                const SizedBox(height: 24),

                // ── Séparateur ────────────────────────────
                Row(
                  children: [
                    const Expanded(child: Divider(color: AppColors.borderMedium)),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      child: Text(
                        'ou par email',
                        style: TextStyle(fontSize: 12, color: AppColors.textTertiary, fontWeight: FontWeight.w500),
                      ),
                    ),
                    const Expanded(child: Divider(color: AppColors.borderMedium)),
                  ],
                ),
                const SizedBox(height: 24),

                // ── Email ─────────────────────────────────
                const _FieldLabel('Adresse email'),
                const SizedBox(height: 6),
                TextFormField(
                  controller: _emailCtrl,
                  keyboardType: TextInputType.emailAddress,
                  textInputAction: TextInputAction.next,
                  autocorrect: false,
                  decoration: const InputDecoration(
                    hintText: 'vous@example.com',
                    prefixIcon: Icon(Icons.mail_outline_rounded, size: 18, color: AppColors.textTertiary),
                  ),
                  validator: (v) {
                    if (v == null || v.trim().isEmpty) return 'Email requis';
                    if (!v.contains('@')) return 'Email invalide';
                    return null;
                  },
                ),
                const SizedBox(height: 14),

                // ── Mot de passe ──────────────────────────
                const _FieldLabel('Mot de passe'),
                const SizedBox(height: 6),
                TextFormField(
                  controller: _passwordCtrl,
                  obscureText: _obscure,
                  textInputAction: TextInputAction.done,
                  onFieldSubmitted: (_) => _submit(),
                  decoration: InputDecoration(
                    hintText: '••••••••',
                    prefixIcon: const Icon(Icons.lock_outline_rounded, size: 18, color: AppColors.textTertiary),
                    suffixIcon: IconButton(
                      icon: Icon(_obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined, size: 18, color: AppColors.textTertiary),
                      onPressed: () => setState(() => _obscure = !_obscure),
                    ),
                  ),
                  validator: (v) {
                    if (v == null || v.isEmpty) return 'Mot de passe requis';
                    if (v.length < 6) return 'Minimum 6 caractères';
                    return null;
                  },
                ),
                const SizedBox(height: 8),

                // ── Mot de passe oublié ───────────────────
                Align(
                  alignment: Alignment.centerRight,
                  child: Semantics(
                    label: 'Mot de passe oublié',
                    button: true,
                    child: GestureDetector(
                      onTap: () => EQSnackbar.show(context, message: 'Email de récupération envoyé', isSuccess: true),
                      child: const Text('Mot de passe oublié ?', style: TextStyle(fontSize: 13, color: AppColors.primary, fontWeight: FontWeight.w600)),
                    ),
                  ),
                ),
                const SizedBox(height: 28),

                // ── Se connecter ──────────────────────────
                EQButton(
                  label: isLoading ? 'Connexion…' : 'Se connecter',
                  onPressed: isLoading ? null : _submit,
                  isLoading: isLoading,
                  fullWidth: true,
                ),
                const SizedBox(height: 20),

                // ── Créer un compte ───────────────────────
                Center(
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Text('Pas encore de compte ? ', style: TextStyle(fontSize: 13.5, color: AppColors.textSecondary)),
                      Semantics(
                        label: 'Créer un compte',
                        button: true,
                        child: GestureDetector(
                          onTap: () => context.go('/signup'),
                          child: const Text('S\'inscrire', style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700, color: AppColors.primary)),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 32),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ── Widgets helpers ────────────────────────────────────────────────────────────

class _FieldLabel extends StatelessWidget {
  const _FieldLabel(this.text);
  final String text;

  @override
  Widget build(BuildContext context) => Text(
    text,
    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
  );
}

class _SSOButton extends StatelessWidget {
  const _SSOButton({required this.label, required this.onPressed, this.icon, this.iconAsset});
  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final String? iconAsset;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: label,
      button: true,
      child: SizedBox(
        height: 48,
        child: OutlinedButton(
          onPressed: onPressed,
          style: OutlinedButton.styleFrom(
            side: const BorderSide(color: AppColors.borderMedium),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppTheme.radiusMD)),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (icon != null)
                Icon(icon!, size: 18, color: AppColors.textPrimary)
              else
                Container(
                  width: 18, height: 18,
                  decoration: BoxDecoration(
                    color: AppColors.textPrimary,
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Center(
                    child: Text(iconAsset!, style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w900)),
                  ),
                ),
              const SizedBox(width: 10),
              Text(label, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
            ],
          ),
        ),
      ),
    );
  }
}
