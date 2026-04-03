import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../domain/cheval.dart';
import '../providers/chevaux_provider.dart';
import 'cheval_edit_sheet.dart';

class ChevalDetailScreen extends ConsumerWidget {
  const ChevalDetailScreen({super.key, required this.chevalId});
  final String chevalId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cheval = ref.watch(chevalByIdProvider(chevalId));

    if (cheval == null) {
      return Scaffold(
        appBar: AppBar(leading: BackButton(onPressed: () => context.pop())),
        body: const Center(child: Text('Cheval introuvable')),
      );
    }

    return Scaffold(
      backgroundColor: AppColors.background,
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => showDialog(
          context: context,
          builder: (_) => Dialog(
            insetPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
            backgroundColor: Colors.transparent,
            child: ChevalEditSheet(cheval: cheval),
          ),
        ),
        backgroundColor: AppColors.primary,
        icon: const Icon(Icons.edit_rounded, color: Colors.white),
        label: const Text('Modifier', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
      ),
      body: CustomScrollView(
        slivers: [
          _HeroPhoto(cheval: cheval),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 100),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SizedBox(height: 16),

                  // ── 1. Identité ────────────────────────────
                  _IdentiteCard(cheval: cheval),
                  const SizedBox(height: 12),

                  // ── 2. Santé ───────────────────────────────
                  if (_hasSante(cheval)) ...[
                    _SanteCard(sante: cheval.sante!),
                    const SizedBox(height: 12),
                  ],

                  // ── 3. Profil & comportement ───────────────
                  if (_hasProfil(cheval)) ...[
                    _ProfilCard(cheval: cheval),
                    const SizedBox(height: 12),
                  ],

                  // ── 4. Sport & travail ─────────────────────
                  if (_hasSport(cheval)) ...[
                    _SportCard(cheval: cheval),
                    const SizedBox(height: 12),
                  ],

                  // ── 5. Gestion ─────────────────────────────
                  if (_hasGestion(cheval)) ...[
                    _GestionCard(gestion: cheval.gestion!),
                    const SizedBox(height: 12),
                  ],

                  // ── 6. Concours à venir ────────────────────
                  _Section(
                    icon: Icons.emoji_events_rounded,
                    color: AppColors.primary,
                    titre: 'Concours à venir',
                    badge: cheval.concours.length,
                    child: cheval.concours.isEmpty
                        ? const _Vide(message: 'Aucun concours à venir')
                        : Column(children: cheval.concours.map((c) => _ConcourRow(concour: c)).toList()),
                  ),
                  const SizedBox(height: 12),

                  // ── 7. Transports ──────────────────────────
                  _Section(
                    icon: Icons.directions_car_rounded,
                    color: const Color(0xFF0369A1),
                    titre: 'Transports réservés',
                    badge: cheval.trajets.length,
                    child: cheval.trajets.isEmpty
                        ? const _Vide(message: 'Aucun transport réservé')
                        : Column(children: cheval.trajets.map((t) => _TrajetRow(trajet: t)).toList()),
                  ),
                  const SizedBox(height: 12),

                  // ── 8. Boxes ───────────────────────────────
                  _Section(
                    icon: Icons.home_work_rounded,
                    color: const Color(0xFF7C3AED),
                    titre: 'Boxes réservées',
                    badge: cheval.boxes.length,
                    child: cheval.boxes.isEmpty
                        ? const _Vide(message: 'Aucune box réservée')
                        : Column(children: cheval.boxes.map((b) => _BoxRow(box: b)).toList()),
                  ),
                  const SizedBox(height: 12),

                  // ── 9. Coaching ────────────────────────────
                  _Section(
                    icon: Icons.sports_rounded,
                    color: const Color(0xFF16A34A),
                    titre: 'Coaching réservé',
                    badge: cheval.coachs.length,
                    child: cheval.coachs.isEmpty
                        ? const _Vide(message: 'Aucun coaching réservé')
                        : Column(children: cheval.coachs.map((c) => _CoachRow(coach: c)).toList()),
                  ),
                  const SizedBox(height: 12),

                  // ── 10. Résultats ──────────────────────────
                  _Section(
                    icon: Icons.military_tech_rounded,
                    color: const Color(0xFFD97706),
                    titre: 'Résultats passés',
                    badge: cheval.resultats.length,
                    child: cheval.resultats.isEmpty
                        ? const _Vide(message: 'Aucun résultat enregistré')
                        : Column(children: cheval.resultats.map((r) => _ResultatRow(resultat: r)).toList()),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  bool _hasSante(Cheval c) {
    final s = c.sante;
    if (s == null) return false;
    return s.dateVaccinGrippe != null || s.dateVaccinRhino != null || s.dateVermifuge != null ||
        s.dateMarechal != null || s.dateDentiste != null || s.dateOsteo != null ||
        s.antecedents != null || s.allergies != null || s.pathologies != null;
  }

  bool _hasProfil(Cheval c) =>
      c.temperament.isNotEmpty || c.comportementTransport != null ||
      c.habitudes != null || c.sociabilite != null || c.particularitesPhysiques != null;

  bool _hasSport(Cheval c) =>
      c.disciplines.isNotEmpty || c.niveauPratique != null || c.niveauTravail != null ||
      c.frequenceTravail != null || c.objectifs != null;

  bool _hasGestion(Cheval c) {
    final g = c.gestion;
    if (g == null) return false;
    return g.proprietaire != null || g.demiPensionnaire != null || g.responsable != null ||
        g.ecurieActuelle != null || g.typeLitiere != null;
  }
}

// ── Hero photo ────────────────────────────────────────────────────────────────

class _HeroPhoto extends StatelessWidget {
  const _HeroPhoto({required this.cheval});
  final Cheval cheval;

  @override
  Widget build(BuildContext context) {
    final base = cheval.photoColor ?? AppColors.primary;
    return SliverAppBar(
      expandedHeight: 260,
      pinned: true,
      backgroundColor: base,
      surfaceTintColor: Colors.transparent,
      leading: Padding(
        padding: const EdgeInsets.all(8),
        child: GestureDetector(
          onTap: () => context.pop(),
          child: Container(
            decoration: BoxDecoration(color: Colors.black.withOpacity(0.35), shape: BoxShape.circle),
            child: const Icon(Icons.arrow_back_ios_new_rounded, color: Colors.white, size: 18),
          ),
        ),
      ),
      actions: const [],
      flexibleSpace: FlexibleSpaceBar(
        collapseMode: CollapseMode.parallax,
        background: Stack(
          fit: StackFit.expand,
          children: [
            cheval.photoUrl != null
                ? Image.network(cheval.photoUrl!, fit: BoxFit.cover)
                : Container(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [base, Color.lerp(base, Colors.black, 0.4)!],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                    ),
                    child: Center(child: Icon(Icons.local_florist_rounded, size: 90, color: Colors.white.withOpacity(0.15))),
                  ),
            Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.bottomCenter,
                  end: Alignment.center,
                  colors: [Colors.black.withOpacity(0.65), Colors.transparent],
                ),
              ),
            ),
            Positioned(
              bottom: 16, left: 16, right: 16,
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        // Type badge
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: Colors.white.withOpacity(0.20),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            '${cheval.type.emoji} ${cheval.type.label}',
                            style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w700),
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(cheval.nom, style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.w900, shadows: [Shadow(blurRadius: 8)])),
                        if (cheval.subtitle.isNotEmpty)
                          Text(cheval.subtitle, style: TextStyle(color: Colors.white.withOpacity(0.85), fontSize: 13)),
                      ],
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

// ── Identité card ─────────────────────────────────────────────────────────────

class _IdentiteCard extends ConsumerWidget {
  const _IdentiteCard({required this.cheval});
  final Cheval cheval;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return _Card(
      headerIcon: Icons.badge_rounded,
      headerColor: AppColors.primary,
      headerTitle: 'Identité',
      action: null,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _Chip(icon: Icons.local_florist_rounded, label: cheval.type.label, value: cheval.type.emoji, color: AppColors.primary),
              if (cheval.race != null)
                _Chip(icon: Icons.category_rounded, label: 'Race', value: cheval.race!, color: AppColors.primary),
              if (cheval.sexe != null)
                _Chip(icon: Icons.transgender_rounded, label: 'Sexe', value: cheval.sexe!, color: const Color(0xFF0369A1)),
              if (cheval.robe != null)
                _Chip(icon: Icons.palette_rounded, label: 'Robe', value: cheval.robe!, color: const Color(0xFF7C3AED)),
              if (cheval.ageLabel.isNotEmpty)
                _Chip(icon: Icons.cake_rounded, label: 'Âge', value: cheval.ageLabel, color: const Color(0xFFD97706)),
              if (cheval.taille != null)
                _Chip(icon: Icons.straighten_rounded, label: 'Taille', value: cheval.taille!, color: const Color(0xFF16A34A)),
              if (cheval.numeroSire != null)
                _Chip(icon: Icons.fingerprint_rounded, label: 'SIRE', value: cheval.numeroSire!, color: AppColors.textSecondary),
            ],
          ),
          if (cheval.race == null && cheval.sexe == null && cheval.taille == null && cheval.numeroSire == null)
            const Padding(
              padding: EdgeInsets.only(top: 4),
              child: Text('Appuyez sur Modifier pour compléter la fiche.', style: TextStyle(fontSize: 12, color: AppColors.textTertiary, fontStyle: FontStyle.italic)),
            ),
        ],
      ),
    );
  }

}

