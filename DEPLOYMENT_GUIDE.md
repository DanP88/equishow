# 🚀 GUIDE DE DÉPLOIEMENT STRIPE

**Status:** ✅ Prêt à déployer  
**Date:** April 17, 2026

---

## PHASE 1: Déployer la Base de Données (5 minutes)

### Étape 1.1: Ouvrir Supabase Dashboard
```
https://app.supabase.com/projects/[your-project-id]/sql/new
```

### Étape 1.2: Copier et exécuter la migration 009

1. Ouvrir le fichier: `/Users/dan/equishow/migrations/009_add_reservations_and_stripe.sql`
2. Copier TOUT le contenu
3. Coller dans Supabase SQL Editor
4. Cliquer **"Run"** (bouton bleu)

**Attendre la fin de l'exécution** (devrait voir ✅ Success)

### Vérification
Aller dans **Database** → **Tables** et vérifier:
- ✓ `course_demands` existe
- ✓ `stage_reservations` existe
- ✓ `payments` existe
- ✓ `stripe_webhook_events` existe
- ✓ Colonne `stripe_account_id` dans `users`

---

## PHASE 2: Déployer les Edge Functions (10 minutes)

### Préalable: Installer Supabase CLI

```bash
npm install -g supabase
```

### Étape 2.1: Se connecter à Supabase

```bash
supabase login
# Suivre les instructions (vous devrez autoriser l'accès)
```

### Étape 2.2: Lier au projet

```bash
cd /Users/dan/equishow
supabase link --project-id [your-project-id]
# Remplacer [your-project-id] par votre ID Supabase
```

### Étape 2.3: Déployer chaque fonction

Exécuter ces commandes **dans l'ordre**:

```bash
# 1. Price calculation (no JWT verification needed - called from other functions)
supabase functions deploy calculate-course-price --no-verify-jwt

# 2. Seller onboarding link creation
supabase functions deploy create-stripe-onboarding-link

# 3. Seller onboarding completion
supabase functions deploy complete-seller-onboarding

# 4. Check seller status
supabase functions deploy check-seller-status

# 5. Create checkout session
supabase functions deploy create-checkout-session

# 6. Verify checkout session
supabase functions deploy verify-checkout-session

# 7. Process refunds
supabase functions deploy process-refund

# 8. Webhook handler (CRITICAL - must be last)
supabase functions deploy webhook-stripe
```

### Vérification
Aller dans **Supabase Dashboard** → **Functions** et voir:
- ✓ `calculate-course-price` - Deployed
- ✓ `create-stripe-onboarding-link` - Deployed
- ✓ `complete-seller-onboarding` - Deployed
- ✓ `check-seller-status` - Deployed
- ✓ `create-checkout-session` - Deployed
- ✓ `verify-checkout-session` - Deployed
- ✓ `process-refund` - Deployed
- ✓ `webhook-stripe` - Deployed

---

## PHASE 3: Setup Stripe Account (10 minutes)

### Étape 3.1: Créer un compte Stripe

Aller à: https://stripe.com

Créer un compte et completer l'onboarding.

### Étape 3.2: Passer en mode Test

Stripe Dashboard → Mode test (toggle en haut à droite)

### Étape 3.3: Récupérer les API Keys

Aller à: https://dashboard.stripe.com/apikeys

Copier:
- **Publishable key** (commence par `pk_test_`)
- **Secret key** (commence par `sk_test_`)

### Étape 3.4: Créer un webhook endpoint

Aller à: https://dashboard.stripe.com/webhooks

Cliquer **"Add an endpoint"**

- **URL:** `https://[your-project-id].supabase.co/functions/v1/webhook-stripe`
  (Remplacer [your-project-id])
- **Events:** Sélectionner:
  - `charge.succeeded`
  - `charge.failed`
  - `charge.refunded`

Cliquer **"Add endpoint"**

Copier le **Signing secret** (commence par `whsec_test_`)

---

## PHASE 4: Configurer les Variables d'Environnement (5 minutes)

### Étape 4.1: Variables Expo (.env.local)

Créer/modifier le fichier: `/Users/dan/equishow/.env.local`

Ajouter:
```env
# Supabase (existing)
EXPO_PUBLIC_SUPABASE_URL=https://[your-project-id].supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ0eXAi...

# Stripe (NEW - add these)
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_51234...
```

### Étape 4.2: Secrets Supabase

Aller à: https://app.supabase.com/project/[your-project-id]/settings/functions

**Ajouter 2 secrets:**

1. **Nom:** `STRIPE_SECRET_KEY`
   **Valeur:** `sk_test_51234...` (votre secret key)

