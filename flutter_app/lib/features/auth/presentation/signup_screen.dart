import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../domain/user_auth.dart';
import '../providers/auth_provider.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/eq_button.dart';
import '../../../core/widgets/eq_states.dart';

class SignupScreen extends ConsumerStatefulWidget {
  const SignupScreen({super.key});

  @override
  ConsumerState<SignupScreen> createState() => _SignupScreenState();
}

class _SignupScreenState extends ConsumerState<SignupScreen> {
  final _prenomCtrl   = TextEditingController();
  final _nomCtrl      = TextEditingController();
  final _emailCtrl    = TextEditingController();
  final _passwordCtrl = TextEditingController();
  final _formKey      = GlobalKey<FormState>();
  UserRole _role = UserRole.cavalier;
  final Set<Discipline> _disciplines = {};
  bool _obscure = true;
  bool _acceptedCGU = false;

  @override
  void dispose() {
    _prenomCtrl.dispose();
    _nomCtrl.dispose();
    _emailCtrl.dispose();
    _passwordCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    if (!_acceptedCGU) {
      EQSnackbar.show(context, message: 'Veuillez accepter les CGU pour continuer', isSuccess: false);
      return;
    }
    await ref.read(authProvider.notifier).signup(
      email: _emailCtrl.text.trim(),
      password: _passwordCtrl.text,
      prenom: _prenomCtrl.text.trim(),
      nom: _nomCtrl.text.trim(),
      role: _role,
      disciplines: _disciplines.toList(),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isLoading = ref.watch(isLoadingAuthProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        elevation: 0,
        leading: Semantics(
          label: 'Retour',
          button: true,
          child: IconButton(
            icon: const Icon(Icons.arrow_back_rounded, color: AppColors.textPrimary),
            onPressed: () => context.go('/login'),
          ),
        ),
        title: const Text('Créer un compte', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SizedBox(height: 8),

                // ── Rôle ──────────────────────────────────
                const _FieldLabel('Je suis'),
                const SizedBox(height: 10),
                Row(
                  children: UserRole.values.map((r) {
                    final isSelected = _role == r;
                    return Expanded(
                      child: Padding(
                        padding: EdgeInsets.only(right: r != UserRole.coach ? 8 : 0),
                        child: Semantics(
                          label: r.label,
                          button: true,
                          selected: isSelected,
                          child: GestureDetector(
                            onTap: () => setState(() {
                              _role = r;
                              _disciplines.clear(); // reset disciplines on role change
                            }),
                            child: AnimatedContainer(
                              duration: const Duration(milliseconds: 180),
                              padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
                              decoration: BoxDecoration(
                                color: isSelected ? AppColors.primary : AppColors.surface,
                                borderRadius: BorderRadius.circular(AppTheme.radiusMD),
                                border: Border.all(color: isSelected ? AppColors.primary : AppColors.borderMedium, width: 1.5),
                              ),
                              child: Column(
                                children: [
                                  Text(
                                    _roleIcon(r),
                                    style: const TextStyle(fontSize: 18),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    r.label,
                                    style: TextStyle(
                                      fontSize: 11.5,
                                      fontWeight: FontWeight.w700,
                                      color: isSelected ? Colors.white : AppColors.textPrimary,
                                    ),
                                    textAlign: TextAlign.center,
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                      ),
                    );
                  }).toList(),
                ),
                const SizedBox(height: 20),

                // ── Disciplines (cavalier + coach) ─────────
                if (_role == UserRole.cavalier || _role == UserRole.coach) ...[
                  const _FieldLabel('Mes disciplines'),
                  const SizedBox(height: 4),
                  Text(
                    'Sélectionnez une ou plusieurs disciplines',
                    style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
                  ),
                  const SizedBox(height: 10),
                  _DisciplineSelector(
                    selected: _disciplines,
                    onToggle: (d) => setState(() {
                      if (_disciplines.contains(d)) {
                        _disciplines.remove(d);
                      } else {
                        _disciplines.add(d);
                      }
                    }),
                  ),
                  const SizedBox(height: 20),
                ],

                // ── Prénom + Nom ──────────────────────────
                Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const _FieldLabel('Prénom'),
                          const SizedBox(height: 6),
                          TextFormField(
                            controller: _prenomCtrl,
                            textCapitalization: TextCapitalization.words,
                            textInputAction: TextInputAction.next,
                            decoration: const InputDecoration(hintText: 'Sarah'),
                            validator: (v) => (v == null || v.trim().isEmpty) ? 'Requis' : null,
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const _FieldLabel('Nom'),
                          const SizedBox(height: 6),
                          TextFormField(
                            controller: _nomCtrl,
                            textCapitalization: TextCapitalization.words,
                            textInputAction: TextInputAction.next,
                            decoration: const InputDecoration(hintText: 'Dupont'),
                            validator: (v) => (v == null || v.trim().isEmpty) ? 'Requis' : null,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),

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
                    hintText: '8 caractères minimum',
                    prefixIcon: const Icon(Icons.lock_outline_rounded, size: 18, color: AppColors.textTertiary),
                    suffixIcon: IconButton(
                      icon: Icon(_obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined, size: 18, color: AppColors.textTertiary),
                      onPressed: () => setState(() => _obscure = !_obscure),
                    ),
                  ),
                  validator: (v) {
                    if (v == null || v.isEmpty) return 'Mot de passe requis';
                    if (v.length < 8) return 'Minimum 8 caractères';
                    return null;
                  },
                ),
                const SizedBox(height: 20),

                // ── CGU ───────────────────────────────────
                Semantics(
                  label: 'Accepter les conditions générales d\'utilisation',
                  checked: _acceptedCGU,
                  child: GestureDetector(
                    onTap: () => setState(() => _acceptedCGU = !_acceptedCGU),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        AnimatedContainer(
                          duration: const Duration(milliseconds: 150),
                          width: 22, height: 22,
                          decoration: BoxDecoration(
                            color: _acceptedCGU ? AppColors.primary : AppColors.surface,
                            borderRadius: BorderRadius.circular(6),
                            border: Border.all(color: _acceptedCGU ? AppColors.primary : AppColors.borderMedium, width: 1.5),
                          ),
                          child: _acceptedCGU
                              ? const Icon(Icons.check_rounded, size: 14, color: Colors.white)
                              : null,
                        ),
                        const SizedBox(width: 10),
                        const Expanded(
                          child: Text.rich(
                            TextSpan(
                              text: 'J\'accepte les ',
                              style: TextStyle(fontSize: 13, color: AppColors.textSecondary),
                              children: [
                                TextSpan(text: 'Conditions Générales d\'Utilisation', style: TextStyle(color: AppColors.primary, fontWeight: FontWeight.w600)),
                                TextSpan(text: ' et la '),
                                TextSpan(text: 'Politique de Confidentialité', style: TextStyle(color: AppColors.primary, fontWeight: FontWeight.w600)),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 28),

                // ── Créer le compte ───────────────────────
                EQButton(
                  label: isLoading ? 'Création…' : 'Créer mon compte',
                  onPressed: isLoading ? null : _submit,
                  isLoading: isLoading,
                  fullWidth: true,
                ),
                const SizedBox(height: 16),

                Center(
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Text('Déjà un compte ? ', style: TextStyle(fontSize: 13.5, color: AppColors.textSecondary)),
                      Semantics(
                        label: 'Se connecter',
                        button: true,
                        child: GestureDetector(
                          onTap: () => context.go('/login'),
                          child: const Text('Se connecter', style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700, color: AppColors.primary)),
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

  String _roleIcon(UserRole r) => switch (r) {
    UserRole.cavalier     => '🏇',
    UserRole.organisateur => '🏟️',
    UserRole.coach        => '🎖️',
  };
}

// ── Discipline selector ────────────────────────────────────────────────────────

class _DisciplineSelector extends StatelessWidget {
  const _DisciplineSelector({required this.selected, required this.onToggle});
  final Set<Discipline> selected;
  final ValueChanged<Discipline> onToggle;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: Discipline.values.map((d) {
        final isSelected = selected.contains(d);
        final color = _disciplineColor(d);
        return Expanded(
          child: Padding(
            padding: EdgeInsets.only(right: d != Discipline.cce ? 8 : 0),
            child: Semantics(
              label: d.label,
              button: true,
              selected: isSelected,
              child: GestureDetector(
                onTap: () => onToggle(d),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 180),
                  padding: const EdgeInsets.symmetric(vertical: 11, horizontal: 6),
                  decoration: BoxDecoration(
                    color: isSelected ? color.withOpacity(0.10) : AppColors.surface,
                    borderRadius: BorderRadius.circular(AppTheme.radiusMD),
                    border: Border.all(
                      color: isSelected ? color : AppColors.borderMedium,
                      width: 1.5,
                    ),
                  ),
                  child: Column(
                    children: [
                      Text(d.emoji, style: const TextStyle(fontSize: 18)),
                      const SizedBox(height: 4),
                      Text(
                        d.code,
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w800,
                          color: isSelected ? color : AppColors.textSecondary,
                          letterSpacing: 0.4,
                        ),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 1),
                      Text(
                        d.label,
                        style: TextStyle(
                          fontSize: 9.5,
                          fontWeight: FontWeight.w500,
                          color: isSelected ? color : AppColors.textTertiary,
                        ),
                        textAlign: TextAlign.center,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        );
      }).toList(),
    );
  }

  Color _disciplineColor(Discipline d) => switch (d) {
    Discipline.cso      => AppColors.cso,
    Discipline.dressage => const Color(0xFF0369A1),
    Discipline.cce      => const Color(0xFFF97316),
  };
}

class _FieldLabel extends StatelessWidget {
  const _FieldLabel(this.text);
  final String text;

  @override
  Widget build(BuildContext context) => Text(
    text,
    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
  );
}