// ── Santé card ────────────────────────────────────────────────────────────────

class _SanteCard extends StatelessWidget {
  const _SanteCard({required this.sante});
  final SuiviSante sante;

  @override
  Widget build(BuildContext context) {
    return _Card(
      headerIcon: Icons.health_and_safety_rounded,
      headerColor: const Color(0xFF16A34A),
      headerTitle: 'Santé',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Vaccination (critique pour concours)
          Row(
            children: [
              Expanded(child: _VaccinBadge(label: 'Grippe', date: sante.dateVaccinGrippe, status: sante.statutVaccinGrippe, validDays: 180)),
              const SizedBox(width: 8),
              Expanded(child: _VaccinBadge(label: 'Rhino', date: sante.dateVaccinRhino, status: sante.statutVaccinRhino, validDays: 365)),
            ],
          ),
          const SizedBox(height: 10),
          // Suivi
          Wrap(
            spacing: 12,
            runSpacing: 6,
            children: [
              if (sante.dateVermifuge != null) _SuiviItem(icon: Icons.medication_rounded, label: 'Vermifuge', date: sante.dateVermifuge!, color: const Color(0xFF7C3AED)),
              if (sante.dateMarechal != null)  _SuiviItem(icon: Icons.build_rounded,      label: 'Maréchal',  date: sante.dateMarechal!,  color: const Color(0xFF0369A1)),
              if (sante.dateDentiste != null)  _SuiviItem(icon: Icons.local_hospital_rounded, label: 'Dentiste', date: sante.dateDentiste!, color: const Color(0xFFD97706)),
              if (sante.dateOsteo != null)     _SuiviItem(icon: Icons.self_improvement_rounded, label: 'Ostéo',  date: sante.dateOsteo!,   color: const Color(0xFFE11D48)),
            ],
          ),
          if (sante.typeFerrure != null) ...[
            const SizedBox(height: 8),
            Row(children: [
              const Icon(Icons.build_circle_rounded, size: 13, color: AppColors.textTertiary),
              const SizedBox(width: 5),
              Text('Ferrure : ${sante.typeFerrure!.label}', style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
            ]),
          ],
          if (sante.antecedents != null) ...[
            const SizedBox(height: 8),
            _NoteLine(icon: Icons.history_rounded, label: 'Antécédents', text: sante.antecedents!),
          ],
          if (sante.allergies != null) ...[
            const SizedBox(height: 4),
            _NoteLine(icon: Icons.warning_rounded, label: 'Allergies', text: sante.allergies!, color: const Color(0xFFDC2626)),
          ],
          if (sante.pathologies != null) ...[
            const SizedBox(height: 4),
            _NoteLine(icon: Icons.medical_information_rounded, label: 'Pathologies', text: sante.pathologies!),
          ],
        ],
      ),
    );
  }
}

