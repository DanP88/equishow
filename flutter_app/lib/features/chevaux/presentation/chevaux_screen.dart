import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../domain/cheval.dart';
import '../providers/chevaux_provider.dart';

class ChevauxScreen extends ConsumerWidget {
  const ChevauxScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(chevauxProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      body: CustomScrollView(
        slivers: [
          // ── Header ──────────────────────────────────────────
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 20, 20, 8),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Mes Chevaux',
                          style: Theme.of(context).textTheme.headlineMedium,
                        ),
                        const SizedBox(height: 2),
                        Text(
                          '${state.chevaux.length} cheval${state.chevaux.length > 1 ? 'x' : ''} enregistré${state.chevaux.length > 1 ? 's' : ''}',
                          style: Theme.of(context).textTheme.bodyMedium,
                        ),
                      ],
                    ),
                  ),
                  // Bouton ajouter
                  Semantics(
                    label: 'Ajouter un cheval',
                    button: true,
                    child: GestureDetector(
                      onTap: () => _showAjouterCheval(context, ref),
                      child: Container(
                        width: 40, height: 40,
                        decoration: BoxDecoration(
                          color: AppColors.primaryLight,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: AppColors.primaryBorder),
                        ),
                        child: const Icon(Icons.add_rounded, color: AppColors.primary, size: 22),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),

          // ── Loading ──────────────────────────────────────────
          if (state.isLoading)
            const SliverFillRemaining(
              child: Center(
                child: CircularProgressIndicator(color: AppColors.primary, strokeWidth: 2.5),
              ),
            )

          // ── Liste des chevaux ────────────────────────────────
          else if (state.chevaux.isEmpty)
            SliverFillRemaining(
              child: _EmptyState(onAjouter: () => _showAjouterCheval(context, ref)),
            )
          else
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
              sliver: SliverList(
                delegate: SliverChildBuilderDelegate(
                  (_, i) => Padding(
                    padding: const EdgeInsets.only(bottom: 16),
                    child: _ChevalCard(
                      cheval: state.chevaux[i],
                      onTap: () => context.go('/chevaux/${state.chevaux[i].id}'),
                      onPhoto: () => _onPhotoTap(context, ref, state.chevaux[i].id),
                    ),
                  ),
                  childCount: state.chevaux.length,
                ),
              ),
            ),
        ],
      ),
    );
  }

  void _onPhotoTap(BuildContext context, WidgetRef ref, String chevalId) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (_) => _PhotoSheet(chevalId: chevalId),
    );
  }

  void _showAjouterCheval(BuildContext context, WidgetRef ref) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const _AjouterChevalSheet(),
    );
  }
}

// ── Card cheval ───────────────────────────────────────────────────────────────

class _ChevalCard extends StatelessWidget {
  const _ChevalCard({required this.cheval, required this.onTap, required this.onPhoto});
  final Cheval cheval;
  final VoidCallback onTap;
  final VoidCallback onPhoto;