2. **Nom:** `STRIPE_WEBHOOK_SECRET`
   **Valeur:** `whsec_test_1234...` (votre webhook secret)

Cliquer **"Add secret"** pour chaque

---

## PHASE 5: Intégrer dans les Écrans Frontend (15 minutes)

### Étape 5.1: reserver-coach.tsx

Ajouter au haut du fichier:
```typescript
import { PaymentBreakdown } from '../components/PaymentBreakdown';
import { getAuthToken } from '../utils/supabaseAuth';
import * as WebBrowser from 'expo-web-browser';
```

Remplacer la fonction de réservation par:
```typescript
const handleReserveAndPay = async () => {
  try {
    const authToken = await getAuthToken();
    if (!authToken) {
      Alert.alert('Erreur', 'Non authentifié');
      return;
    }

    // 1. Créer la demande
    const demandResponse = await supabase
      .from('course_demands')
      .insert({
        annonce_id: annonceId,
        coach_id: coachId,
        cavalier_id: userStore.id,
        title: coaching.titre,
        discipline: coaching.discipline,
        level: coaching.niveau,
        horse_name: selectedHorse?.nom,
        message: demandMessage,
        date_debut: selectedDates[0],
        date_fin: selectedDates[selectedDates.length - 1],
        nb_jours: selectedDates.length,
        status: 'pending',
      })
      .select('id')
      .single();

    // 2. Calculer les prix
    const priceResponse = await fetch(
      `${SUPABASE_URL}/functions/v1/calculate-course-price`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          annonce_id: annonceId,
          nb_jours: selectedDates.length,
        }),
      }
    );
    const breakdown = await priceResponse.json();

    // 3. Afficher le breakdown
    setPaymentBreakdown(breakdown);

    // 4. Créer la session checkout
    const checkoutResponse = await fetch(
      `${SUPABASE_URL}/functions/v1/create-checkout-session`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          demandId: demandResponse.data.id,
          type: 'course',
        }),
      }
    );
    const { checkoutUrl } = await checkoutResponse.json();

    // 5. Ouvrir Stripe Checkout
    await WebBrowser.openBrowserAsync(checkoutUrl);

  } catch (error) {
    Alert.alert('Erreur', 'Impossible de créer la réservation');
  }
};
```

Ajouter un bouton:
```typescript
<PaymentBreakdown
  amountTtc={paymentBreakdown?.total_amount_ttc || 0}
  amountHt={paymentBreakdown?.total_amount_ht || 0}
  commission={paymentBreakdown?.platform_commission || 0}
  vat={paymentBreakdown?.vat_amount || 0}
/>

<TouchableOpacity
  style={s.payButton}
  onPress={handleReserveAndPay}
  disabled={loading}
>
  <Text style={s.payButtonText}>
    {loading ? '⏳ Paiement...' : '✓ Confirmer & Payer'}
  </Text>
</TouchableOpacity>
```

### Étape 5.2: proposer-coach-annonce.tsx

Ajouter au haut:
```typescript
import { SellerStatus } from '../components/SellerStatus';
import { StripeConnectButton } from '../components/StripeConnectButton';
```

Avant le bouton "Publier":
```typescript
<SellerStatus sellerId={userStore.id} />

{!sellerReady && (
  <StripeConnectButton
    sellerId={userStore.id}
    onSuccess={() => checkSellerStatus()}
  />
)}
```

### Étape 5.3: reserver-stage.tsx, reserver-transport.tsx, reserver-box.tsx

Faire les mêmes changements que reserver-coach.tsx (adapter les champs selon le type)

---

## PHASE 6: Tester le Déploiement (20 minutes)

### Test 1: Seller Onboarding

1. Ouvrir l'app avec un compte coach
2. Aller dans "proposer une annonce"
3. Voir le composant `SellerStatus` - doit dire "⚠️ Compte non configuré"
4. Cliquer "🔗 Lier mon compte Stripe"
5. S'ouvrir: Stripe Express onboarding
6. Remplir les infos (test mode - données fictives OK)
7. Revenir à l'app
8. Voir "✅ Compte Stripe prêt" (ou "⏳ Vérification...")

**Si OK:** ✓ Seller onboarding fonctionne

### Test 2: Buyer Checkout

1. Ouvrir l'app avec un compte cavalier
2. Chercher un cours d'un coach avec Stripe validé
3. Cliquer "Réserver ce cours"
4. Sélectionner les dates
5. Voir `PaymentBreakdown` avec montants
6. Cliquer "✓ Confirmer & Payer"
7. S'ouvrir: Stripe Checkout page
8. Tester avec carte: `4242 4242 4242 4242`
   - Exp: Mois/année futur (ex: 12/26)
   - CVC: N'importe quel 3 chiffres (ex: 123)