class _VaccinBadge extends StatelessWidget {
  const _VaccinBadge({required this.label, required this.date, required this.status, required this.validDays});
  final String label;
  final DateTime? date;
  final VaccinStatus status;
  final int validDays;

  @override
  Widget build(BuildContext context) {
    final (color, emoji, statusLabel) = switch (status) {
      VaccinStatus.valide         => (const Color(0xFF16A34A), '🟢', 'Valide'),
      VaccinStatus.expireBientot  => (const Color(0xFFD97706), '🟡', 'Expire bientôt'),
      VaccinStatus.expire         => (const Color(0xFFDC2626), '🔴', 'Expiré'),
      VaccinStatus.inconnu        => (AppColors.textTertiary,  '⚪', 'Non renseigné'),
    };
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: color.withOpacity(0.07),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: color.withOpacity(0.25)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Text(emoji, style: const TextStyle(fontSize: 12)),
            const SizedBox(width: 5),
            Text(label, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: color)),
          ]),
          Text(statusLabel, style: TextStyle(fontSize: 10, color: color, fontWeight: FontWeight.w600)),
          if (date != null) Text(DateFormat('d MMM yyyy', 'fr').format(date!), style: const TextStyle(fontSize: 10, color: AppColors.textTertiary)),
        ],
      ),
    );
  }
}

