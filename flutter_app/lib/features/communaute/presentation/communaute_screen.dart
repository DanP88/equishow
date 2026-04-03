import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_colors.dart';
import '../domain/post_feed.dart';
import '../providers/communaute_provider.dart';

// ── Filtres disponibles ───────────────────────────────────────────────────────

const _filters = ['Tous', 'CSO', 'Dressage', 'CCE', 'Concours'];

bool _postMatchesFilter(PostFeed post, String filter) => switch (filter) {
  'Tous'     => true,
  'CSO'      => post.discipline == 'CSO',
  'Dressage' => post.discipline == 'Dressage',
  'CCE'      => post.discipline == 'CCE',
  'Concours' => post.type == PostType.concours,
  _          => true,
};

// ── Screen ────────────────────────────────────────────────────────────────────

class CommunauteScreen extends ConsumerStatefulWidget {
  const CommunauteScreen({super.key});

  @override
  ConsumerState<CommunauteScreen> createState() => _CommunauteScreenState();
}

class _CommunauteScreenState extends ConsumerState<CommunauteScreen> {
  String _activeFilter = 'Tous';

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(communauteProvider);
    final posts = state.isLoading
        ? <PostFeed>[]
        : state.posts.where((p) => _postMatchesFilter(p, _activeFilter)).toList();

    return RefreshIndicator(
      color: AppColors.primary,
      onRefresh: () => ref.read(communauteProvider.notifier).rafraichir(),
      child: CustomScrollView(
        slivers: [
          SliverToBoxAdapter(
            child: _FeedHeader(
              activeFilter: _activeFilter,
              onFilterChanged: (f) => setState(() => _activeFilter = f),
            ),
          ),
          if (state.isLoading)
            const SliverFillRemaining(
              child: Center(child: CircularProgressIndicator(color: AppColors.primary)),
            )
          else if (posts.isEmpty)
            const SliverFillRemaining(child: _EmptyFeed())
          else
            SliverList(
              delegate: SliverChildBuilderDelegate(
                (context, i) => _PostCard(post: posts[i]),
                childCount: posts.length,
              ),
            ),
          const SliverToBoxAdapter(child: SizedBox(height: 20)),
        ],
      ),
    );
  }
}

// ── Feed header ───────────────────────────────────────────────────────────────

class _FeedHeader extends StatelessWidget {
  const _FeedHeader({required this.activeFilter, required this.onFilterChanged});
  final String activeFilter;
  final ValueChanged<String> onFilterChanged;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Communauté',
                      style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: AppColors.textPrimary),
                    ),
                    SizedBox(height: 2),
                    Text(
                      'Suivez l\'activité de vos amis cavaliers',
                      style: TextStyle(fontSize: 13, color: AppColors.textSecondary),
                    ),
                  ],
                ),
              ),
              Semantics(
                label: 'Partager une activité',
                button: true,
                child: GestureDetector(
                  onTap: () {},
                  child: Container(
                    width: 40, height: 40,
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [AppColors.primary, AppColors.primaryDark],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(12),
                      boxShadow: [
                        BoxShadow(
                          color: AppColors.primary.withOpacity(0.30),
                          blurRadius: 8,
                          offset: const Offset(0, 3),
                        ),
                      ],
                    ),
                    child: const Icon(Icons.edit_rounded, color: Colors.white, size: 18),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          // ── Filter chips scrollable ──────────────────
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: _filters.map((f) {
                final isActive = f == activeFilter;
                return Padding(
                  padding: EdgeInsets.only(right: f != _filters.last ? 8 : 0),
                  child: _FilterChip(
                    label: _filterLabel(f),
                    isActive: isActive,
                    onTap: () => onFilterChanged(f),
                  ),
                );
              }).toList(),
            ),
          ),
          const SizedBox(height: 16),
        ],
      ),
    );
  }

  String _filterLabel(String f) => switch (f) {
    'CSO'      => 'CSO 🟢',
    'Dressage' => 'Dressage 🔵',
    'CCE'      => 'CCE 🟠',
    'Concours' => 'Concours 🏆',
    _          => f,
  };
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({required this.label, required this.isActive, required this.onTap});
  final String label;
  final bool isActive;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: label,
      button: true,
      selected: isActive,
      child: GestureDetector(
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
          decoration: BoxDecoration(
            color: isActive ? AppColors.primary : AppColors.surface,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: isActive ? AppColors.primary : AppColors.borderMedium,
              width: 1.5,
            ),
          ),
          child: Text(
            label,
            style: TextStyle(
              fontSize: 12.5,
              fontWeight: FontWeight.w600,
              color: isActive ? Colors.white : AppColors.textSecondary,
            ),
          ),
        ),
      ),
    );
  }
}

