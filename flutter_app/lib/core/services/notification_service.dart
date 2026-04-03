import '../../features/auth/domain/user_auth.dart';

/// Service de notifications push intelligentes par discipline + région
///
/// Architecture cible :
///   - Firebase Cloud Messaging (FCM) — delivery des push
///   - Supabase Edge Functions — déclenchement serveur-side (ex: nouvel event concours)
///   - Abonnement aux topics FCM par discipline : "discipline_cso", "discipline_dressage", "discipline_cce"
///   - Abonnement au topic région : "region_normandie", "region_idf", etc.
///
/// En production :
///   1. À l'inscription / mise à jour du profil → subscribeToTopics()
///   2. Quand un organisateur crée un concours → Supabase Edge Function appelle FCM
///      pour notifier le topic discipline + région correspondant
///   3. L'app reçoit la notification → navigation vers ConcourDetailScreen

class NotificationService {
  NotificationService._();
  static final NotificationService instance = NotificationService._();

  bool _initialized = false;

  /// Initialiser FCM et demander les permissions
  /// À appeler au démarrage de l'app (dans main.dart, après AuthState resolved)
  Future<void> initialize() async {
    if (_initialized) return;
    _initialized = true;

    // TODO: Initialiser Firebase
    // await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);

    // TODO: Demander permission notifications (iOS)
    // final messaging = FirebaseMessaging.instance;
    // await messaging.requestPermission(alert: true, badge: true, sound: true);

    // TODO: Récupérer le FCM token et l'envoyer à Supabase
    // final token = await messaging.getToken();
    // if (token != null) await _saveTokenToSupabase(token);

    // TODO: Écouter les messages en foreground
    // FirebaseMessaging.onMessage.listen(_onForegroundMessage);

    // TODO: Écouter les tap sur notification (app en background)
    // FirebaseMessaging.onMessageOpenedApp.listen(_onNotificationTapped);
  }

  /// S'abonner aux topics FCM correspondant aux disciplines et région de l'utilisateur
  /// À appeler après inscription ou modification du profil
  Future<void> subscribeToTopics(UserAuth user) async {
    // TODO: FirebaseMessaging messaging = FirebaseMessaging.instance;

    // S'abonner aux disciplines
    for (final discipline in user.disciplines) {
      final topic = _disciplineTopic(discipline);
      // await messaging.subscribeToTopic(topic);
      _log('Subscribed to topic: $topic');
    }

    // S'abonner à la région
    if (user.region != null) {
      final regionTopic = _regionTopic(user.region!);
      // await messaging.subscribeToTopic(regionTopic);
      _log('Subscribed to topic: $regionTopic');
    }

    // S'abonner au topic du rôle (ex: annonces pour organisateurs)
    final roleTopic = _roleTopic(user.role);
    // await messaging.subscribeToTopic(roleTopic);
    _log('Subscribed to topic: $roleTopic');
  }

  /// Se désabonner de tous les topics (ex: changement de disciplines)
  Future<void> unsubscribeAll(UserAuth user) async {
    for (final d in user.disciplines) {
      // await FirebaseMessaging.instance.unsubscribeFromTopic(_disciplineTopic(d));
      _log('Unsubscribed from: ${_disciplineTopic(d)}');
    }
    if (user.region != null) {
      // await FirebaseMessaging.instance.unsubscribeFromTopic(_regionTopic(user.region!));
    }
  }

  /// Mettre à jour les topics quand le profil change
  Future<void> refreshTopics({
    required UserAuth oldUser,
    required UserAuth newUser,
  }) async {
    await unsubscribeAll(oldUser);
    await subscribeToTopics(newUser);
  }

  // ── Topic naming conventions ───────────────────────────────────────────────

  String _disciplineTopic(Discipline d) => switch (d) {
    Discipline.cso      => 'discipline_cso',
    Discipline.dressage => 'discipline_dressage',
    Discipline.cce      => 'discipline_cce',
  };

  String _regionTopic(String region) {
    // Normaliser : "Normandie" → "region_normandie"
    return 'region_${region.toLowerCase().replaceAll(' ', '_').replaceAll(RegExp(r'[àâä]'), 'a').replaceAll(RegExp(r'[éèêë]'), 'e').replaceAll(RegExp(r'[îï]'), 'i').replaceAll(RegExp(r'[ôö]'), 'o').replaceAll(RegExp(r'[ùûü]'), 'u')}';
  }

  String _roleTopic(UserRole r) => switch (r) {
    UserRole.cavalier     => 'role_cavalier',
    UserRole.organisateur => 'role_organisateur',
    UserRole.coach        => 'role_coach',
  };

  void _log(String msg) {
    // ignore: avoid_print
    assert(() { print('[NotificationService] $msg'); return true; }());
  }
}

// ── Payload types pour la navigation ─────────────────────────────────────────
//
// Quand une notification FCM est tapée, le payload contient :
//   { "type": "concours_nouveau", "id": "conc_42", "discipline": "cso" }
//   { "type": "message_nouveau",  "conversationId": "conv_7" }
//   { "type": "transport_dispo",  "trajetId": "traj_15" }
//
// La fonction _onNotificationTapped lit le type et navigue avec GoRouter :
//   GoRouter.of(context).go('/concours/$id')       → détail concours
//   GoRouter.of(context).go('/messages/$convId')    → conversation