class _SuiviItem extends StatelessWidget {
  const _SuiviItem({required this.icon, required this.label, required this.date, required this.color});
  final IconData icon;
  final String label;
  final DateTime date;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final daysSince = DateTime.now().difference(date).inDays;
    final since = daysSince < 30 ? 'Il y a ${daysSince}j' : DateFormat('d MMM yy', 'fr').format(date);
    return Row(mainAxisSize: MainAxisSize.min, children: [
      Icon(icon, size: 12, color: color),
      const SizedBox(width: 4),
      Text('$label · $since', style: TextStyle(fontSize: 11, color: color, fontWeight: FontWeight.w600)),
    ]);
  }
}

class _NoteLine extends StatelessWidget {
  const _NoteLine({required this.icon, required this.label, required this.text, this.color = AppColors.textSecondary});
  final IconData icon;
  final String label;
  final String text;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Icon(icon, size: 12, color: color),
      const SizedBox(width: 5),
      Expanded(child: RichText(text: TextSpan(
        children: [
          TextSpan(text: '$label : ', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: color)),
          TextSpan(text: text, style: TextStyle(fontSize: 12, color: color)),
        ],
      ))),
    ]);
  }
}

// ── Profil & comportement card ────────────────────────────────────────────────

class _ProfilCard extends StatelessWidget {
  const _ProfilCard({required this.cheval});
  final Cheval cheval;