// ── Empty state ───────────────────────────────────────────────────────────────

class _EmptyFeed extends StatelessWidget {
  const _EmptyFeed();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(40),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: const [
            Text('🐴', style: TextStyle(fontSize: 48)),
            SizedBox(height: 16),
            Text(
              'Aucune activité pour ce filtre',
              style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
              textAlign: TextAlign.center,
            ),
            SizedBox(height: 6),
            Text(
              'Essayez un autre filtre ou revenez plus tard.',
              style: TextStyle(fontSize: 13, color: AppColors.textSecondary),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}

// ── Post card — ConsumerWidget pour accéder au provider sans stocker ref ──────

class _PostCard extends ConsumerWidget {
  const _PostCard({required this.post});
  final PostFeed post;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 0, 16, 12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Header auteur ──────────────────────────────
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 14, 14, 0),
            child: Row(
              children: [
                Container(
                  width: 38, height: 38,
                  decoration: BoxDecoration(
                    color: post.auteurColor.withOpacity(0.15),
                    shape: BoxShape.circle,
                  ),
                  child: Center(
                    child: Text(
                      post.auteurInitiales,
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w800,
                        color: post.auteurColor,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        post.auteurNom,
                        style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
                      ),
                      Text(
                        _timeAgo(post.date),
                        style: const TextStyle(fontSize: 11.5, color: AppColors.textTertiary),
                      ),
                    ],
                  ),
                ),
                _TypeBadge(type: post.type),
              ],
            ),
          ),
          const SizedBox(height: 12),

          // ── Contenu ────────────────────────────────────
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (post.chevaux != null || post.discipline != null || post.lieu != null) ...[
                  Wrap(
                    spacing: 6,
                    runSpacing: 4,
                    children: [
                      if (post.chevaux != null)
                        _MetaChip(icon: Icons.local_florist_rounded, label: post.chevaux!, color: AppColors.primary),
                      if (post.discipline != null)
                        _MetaChip(icon: Icons.sports_rounded, label: post.discipline!, color: _disciplineColor(post.discipline!)),
                      if (post.lieu != null)
                        _MetaChip(icon: Icons.place_rounded, label: post.lieu!, color: AppColors.textTertiary),
                    ],
                  ),
                  const SizedBox(height: 10),
                ],
                if (post.description != null) ...[
                  Text(
                    post.description!,
                    style: const TextStyle(fontSize: 13.5, color: AppColors.textPrimary, height: 1.45),
                  ),
                  const SizedBox(height: 10),
                ],
                if (post.dureeMin != null || post.intensite != null)
                  _SeanceStats(dureeMin: post.dureeMin, intensite: post.intensite),
              ],
            ),
          ),

          const SizedBox(height: 14),
          const Divider(height: 1, color: AppColors.border),

          // ── Réactions + commentaires ───────────────────
          Padding(
            padding: const EdgeInsets.fromLTRB(8, 6, 14, 8),
            child: Row(
              children: [
                _ReactionButton(
                  emoji: '❤️',
                  count: post.reactions.like,
                  isActive: post.reactions.userReaction == Reaction.like,
                  onTap: () => ref.read(communauteProvider.notifier).toggleReaction(post.id, Reaction.like),
                ),
                _ReactionButton(
                  emoji: '🔥',
                  count: post.reactions.fire,
                  isActive: post.reactions.userReaction == Reaction.fire,
                  onTap: () => ref.read(communauteProvider.notifier).toggleReaction(post.id, Reaction.fire),
                ),
                _ReactionButton(
                  emoji: '💪',
                  count: post.reactions.muscle,
                  isActive: post.reactions.userReaction == Reaction.muscle,
                  onTap: () => ref.read(communauteProvider.notifier).toggleReaction(post.id, Reaction.muscle),
                ),
                _ReactionButton(
                  emoji: '🏆',
                  count: post.reactions.trophy,
                  isActive: post.reactions.userReaction == Reaction.trophy,
                  onTap: () => ref.read(communauteProvider.notifier).toggleReaction(post.id, Reaction.trophy),
                ),
                const Spacer(),
                Semantics(
                  label: '${post.commentairesCount} commentaires',
                  button: true,
                  child: GestureDetector(
                    onTap: () {},
                    child: Row(
                      children: [
                        const Icon(Icons.chat_bubble_outline_rounded, size: 14, color: AppColors.textTertiary),
                        const SizedBox(width: 4),
                        Text(
                          '${post.commentairesCount}',
                          style: const TextStyle(fontSize: 12, color: AppColors.textTertiary, fontWeight: FontWeight.w600),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(width: 14),
                Semantics(
                  label: 'Partager',
                  button: true,
                  child: GestureDetector(
                    onTap: () {},
                    child: const Icon(Icons.share_rounded, size: 17, color: AppColors.textTertiary),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  String _timeAgo(DateTime date) {
    final diff = DateTime.now().difference(date);
    if (diff.inSeconds < 60) return 'À l\'instant';
    if (diff.inMinutes < 60) return 'Il y a ${diff.inMinutes} min';
    if (diff.inHours < 24)   return 'Il y a ${diff.inHours}h';
    return 'Il y a ${diff.inDays}j';
  }

  Color _disciplineColor(String d) => switch (d) {
    'CSO'      => AppColors.cso,
    'Dressage' => const Color(0xFF0369A1),
    'CCE'      => const Color(0xFFD97706), // ambre — distinct du primary orange
    _          => AppColors.textTertiary,
  };
}

// ── Reaction button ───────────────────────────────────────────────────────────

class _ReactionButton extends StatelessWidget {
  const _ReactionButton({
    required this.emoji,
    required this.count,
    required this.isActive,
    required this.onTap,
  });
  final String emoji;
  final int count;
  final bool isActive;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: '$emoji $count',
      button: true,
      child: GestureDetector(
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          margin: const EdgeInsets.only(right: 4),
          padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
          decoration: BoxDecoration(
            color: isActive ? AppColors.primaryLight : Colors.transparent,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: isActive ? AppColors.primaryBorder : Colors.transparent,
              width: 1,
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(emoji, style: const TextStyle(fontSize: 14)),
              if (count > 0) ...[
                const SizedBox(width: 4),
                Text(
                  '$count',
                  style: TextStyle(
                    fontSize: 11.5,
                    fontWeight: FontWeight.w700,
                    color: isActive ? AppColors.primary : AppColors.textTertiary,
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

// ── Type badge ────────────────────────────────────────────────────────────────

class _TypeBadge extends StatelessWidget {
  const _TypeBadge({required this.type});
  final PostType type;

  @override
  Widget build(BuildContext context) {
    final (label, color) = switch (type) {
      PostType.seance   => ('Séance',   const Color(0xFF7C3AED)),
      PostType.concours => ('Concours', const Color(0xFFF97316)),
      PostType.progres  => ('Progrès',  const Color(0xFF16A34A)),
      PostType.photo    => ('Photo',    const Color(0xFF0369A1)),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
      decoration: BoxDecoration(
        color: color.withOpacity(0.10),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        label,
        style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: color),
      ),
    );
  }
}

// ── Meta chip ─────────────────────────────────────────────────────────────────

class _MetaChip extends StatelessWidget {
  const _MetaChip({required this.icon, required this.label, required this.color});
  final IconData icon;
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 12, color: color),
        const SizedBox(width: 3),
        Text(
          label,
          style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: color),
        ),
      ],
    );
  }
}

// ── Séance stats ──────────────────────────────────────────────────────────────

class _SeanceStats extends StatelessWidget {
  const _SeanceStats({this.dureeMin, this.intensite});
  final int? dureeMin;
  final double? intensite;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: AppColors.background,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        children: [
          if (dureeMin != null) ...[
            const Icon(Icons.timer_outlined, size: 15, color: AppColors.textTertiary),
            const SizedBox(width: 4),
            Text(
              '${dureeMin}min',
              style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: AppColors.textSecondary),
            ),
          ],
          if (dureeMin != null && intensite != null)
            const SizedBox(width: 16),
          if (intensite != null) ...[
            const Text(
              'Intensité',
              style: TextStyle(fontSize: 12, color: AppColors.textTertiary),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: LinearProgressIndicator(
                  value: intensite,
                  backgroundColor: AppColors.borderMedium,
                  valueColor: AlwaysStoppedAnimation<Color>(_intensiteColor(intensite!)),
                  minHeight: 6,
                ),
              ),
            ),
            const SizedBox(width: 8),
            Text(
              '${(intensite! * 100).round()}%',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: _intensiteColor(intensite!),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Color _intensiteColor(double v) {
    if (v < 0.40) return const Color(0xFF16A34A);
    if (v < 0.70) return const Color(0xFFF97316);
    return const Color(0xFFDC2626);
  }
}
