/// Stripe Service — Architecture prête pour l'intégration réelle
///
/// Intégration requise :
/// 1. Ajouter `flutter_stripe` dans pubspec.yaml
/// 2. Configurer les clés dans .env :
///    STRIPE_PUBLISHABLE_KEY=pk_live_xxx
///    STRIPE_SECRET_KEY=sk_live_xxx  (uniquement backend !)
/// 3. Déployer les Edge Functions Vercel (voir /backend/functions/)
/// 4. Renseigner les IDs produits/prix dans plan_abonnement.dart
///
/// Flow paiement :
///   App → createPaymentIntent (Vercel Edge) → PaymentIntent
///   App → Stripe.instance.initPaymentSheet → presentPaymentSheet
///   Stripe → webhook → Supabase (mise à jour statut)

class StripeService {
  // TODO: déplacer dans .env
  // STRIPE_PUBLISHABLE_KEY = pk_live_xxx
  // BACKEND_URL = https://api.equishow.app

  /// Initialise Stripe (appeler dans main.dart)
  static Future<void> initialize() async {
    // TODO: décommenter après ajout flutter_stripe
    // Stripe.publishableKey = _publishableKey;
    // await Stripe.instance.applySettings();
  }

  /// Crée un PaymentIntent et ouvre la Payment Sheet Stripe
  /// Retourne true si paiement réussi, false sinon
  static Future<bool> payer({
    required double montantEuros,
    required String description,
    String? stripeCustomerId,
    String? stripePriceId,
    Map<String, String>? metadata,
  }) async {
    // TODO: implémentation réelle
    // 1. Appel backend pour créer PaymentIntent
    // final response = await _createPaymentIntent(
    //   montant: (montantEuros * 100).toInt(),
    //   currency: 'eur',
    //   description: description,
    //   customerId: stripeCustomerId,
    //   metadata: metadata,
    // );
    // final clientSecret = response['client_secret'];

    // 2. Initialiser la Payment Sheet
    // await Stripe.instance.initPaymentSheet(
    //   paymentSheetParameters: SetupPaymentSheetParameters(
    //     paymentIntentClientSecret: clientSecret,
    //     merchantDisplayName: 'Equishow',
    //     customerId: stripeCustomerId,
    //     style: ThemeMode.light,
    //   ),
    // );

    // 3. Présenter la Payment Sheet
    // await Stripe.instance.presentPaymentSheet();

    // Mock : simule succès après délai
    await Future.delayed(const Duration(milliseconds: 1500));
    return true; // TODO: retourner le résultat réel
  }

  /// Crée un abonnement récurrent (cavalier/coach)
  static Future<bool> subscriberAbonnement({
    required String stripePriceId,
    required String stripeCustomerId,
  }) async {
    // TODO: appel backend pour créer Subscription Stripe
    // POST /api/subscriptions { price_id, customer_id }
    await Future.delayed(const Duration(milliseconds: 1500));
    return true;
  }

  /// Paiement Stripe Connect — split entre plateforme (9%) et créateur (91%)
  static Future<bool> payerTransportOuBox({
    required double montantEuros,
    required String createurStripeAccountId,
    required String description,
  }) async {
    // TODO: appel backend avec transfer_data[destination] = createurStripeAccountId
    // La commission (9%) reste automatiquement sur le compte Equishow
    // POST /api/payments/connect {
    //   amount, currency, connected_account: createurStripeAccountId,
    //   application_fee_amount: (montantEuros * 0.09 * 100).toInt()
    // }
    await Future.delayed(const Duration(milliseconds: 1500));
    return true;
  }

  /// Onboarding Stripe Connect pour un organisateur/cavalier qui propose du transport
  static Future<String?> creerCompteConnect() async {
    // TODO: POST /api/connect/accounts → retourne account_id
    // Puis rediriger vers stripe.com/connect/onboarding
    return 'acct_mock_xxx';
  }
}