  @override
  Widget build(BuildContext context) {
    return _Card(
      headerIcon: Icons.psychology_rounded,
      headerColor: const Color(0xFF7C3AED),
      headerTitle: 'Profil & Comportement',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (cheval.temperament.isNotEmpty) ...[
            _Row(label: 'Tempérament'),
            const SizedBox(height: 6),
            Wrap(spacing: 6, runSpacing: 6, children: cheval.temperament.map((t) => _Tag(label: t.label, color: const Color(0xFF7C3AED))).toList()),
            const SizedBox(height: 10),
          ],
          if (cheval.comportementTransport != null)
            _InfoRow(icon: Icons.directions_car_rounded, label: 'Transport', value: cheval.comportementTransport!.label, color: const Color(0xFF0369A1)),
          if (cheval.habitudes != null)
            _InfoRow(icon: Icons.home_rounded, label: 'Habitudes', value: cheval.habitudes!.label, color: const Color(0xFF16A34A)),
          if (cheval.sociabilite != null)
            _InfoRow(icon: Icons.people_rounded, label: 'Sociabilité', value: cheval.sociabilite!.label, color: const Color(0xFF7C3AED)),
          if (cheval.particularitesPhysiques != null)
            _InfoRow(icon: Icons.visibility_rounded, label: 'Particularités', value: cheval.particularitesPhysiques!, color: AppColors.textSecondary),
        ],
      ),
    );
  }
}

// ── Sport & travail card ──────────────────────────────────────────────────────

class _SportCard extends StatelessWidget {
  const _SportCard({required this.cheval});
  final Cheval cheval;

  @override
  Widget build(BuildContext context) {
    return _Card(
      headerIcon: Icons.emoji_events_rounded,
      headerColor: AppColors.primary,
      headerTitle: 'Sport & Travail',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (cheval.disciplines.isNotEmpty) ...[
            _Row(label: 'Disciplines'),
            const SizedBox(height: 6),
            Wrap(spacing: 6, runSpacing: 6, children: cheval.disciplines.map((d) => _Tag(label: d, color: _disciplineColor(d))).toList()),
            const SizedBox(height: 10),
          ],
          if (cheval.niveauPratique != null)
            _InfoRow(icon: Icons.trending_up_rounded, label: 'Niveau pratique', value: cheval.niveauPratique!.label, color: AppColors.primary),
          if (cheval.niveauTravail != null)
            _InfoRow(icon: Icons.fitness_center_rounded, label: 'Niveau travail', value: cheval.niveauTravail!.label, color: const Color(0xFFD97706)),
          if (cheval.frequenceTravail != null)
            _InfoRow(icon: Icons.repeat_rounded, label: 'Fréquence', value: cheval.frequenceTravail!.label, color: const Color(0xFF0369A1)),
          if (cheval.objectifs != null)
            _InfoRow(icon: Icons.flag_rounded, label: 'Objectifs', value: cheval.objectifs!, color: AppColors.textSecondary),
        ],
      ),
    );
  }

  Color _disciplineColor(String d) => switch (d) {
    'CSO'      => AppColors.cso,
    'Dressage' => const Color(0xFF0369A1),
    'CCE'      => const Color(0xFFD97706),
    _          => AppColors.textSecondary,
  };
}

// ── Gestion card ──────────────────────────────────────────────────────────────

class _GestionCard extends StatelessWidget {
  const _GestionCard({required this.gestion});
  final GestionCheval gestion;

  @override
  Widget build(BuildContext context) {
    return _Card(
      headerIcon: Icons.home_work_rounded,
      headerColor: const Color(0xFF0369A1),
      headerTitle: 'Gestion',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (gestion.proprietaire != null)
            _UserRow(role: 'Propriétaire', user: gestion.proprietaire!, color: AppColors.primary),
          if (gestion.demiPensionnaire != null)
            _UserRow(role: 'Demi-pensionnaire', user: gestion.demiPensionnaire!, color: const Color(0xFF7C3AED)),
          if (gestion.responsable != null)
            _UserRow(role: 'Responsable', user: gestion.responsable!, color: const Color(0xFF0369A1)),
          if (gestion.ecurieActuelle != null)
            _InfoRow(icon: Icons.location_on_rounded, label: 'Écurie', value: gestion.ecurieActuelle!, color: const Color(0xFF16A34A)),
          if (gestion.typeLitiere != null)
            _InfoRow(icon: Icons.layers_rounded, label: 'Litière', value: gestion.typeLitiere!.label, color: AppColors.textSecondary),
        ],
      ),
    );
  }
}