  @override
  Widget build(BuildContext context) {
    final prochain = cheval.prochainConcours;

    return Semantics(
      label: cheval.nom,
      button: true,
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(AppTheme.radiusXXL),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.06),
                blurRadius: 12,
                offset: const Offset(0, 3),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // ── Photo (ou placeholder) ─────────────────────
              Stack(
                children: [
                  ClipRRect(
                    borderRadius: const BorderRadius.vertical(top: Radius.circular(AppTheme.radiusXXL)),
                    child: cheval.photoUrl != null
                        ? Image.network(
                            cheval.photoUrl!,
                            height: 200,
                            width: double.infinity,
                            fit: BoxFit.cover,
                          )
                        : _PhotoPlaceholder(cheval: cheval),
                  ),
                  // Overlay gradient bas de photo
                  Positioned(
                    bottom: 0, left: 0, right: 0,
                    child: ClipRRect(
                      borderRadius: const BorderRadius.vertical(top: Radius.circular(AppTheme.radiusXXL)),
                      child: Container(
                        height: 80,
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.bottomCenter,
                            end: Alignment.topCenter,
                            colors: [Colors.black.withOpacity(0.55), Colors.transparent],
                          ),
                        ),
                      ),
                    ),
                  ),
                  // Nom en bas de la photo
                  Positioned(
                    bottom: 12, left: 16,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          cheval.nom,
                          style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w900, shadows: [Shadow(blurRadius: 4)]),
                        ),
                        if (cheval.subtitle.isNotEmpty)
                          Text(
                            cheval.subtitle,
                            style: TextStyle(color: Colors.white.withOpacity(0.85), fontSize: 12, fontWeight: FontWeight.w500),
                          ),
                      ],
                    ),
                  ),
                  // Bouton photo
                  Positioned(
                    top: 12, right: 12,
                    child: Semantics(
                      label: 'Modifier la photo',
                      button: true,
                      child: GestureDetector(
                        onTap: onPhoto,
                        child: Container(
                          width: 36, height: 36,
                          decoration: BoxDecoration(
                            color: Colors.black.withOpacity(0.45),
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(Icons.camera_alt_rounded, color: Colors.white, size: 18),
                        ),
                      ),
                    ),
                  ),
                ],
              ),

              // ── Infos bas de carte ─────────────────────────
              Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Prochain concours
                    if (prochain != null) ...[
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: AppColors.primaryLight,
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              prochain.discipline,
                              style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.primary),
                            ),
                          ),
                          const SizedBox(width: 8),
                          const Icon(Icons.calendar_today_rounded, size: 12, color: AppColors.textTertiary),
                          const SizedBox(width: 4),
                          Text(
                            DateFormat('d MMM', 'fr').format(prochain.date),
                            style: const TextStyle(fontSize: 12, color: AppColors.textSecondary, fontWeight: FontWeight.w600),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Text(
                        prochain.nom,
                        style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
                      ),
                      Text(
                        prochain.lieu,
                        style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                      ),
                    ] else
                      const Text(
                        'Aucun concours à venir',
                        style: TextStyle(fontSize: 13, color: AppColors.textTertiary, fontStyle: FontStyle.italic),
                      ),

                    const SizedBox(height: 12),

                    // Compteurs réservations
                    _ReservCountRow(cheval: cheval),

                    const SizedBox(height: 12),

                    // CTA
                    SizedBox(
                      width: double.infinity,
                      child: OutlinedButton(
                        onPressed: onTap,
                        style: OutlinedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 10),
                          side: const BorderSide(color: AppColors.borderMedium),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppTheme.radiusMD)),
                        ),
                        child: const Text('Voir la fiche complète', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Résumé compteurs ──────────────────────────────────────────────────────────

class _ReservCountRow extends StatelessWidget {
  const _ReservCountRow({required this.cheval});
  final Cheval cheval;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        _Counter(icon: Icons.emoji_events_rounded,   color: AppColors.primary,              count: cheval.concours.length, label: 'Concours'),
        const SizedBox(width: 12),
        _Counter(icon: Icons.home_work_rounded,       color: const Color(0xFF7C3AED),        count: cheval.boxes.length,    label: 'Boxes'),
        const SizedBox(width: 12),
        _Counter(icon: Icons.directions_car_rounded,  color: const Color(0xFF0369A1),        count: cheval.trajets.length,  label: 'Trajets'),
        const SizedBox(width: 12),
        _Counter(icon: Icons.sports_rounded,          color: const Color(0xFF16A34A),        count: cheval.coachs.length,   label: 'Coachs'),
      ],
    );
  }
}

class _Counter extends StatelessWidget {
  const _Counter({required this.icon, required this.color, required this.count, required this.label});
  final IconData icon;
  final Color color;
  final int count;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 8),
        decoration: BoxDecoration(
          color: color.withOpacity(0.08),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Column(
          children: [
            Icon(icon, color: color, size: 16),
            const SizedBox(height: 2),
            Text('$count', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: color)),
            Text(label, style: const TextStyle(fontSize: 9, color: AppColors.textTertiary, fontWeight: FontWeight.w500)),
          ],
        ),
      ),
    );
  }
}

// ── Placeholder photo ─────────────────────────────────────────────────────────

class _PhotoPlaceholder extends StatelessWidget {
  const _PhotoPlaceholder({required this.cheval});
  final Cheval cheval;

  @override
  Widget build(BuildContext context) {
    final base = cheval.photoColor ?? AppColors.primary;
    return Container(
      height: 200,
      width: double.infinity,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [base, Color.lerp(base, Colors.black, 0.3)!],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: Center(
        child: Icon(
          Icons.local_florist_rounded, // silhouette cheval placeholder
          size: 72,
          color: Colors.white.withOpacity(0.20),
        ),
      ),
    );
  }
}

