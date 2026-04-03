import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../domain/conversation.dart';
import '../providers/messagerie_provider.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/eq_states.dart';

/// Écran Messagerie — liste des conversations
class MessagerieScreen extends ConsumerWidget {
  const MessagerieScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(messagerieProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      body: CustomScrollView(
        slivers: [
          // ── App Bar ──────────────────────────────────────
          SliverAppBar(
            floating: true,
            snap: true,
            backgroundColor: AppColors.background,
            elevation: 0,
            automaticallyImplyLeading: false,
            toolbarHeight: 64,
            title: Row(
              children: [
                const Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Messages', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: AppColors.textPrimary)),
                    Text('Transport · Coach · Box', style: TextStyle(fontSize: 12, color: AppColors.textSecondary, fontWeight: FontWeight.w400)),
                  ],
                ),
                const Spacer(),
                if (state.totalUnread > 0)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: AppColors.urgent,
                      borderRadius: BorderRadius.circular(AppTheme.radiusSM),
                    ),
                    child: Text(
                      '${state.totalUnread} non lu${state.totalUnread > 1 ? 's' : ''}',
                      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Colors.white),
                    ),
                  ),
              ],
            ),
          ),

          // ── Liste ─────────────────────────────────────────
          if (state.isLoading)
            const SliverPadding(
              padding: EdgeInsets.fromLTRB(16, 10, 16, 100),
              sliver: SliverToBoxAdapter(child: EQLoadingList(count: 3)),
            )
          else if (state.conversations.isEmpty)
            const SliverToBoxAdapter(
              child: EQEmptyState(
                icon: Icons.chat_bubble_outline_rounded,
                title: 'Aucun message',
                subtitle: 'Réservez un transport ou contactez un coach pour démarrer une conversation.',
              ),
            )
          else
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 10, 16, 100),
              sliver: SliverList(
                delegate: SliverChildBuilderDelegate(
                  (context, i) {
                    final conv = state.conversations[i];
                    return Padding(
                      padding: EdgeInsets.only(bottom: i < state.conversations.length - 1 ? 8 : 0),
                      child: _ConversationTile(conv: conv),
                    );
                  },
                  childCount: state.conversations.length,
                ),
              ),
            ),
        ],
      ),
    );
  }
}

// ── Conversation tile ──────────────────────────────────────────────────────────

class _ConversationTile extends ConsumerWidget {
  const _ConversationTile({required this.conv});
  final Conversation conv;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final last = conv.lastMessage;
    final timeStr = _formatTime(conv.updatedAt);

    return Semantics(
      label: '${conv.titre}, ${last?.content ?? ''}. ${conv.hasUnread ? '${conv.unreadCount} message non lu' : ''}',
      button: true,
      child: Container(
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(AppTheme.radiusLG),
          border: Border.all(color: conv.hasUnread ? AppColors.primaryBorder : AppColors.border),
        ),
        child: Material(
          color: Colors.transparent,
          borderRadius: BorderRadius.circular(AppTheme.radiusLG),
          child: InkWell(
            borderRadius: BorderRadius.circular(AppTheme.radiusLG),
            excludeFromSemantics: true,
            onTap: () {
              ref.read(messagerieProvider.notifier).markAsRead(conv.id);
              context.go('/messages/${conv.id}');
            },
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Row(
                children: [
                  // ── Avatar type ────────────────────────
                  Container(
                    width: 46,
                    height: 46,
                    decoration: BoxDecoration(
                      color: conv.hasUnread ? AppColors.primaryLight : AppColors.background,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Center(
                      child: Text(conv.type.emoji, style: const TextStyle(fontSize: 20)),
                    ),
                  ),
                  const SizedBox(width: 12),

                  // ── Contenu ────────────────────────────
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                conv.titre,
                                style: TextStyle(
                                  fontSize: 14,
                                  fontWeight: conv.hasUnread ? FontWeight.w800 : FontWeight.w600,
                                  color: AppColors.textPrimary,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            Text(timeStr, style: const TextStyle(fontSize: 11, color: AppColors.textTertiary)),
                          ],
                        ),
                        const SizedBox(height: 2),
                        Text(
                          conv.sousTitre,
                          style: const TextStyle(fontSize: 11.5, color: AppColors.textTertiary, fontWeight: FontWeight.w500),
                        ),
                        const SizedBox(height: 4),
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                last?.content ?? '',
                                style: TextStyle(
                                  fontSize: 13,
                                  color: conv.hasUnread ? AppColors.textPrimary : AppColors.textSecondary,
                                  fontWeight: conv.hasUnread ? FontWeight.w600 : FontWeight.w400,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            if (conv.hasUnread)
                              Container(
                                width: 20, height: 20,
                                decoration: const BoxDecoration(color: AppColors.primary, shape: BoxShape.circle),
                                child: Center(
                                  child: Text(
                                    '${conv.unreadCount}',
                                    style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Colors.white),
                                  ),
                                ),
                              ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  String _formatTime(DateTime dt) {
    final now = DateTime.now();
    final diff = now.difference(dt);
    if (diff.inMinutes < 60) return '${diff.inMinutes}min';
    if (diff.inHours < 24) return '${diff.inHours}h';
    return '${dt.day}/${dt.month}';
  }
}