class _UserRow extends StatelessWidget {
  const _UserRow({required this.role, required this.user, required this.color});
  final String role;
  final LienUtilisateur user;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        children: [
          Container(
            width: 34, height: 34,
            decoration: BoxDecoration(color: (user.avatarColor ?? color).withOpacity(0.15), shape: BoxShape.circle),
            child: Center(child: Text(user.displayInitiales, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: user.avatarColor ?? color))),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Text(user.nom, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
                if (user.isLinked) ...[
                  const SizedBox(width: 6),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                    decoration: BoxDecoration(color: const Color(0xFF16A34A).withOpacity(0.12), borderRadius: BorderRadius.circular(4)),
                    child: const Text('Lié ✓', style: TextStyle(fontSize: 9, fontWeight: FontWeight.w700, color: Color(0xFF16A34A))),
                  ),
                ],
              ]),
              Text(role, style: const TextStyle(fontSize: 11, color: AppColors.textTertiary)),
            ]),
          ),
        ],
      ),
    );
  }
}

// ── Section container ─────────────────────────────────────────────────────────

class _Card extends StatelessWidget {
  const _Card({required this.headerIcon, required this.headerColor, required this.headerTitle, required this.child, this.action});
  final IconData headerIcon;
  final Color headerColor;
  final String headerTitle;
  final Widget child;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppTheme.radiusXL),
        boxShadow: AppTheme.shadowCard,
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 10),
          child: Row(children: [
            Container(
              width: 30, height: 30,
              decoration: BoxDecoration(color: headerColor.withOpacity(0.10), borderRadius: BorderRadius.circular(8)),
              child: Icon(headerIcon, color: headerColor, size: 16),
            ),
            const SizedBox(width: 8),
            Text(headerTitle, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: AppColors.textPrimary)),
            const Spacer(),
            if (action != null) action!,
          ]),
        ),
        const Divider(height: 1),
        Padding(padding: const EdgeInsets.all(14), child: child),
      ]),
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({required this.icon, required this.color, required this.titre, required this.badge, required this.child});
  final IconData icon;
  final Color color;
  final String titre;
  final int badge;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(color: AppColors.surface, borderRadius: BorderRadius.circular(AppTheme.radiusXL), boxShadow: AppTheme.shadowCard),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 10),
          child: Row(children: [
            Container(width: 30, height: 30, decoration: BoxDecoration(color: color.withOpacity(0.10), borderRadius: BorderRadius.circular(8)), child: Icon(icon, color: color, size: 16)),
            const SizedBox(width: 8),
            Text(titre, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: AppColors.textPrimary)),
            const Spacer(),
            if (badge > 0)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(color: color.withOpacity(0.12), borderRadius: BorderRadius.circular(10)),
                child: Text('$badge', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: color)),
              ),
          ]),
        ),
        const Divider(height: 1),
        Padding(padding: const EdgeInsets.all(14), child: child),
      ]),
    );
  }
}

class _Vide extends StatelessWidget {
  const _Vide({required this.message});
  final String message;

  @override
  Widget build(BuildContext context) => Text(message, style: const TextStyle(fontSize: 13, color: AppColors.textTertiary, fontStyle: FontStyle.italic));
}

// ── Chip / row helpers ────────────────────────────────────────────────────────