// ── Empty state ───────────────────────────────────────────────────────────────

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.onAjouter});
  final VoidCallback onAjouter;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 80, height: 80,
              decoration: BoxDecoration(
                color: AppColors.primaryLight,
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.local_florist_rounded, size: 40, color: AppColors.primary),
            ),
            const SizedBox(height: 20),
            Text('Aucun cheval enregistré', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            const Text(
              'Ajoutez votre premier cheval pour suivre\nses concours, réservations et coaching.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 14, color: AppColors.textSecondary, height: 1.5),
            ),
            const SizedBox(height: 24),
            ElevatedButton.icon(
              onPressed: onAjouter,
              icon: const Icon(Icons.add_rounded),
              label: const Text('Ajouter un cheval'),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Sheet photo ───────────────────────────────────────────────────────────────

class _PhotoSheet extends StatelessWidget {
  const _PhotoSheet({required this.chevalId});
  final String chevalId;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(12, 0, 12, 20),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(24),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const SizedBox(height: 12),
          Container(width: 36, height: 4, decoration: BoxDecoration(color: AppColors.borderMedium, borderRadius: BorderRadius.circular(2))),
          const SizedBox(height: 20),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Photo du cheval', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: AppColors.textPrimary)),
                const SizedBox(height: 4),
                const Text('Choisissez une source', style: TextStyle(fontSize: 13, color: AppColors.textSecondary)),
                const SizedBox(height: 20),
                _PhotoOption(
                  icon: Icons.photo_library_rounded,
                  label: 'Galerie photos',
                  onTap: () {
                    Navigator.pop(context);
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Sélection photo disponible en version finale'), backgroundColor: AppColors.textPrimary),
                    );
                  },
                ),
                const SizedBox(height: 8),
                _PhotoOption(
                  icon: Icons.camera_alt_rounded,
                  label: 'Appareil photo',
                  onTap: () {
                    Navigator.pop(context);
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Appareil photo disponible en version finale'), backgroundColor: AppColors.textPrimary),
                    );
                  },
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _PhotoOption extends StatelessWidget {
  const _PhotoOption({required this.icon, required this.label, required this.onTap});
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: label,
      button: true,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          decoration: BoxDecoration(
            color: AppColors.surfaceVariant,
            borderRadius: BorderRadius.circular(14),
          ),
          child: Row(
            children: [
              Icon(icon, color: AppColors.primary, size: 22),
              const SizedBox(width: 14),
              Text(label, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
              const Spacer(),
              const Icon(Icons.chevron_right_rounded, color: AppColors.textTertiary, size: 20),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Sheet ajouter un cheval ───────────────────────────────────────────────────

class _AjouterChevalSheet extends ConsumerStatefulWidget {
  const _AjouterChevalSheet();

  @override
  ConsumerState<_AjouterChevalSheet> createState() => _AjouterChevalSheetState();
}

class _AjouterChevalSheetState extends ConsumerState<_AjouterChevalSheet> {
  final _nomCtrl   = TextEditingController();
  final _raceCtrl  = TextEditingController();
  final _robeCtrl  = TextEditingController();
  final _anneeCtrl = TextEditingController();
  TypeCheval _type = TypeCheval.cheval;
  bool _loading = false;

  @override
  void dispose() {
    _nomCtrl.dispose();
    _raceCtrl.dispose();
    _robeCtrl.dispose();
    _anneeCtrl.dispose();
    super.dispose();
  }

  Future<void> _ajouter() async {
    if (_nomCtrl.text.trim().isEmpty) return;
    setState(() => _loading = true);
    final cheval = Cheval(
      id: 'ch_${DateTime.now().millisecondsSinceEpoch}',
      nom: _nomCtrl.text.trim(),
      proprietaireId: 'user_1',
      type: _type,
      race: _raceCtrl.text.trim().isEmpty ? null : _raceCtrl.text.trim(),
      robe: _robeCtrl.text.trim().isEmpty ? null : _robeCtrl.text.trim(),
      anneeNaissance: int.tryParse(_anneeCtrl.text.trim()),
      photoColor: AppColors.primary,
    );
    await ref.read(chevauxProvider.notifier).ajouterCheval(cheval);
    if (mounted) Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Container(
        margin: const EdgeInsets.fromLTRB(12, 0, 12, 20),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(24),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 12),
            Container(width: 36, height: 4, decoration: BoxDecoration(color: AppColors.borderMedium, borderRadius: BorderRadius.circular(2))),
            const SizedBox(height: 20),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Ajouter un cheval', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: AppColors.textPrimary)),
                  const SizedBox(height: 20),
                  // Type : Cheval / Poney
                  Row(
                    children: TypeCheval.values.map((t) {
                      final selected = _type == t;
                      return Expanded(
                        child: GestureDetector(
                          onTap: () => setState(() => _type = t),
                          child: AnimatedContainer(
                            duration: const Duration(milliseconds: 150),
                            margin: EdgeInsets.only(right: t == TypeCheval.cheval ? 8 : 0),
                            padding: const EdgeInsets.symmetric(vertical: 10),
                            decoration: BoxDecoration(
                              color: selected ? AppColors.primaryLight : AppColors.surfaceVariant,
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: selected ? AppColors.primaryBorder : AppColors.border),
                            ),
                            child: Column(
                              children: [
                                Text(t.emoji, style: const TextStyle(fontSize: 22)),
                                const SizedBox(height: 2),
                                Text(t.label, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: selected ? AppColors.primary : AppColors.textSecondary)),
                              ],
                            ),
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _nomCtrl,
                    textCapitalization: TextCapitalization.words,
                    decoration: const InputDecoration(labelText: 'Nom du cheval *', prefixIcon: Icon(Icons.local_florist_rounded)),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _raceCtrl,
                    textCapitalization: TextCapitalization.words,
                    decoration: const InputDecoration(labelText: 'Race', prefixIcon: Icon(Icons.category_rounded)),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: _robeCtrl,
                          textCapitalization: TextCapitalization.words,
                          decoration: const InputDecoration(labelText: 'Robe'),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: TextField(
                          controller: _anneeCtrl,
                          keyboardType: TextInputType.number,
                          decoration: const InputDecoration(labelText: 'Année naissance'),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 20),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: _loading ? null : _ajouter,
                      child: _loading
                          ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                          : const Text('Ajouter le cheval'),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