9. Cliquer "Payer"
10. Redirection vers `checkout-success`
11. Voir "✅ Paiement confirmé"

**Si OK:** ✓ Buyer checkout fonctionne

### Test 3: Webhook Processing

1. Aller au Stripe Dashboard
2. Chercher le charge créé
3. Vérifier status: "Succeeded"
4. Vérifier la métadonnée: `payment_id` présent
5. Aller à Supabase → Functions → `webhook-stripe` → Logs
6. Voir les logs du webhook (devrait avoir traité l'événement)
7. Aller à Supabase → SQL → Exécuter:
   ```sql
   SELECT * FROM payments WHERE status = 'succeeded' ORDER BY created_at DESC LIMIT 1;
   ```
8. Voir le paiement avec `stripe_charge_id` rempli

**Si OK:** ✓ Webhook fonctionne

### Test 4: Seller Reçoit l'Argent

1. Aller au Stripe Dashboard
2. Chercher le transfer créé (devrait avoir été créé automatiquement au webhook)
3. Vérifier: Montant = `amount_seller_ht` du payment
4. Vérifier: Destination = Stripe account du coach

**Si OK:** ✓ Transfers fonctionnent

---

## PHASE 7: Switcher en Mode Production (5 minutes)

⚠️ **À NE FAIRE QUE QUAND TOUT FONCTIONNE EN TEST**

### Étape 7.1: Stripe Live Keys

1. Aller à: https://dashboard.stripe.com/apikeys
2. Passer le toggle "Test mode" → OFF (pour passer en LIVE)
3. Copier la **Publishable key** (commence par `pk_live_`)
4. Copier la **Secret key** (commence par `sk_live_`)

### Étape 7.2: Webhook Endpoint Live

Créer un **NOUVEAU** webhook endpoint pour la production:
- **URL:** Same as before but on production domain
- **Events:** Same as before

Copier le **Signing secret** (commence par `whsec_live_`)

### Étape 7.3: Mettre à jour les variables

**.env.local** (public, safe):
```env
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

**Supabase Secrets:**
- `STRIPE_SECRET_KEY=sk_live_...`
- `STRIPE_WEBHOOK_SECRET=whsec_live_...`

### Étape 7.4: Redéployer les Edge Functions

```bash
# Redéployer les fonctions avec les nouvelles clés
supabase functions deploy webhook-stripe
supabase functions deploy create-stripe-onboarding-link
# (etc. pour chaque fonction)
```

### Étape 7.5: Rebuild et publier l'app

```bash
# Pour iOS
eas build --platform ios --auto-submit

# Pour Android
eas build --platform android --auto-submit
```

---

## Dépannage

### ❌ "Seller is not ready to accept payments"
**Cause:** Coach n'a pas complété Stripe onboarding  
**Solution:** Faire le test 1 ci-dessus

### ❌ "Payment not found"
**Cause:** Le webhook n'a pas trouvé le payment  
**Solution:** Vérifier que `payment_id` est dans les metadata Stripe

### ❌ "Failed to create Stripe session"
**Cause:** API key invalide ou réseau  
**Solution:** Vérifier les secrets dans Supabase

### ❌ Webhook ne reçoit pas les événements
**Cause:** URL ou signing secret incorrect  
**Solution:** Vérifier webhook endpoint dans Stripe Dashboard

---

## Checklist Final

- [ ] Migration 009 déployée ✓
- [ ] 8 Edge Functions déployées ✓
- [ ] Stripe account créé ✓
- [ ] API keys et webhook secret configurés ✓
- [ ] Variables d'environnement ajoutées ✓
- [ ] Écrans intégrés (Phase 5) ✓
- [ ] Test 1 passé (Seller onboarding) ✓
- [ ] Test 2 passé (Buyer checkout) ✓
- [ ] Test 3 passé (Webhook) ✓
- [ ] Test 4 passé (Seller reçoit argent) ✓
- [ ] Passer en production ✓

---

## Support

Si ça bloque, vérifie dans cet ordre:
1. **Logs Supabase:** Functions → Logs de la fonction qui fail
2. **Logs Expo:** `npx expo start` et regarder le terminal
3. **Stripe Dashboard:** Vérifier les charges et webhooks
4. **Audit final:** Relire AUDIT_FINAL.md

**Tu peux le faire! 🚀**