class _Chip extends StatelessWidget {
  const _Chip({required this.icon, required this.label, required this.value, required this.color});
  final IconData icon;
  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 6),
      decoration: BoxDecoration(color: color.withOpacity(0.08), borderRadius: BorderRadius.circular(10), border: Border.all(color: color.withOpacity(0.18))),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(icon, size: 12, color: color),
        const SizedBox(width: 4),
        Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label, style: TextStyle(fontSize: 8, fontWeight: FontWeight.w600, color: color.withOpacity(0.7))),
          Text(value, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: color)),
        ]),
      ]),
    );
  }
}

class _Tag extends StatelessWidget {
  const _Tag({required this.label, required this.color});
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
    decoration: BoxDecoration(color: color.withOpacity(0.10), borderRadius: BorderRadius.circular(20), border: Border.all(color: color.withOpacity(0.25))),
    child: Text(label, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: color)),
  );
}

class _Row extends StatelessWidget {
  const _Row({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) => Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.textTertiary));
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.icon, required this.label, required this.value, required this.color});
  final IconData icon;
  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 7),
    child: Row(children: [
      Icon(icon, size: 13, color: color),
      const SizedBox(width: 6),
      Text('$label : ', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.textSecondary)),
      Expanded(child: Text(value, style: const TextStyle(fontSize: 12, color: AppColors.textPrimary))),
    ]),
  );
}

// ── Rows concours / box / trajet / coach / résultat ───────────────────────────

class _ConcourRow extends StatelessWidget {
  const _ConcourRow({required this.concour});
  final ConcourInscrit concour;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Container(
          width: 44,
          padding: const EdgeInsets.symmetric(vertical: 5),
          decoration: BoxDecoration(color: AppColors.primaryLight, borderRadius: BorderRadius.circular(10)),
          child: Column(children: [
            Text(DateFormat('d', 'fr').format(concour.date), style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w900, color: AppColors.primary, height: 1)),
            Text(DateFormat('MMM', 'fr').format(concour.date).toUpperCase(), style: const TextStyle(fontSize: 9, fontWeight: FontWeight.w700, color: AppColors.primary)),
          ]),
        ),
        const SizedBox(width: 10),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(concour.nom, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
          Text(concour.lieu, style: const TextStyle(fontSize: 11, color: AppColors.textSecondary)),
          if (concour.numEngagement != null)
            Text('N° ${concour.numEngagement}', style: const TextStyle(fontSize: 10, color: AppColors.textTertiary)),
        ])),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
          decoration: BoxDecoration(color: AppColors.primaryLight, borderRadius: BorderRadius.circular(5)),
          child: Text(concour.discipline, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.primary)),
        ),
      ]),
    );
  }
}

class _BoxRow extends StatelessWidget {
  const _BoxRow({required this.box});
  final BoxReservee box;

  @override
  Widget build(BuildContext context) {
    const color = Color(0xFF7C3AED);
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(box.ecurieNom, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
            Text(box.concoursNom, style: const TextStyle(fontSize: 11, color: AppColors.textSecondary)),
            Text('${DateFormat('d MMM', 'fr').format(box.dateDebut)} → ${DateFormat('d MMM', 'fr').format(box.dateFin)}', style: const TextStyle(fontSize: 10, color: AppColors.textTertiary)),
          ])),
          Text('${box.prix.toInt()}€', style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: color)),
        ]),
        const SizedBox(height: 6),
        _ContactButton(contactNom: box.contactNom, conversationId: box.conversationId, color: color),
      ]),
    );
  }
}

class _TrajetRow extends StatelessWidget {
  const _TrajetRow({required this.trajet});
  final TrajetReserve trajet;

  @override
  Widget build(BuildContext context) {
    const color = Color(0xFF0369A1);
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          const Icon(Icons.directions_car_rounded, size: 13, color: color),
          const SizedBox(width: 5),
          Expanded(child: Text('${trajet.villeDepart} → ${trajet.villeArrivee}', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.textPrimary))),
          Text('${trajet.prix.toInt()}€', style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: color)),
        ]),
        Padding(
          padding: const EdgeInsets.only(left: 18, top: 2),
          child: Text('${trajet.transporteurNom} · ${DateFormat('d MMM yyyy', 'fr').format(trajet.date)}', style: const TextStyle(fontSize: 11, color: AppColors.textSecondary)),
        ),
        const SizedBox(height: 6),
        _ContactButton(contactNom: trajet.contactNom, conversationId: trajet.conversationId, color: color),
      ]),
    );
  }
}

