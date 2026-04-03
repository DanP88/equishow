/// Type de conversation
enum ConversationType {
  transport('Transport', '🚗'),
  coach('Coach', '🎖️'),
  box('Box cheval', '🐴'),
  general('Général', '💬');

  const ConversationType(this.label, this.emoji);
  final String label;
  final String emoji;
}

/// Message dans une conversation
class Message {
  const Message({
    required this.id,
    required this.senderId,
    required this.senderNom,
    required this.content,
    required this.sentAt,
    this.isRead = false,
    this.attachmentUrl,
  });

  final String id;
  final String senderId;
  final String senderNom;
  final String content;
  final DateTime sentAt;
  final bool isRead;
  final String? attachmentUrl;
}

/// Conversation entre cavaliers
class Conversation {
  const Conversation({
    required this.id,
    required this.type,
    required this.titre,
    required this.sousTitre,
    required this.participants,
    required this.messages,
    required this.updatedAt,
  });

  final String id;
  final ConversationType type;
  final String titre;
  final String sousTitre;
  final List<String> participants;
  final List<Message> messages;
  final DateTime updatedAt;

  Message? get lastMessage => messages.isEmpty ? null : messages.last;
  int get unreadCount => messages.where((m) => !m.isRead && m.senderId != 'moi').length;
  bool get hasUnread => unreadCount > 0;
}

/// Données mock
final mockConversations = [
  Conversation(
    id: 'conv_1',
    type: ConversationType.transport,
    titre: 'Transport CSO Saint-Lô',
    sousTitre: 'Marie-Laure D.',
    participants: ['moi', 'usr_2'],
    updatedAt: DateTime.now().subtract(const Duration(minutes: 12)),
    messages: [
      Message(id: 'm1', senderId: 'usr_2', senderNom: 'Marie-Laure', content: 'Bonjour ! Ma remorque part de Versailles samedi à 7h. Il reste 1 place pour votre cheval.', sentAt: DateTime.now().subtract(const Duration(hours: 2))),
      Message(id: 'm2', senderId: 'moi', senderNom: 'Sarah', content: 'Bonjour, super ! Quelle est la taille max du cheval accepté ?', sentAt: DateTime.now().subtract(const Duration(hours: 1, minutes: 30))),
      Message(id: 'm3', senderId: 'usr_2', senderNom: 'Marie-Laure', content: 'Remorque 3 places, convient jusqu\'à 1m75. Pas de soucis pour un selle français standard !', sentAt: DateTime.now().subtract(const Duration(minutes: 12)), isRead: false),
    ],
  ),
  Conversation(
    id: 'conv_2',
    type: ConversationType.coach,
    titre: 'Coaching avec Pierre M.',
    sousTitre: 'Session avant Jardy',
    participants: ['moi', 'coach_1'],
    updatedAt: DateTime.now().subtract(const Duration(hours: 3)),
    messages: [
      Message(id: 'm4', senderId: 'coach_1', senderNom: 'Pierre', content: 'Bonjour Sarah ! Confirmé pour vendredi 9h à Jardy. Prévoyer 45 min.', sentAt: DateTime.now().subtract(const Duration(hours: 3)), isRead: true),
      Message(id: 'm5', senderId: 'moi', senderNom: 'Sarah', content: 'Parfait, merci ! On travaille quoi en priorité ?', sentAt: DateTime.now().subtract(const Duration(hours: 2, minutes: 45))),
      Message(id: 'm6', senderId: 'coach_1', senderNom: 'Pierre', content: 'Galops de rassemblement et l\'oxer final de votre dernier parcours. On a du boulot 😄', sentAt: DateTime.now().subtract(const Duration(hours: 3)), isRead: false),
    ],
  ),
  Conversation(
    id: 'conv_3',
    type: ConversationType.box,
    titre: 'Box · Haras du Pin',
    sousTitre: 'Organisateur — Bureau accueil',
    participants: ['moi', 'orga_1'],
    updatedAt: DateTime.now().subtract(const Duration(days: 1)),
    messages: [
      Message(id: 'm7', senderId: 'orga_1', senderNom: 'Accueil Haras du Pin', content: 'Votre réservation box n°14 est confirmée pour le 15-16 mars. Litière fournie, eau disponible.', sentAt: DateTime.now().subtract(const Duration(days: 1)), isRead: true),
      Message(id: 'm8', senderId: 'moi', senderNom: 'Sarah', content: 'Merci ! Y a-t-il un accès paddock le matin avant les épreuves ?', sentAt: DateTime.now().subtract(const Duration(days: 1))),
    ],
  ),
];
