import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../domain/conversation.dart';

class MessagerieState {
  const MessagerieState({
    this.conversations = const [],
    this.isLoading = false,
  });

  final List<Conversation> conversations;
  final bool isLoading;

  int get totalUnread => conversations.fold(0, (sum, c) => sum + c.unreadCount);

  MessagerieState copyWith({List<Conversation>? conversations, bool? isLoading}) =>
      MessagerieState(
        conversations: conversations ?? this.conversations,
        isLoading: isLoading ?? this.isLoading,
      );
}

class MessagerieNotifier extends StateNotifier<MessagerieState> {
  MessagerieNotifier() : super(const MessagerieState()) {
    _load();
  }

  Future<void> _load() async {
    state = state.copyWith(isLoading: true);
    await Future.delayed(const Duration(milliseconds: 500));
    // TODO: charger depuis Supabase Realtime
    state = state.copyWith(conversations: mockConversations, isLoading: false);
  }

  Future<void> sendMessage(String conversationId, String content) async {
    // TODO: insérer dans Supabase + déclencher push FCM
    final newMsg = Message(
      id: 'msg_${DateTime.now().millisecondsSinceEpoch}',
      senderId: 'moi',
      senderNom: 'Moi',
      content: content,
      sentAt: DateTime.now(),
      isRead: true,
    );

    final updated = state.conversations.map((c) {
      if (c.id != conversationId) return c;
      return Conversation(
        id: c.id,
        type: c.type,
        titre: c.titre,
        sousTitre: c.sousTitre,
        participants: c.participants,
        messages: [...c.messages, newMsg],
        updatedAt: DateTime.now(),
      );
    }).toList();

    // Trier par date de dernière mise à jour
    updated.sort((a, b) => b.updatedAt.compareTo(a.updatedAt));
    state = state.copyWith(conversations: updated);
  }

  void markAsRead(String conversationId) {
    final updated = state.conversations.map((c) {
      if (c.id != conversationId) return c;
      final readMessages = c.messages.map((m) => Message(
        id: m.id,
        senderId: m.senderId,
        senderNom: m.senderNom,
        content: m.content,
        sentAt: m.sentAt,
        isRead: true,
      )).toList();
      return Conversation(
        id: c.id,
        type: c.type,
        titre: c.titre,
        sousTitre: c.sousTitre,
        participants: c.participants,
        messages: readMessages,
        updatedAt: c.updatedAt,
      );
    }).toList();
    state = state.copyWith(conversations: updated);
  }

  /// Créer une nouvelle conversation (ex: depuis réservation transport/box)
  void createConversation({
    required String titre,
    required String sousTitre,
    required ConversationType type,
    required String premierMessage,
  }) {
    final newConv = Conversation(
      id: 'conv_${DateTime.now().millisecondsSinceEpoch}',
      type: type,
      titre: titre,
      sousTitre: sousTitre,
      participants: ['moi', 'autre'],
      updatedAt: DateTime.now(),
      messages: [
        Message(
          id: 'msg_init',
          senderId: 'moi',
          senderNom: 'Moi',
          content: premierMessage,
          sentAt: DateTime.now(),
          isRead: true,
        ),
      ],
    );
    state = state.copyWith(conversations: [newConv, ...state.conversations]);
  }
}

final messagerieProvider = StateNotifierProvider<MessagerieNotifier, MessagerieState>(
  (ref) => MessagerieNotifier(),
);

final unreadCountProvider = Provider<int>((ref) {
  return ref.watch(messagerieProvider).totalUnread;
});

final conversationByIdProvider = Provider.family<Conversation?, String>((ref, id) {
  return ref.watch(messagerieProvider).conversations.firstWhere((c) => c.id == id, orElse: () => throw Exception('Conversation introuvable'));
});