class _CoachRow extends StatelessWidget {
  const _CoachRow({required this.coach});
  final CoachReserve coach;

  @override
  Widget build(BuildContext context) {
    const color = Color(0xFF16A34A);
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(coach.coachNom, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
            Text('${coach.typeSeance} · ${coach.dureeMin} min · ${coach.lieu}', style: const TextStyle(fontSize: 11, color: AppColors.textSecondary)),
            Text(DateFormat('d MMM yyyy', 'fr').format(coach.date), style: const TextStyle(fontSize: 10, color: AppColors.textTertiary)),
          ])),
          Text('${coach.prix.toInt()}€', style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: color)),
        ]),
        const SizedBox(height: 6),
        _ContactButton(contactNom: coach.contactNom, conversationId: coach.conversationId, color: color),
      ]),
    );
  }
}

class _ResultatRow extends StatelessWidget {
  const _ResultatRow({required this.resultat});
  final ResultatConcours resultat;

  @override
  Widget build(BuildContext context) {
    const color = Color(0xFFD97706);
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Container(
          width: 48,
          padding: const EdgeInsets.symmetric(vertical: 7),
          decoration: BoxDecoration(
            color: resultat.isPodium ? color.withOpacity(0.10) : AppColors.background,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: resultat.isPodium ? color.withOpacity(0.25) : AppColors.border),
          ),
          child: Column(children: [
            Text(resultat.isPodium ? resultat.podiumEmoji : '${resultat.classement}e', style: TextStyle(fontSize: resultat.isPodium ? 18 : 14, fontWeight: FontWeight.w900, height: 1, color: color)),
            Text('/ ${resultat.nbParticipants}', style: const TextStyle(fontSize: 9, color: AppColors.textTertiary)),
          ]),
        ),
        const SizedBox(width: 10),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Expanded(child: Text(resultat.nom, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.textPrimary))),
            if (resultat.note != null)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(color: color.withOpacity(0.10), borderRadius: BorderRadius.circular(5)),
                child: Text('${resultat.note!.toStringAsFixed(1)}%', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: color)),
              ),
          ]),
          Text('${resultat.lieu} · ${DateFormat('d MMM yyyy', 'fr').format(resultat.date)}', style: const TextStyle(fontSize: 11, color: AppColors.textSecondary)),
          if (resultat.commentaire != null)
            Text('"${resultat.commentaire}"', style: const TextStyle(fontSize: 12, color: AppColors.textSecondary, fontStyle: FontStyle.italic)),
        ])),
      ]),
    );
  }
}

// ── Contact button ────────────────────────────────────────────────────────────

class _ContactButton extends StatelessWidget {
  const _ContactButton({required this.contactNom, this.conversationId, required this.color});
  final String contactNom;
  final String? conversationId;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: 'Contacter $contactNom',
      button: true,
      child: InkWell(
        onTap: () {
          if (conversationId != null) {
            context.push('/messages/$conversationId');
          } else {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text('Ouvrir la conversation avec $contactNom'), backgroundColor: AppColors.textPrimary),
            );
          }
        },
        borderRadius: BorderRadius.circular(8),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
          decoration: BoxDecoration(color: color.withOpacity(0.07), borderRadius: BorderRadius.circular(8), border: Border.all(color: color.withOpacity(0.18))),
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            Icon(Icons.chat_bubble_outline_rounded, size: 13, color: color),
            const SizedBox(width: 5),
            Text('Contacter $contactNom', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: color)),
          ]),
        ),
      ),
    );
  }
}
