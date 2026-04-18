# 🔍 AUDIT COMPLET - Stripe Integration Implementation

**Date:** April 17, 2026  
**Status:** ⚠️ **ISSUES CRITIQUES TROUVÉES** - Correction nécessaire avant deployment

---

## 📊 Résumé de l'Audit

| Catégorie | Status | Détail |
|-----------|--------|--------|
| **Architecture** | ✅ OK | Design solide, sécurisé |
| **Database Schema** | ✅ OK | Migration 009 correcte |
| **Edge Functions** | ⚠️ ISSUES | 3 fonctions manquantes + bugs dans 2 fonctions |
| **Frontend Components** | ⚠️ ISSUES | getAuthToken() stub + fonctions Edge manquantes |
| **Frontend Screens** | ⚠️ ISSUES | Appels à des fonctions inexistantes |
| **Sécurité** | ✅ OK | Authentification, CORS, signatures OK |
| **Calculs Financiers** | ⚠️ ISSUES | Erreur dans amount_seller_ht |
| **Documentation** | ✅ OK | Complète et détaillée |
| **Reversibilité** | ✅ OK | Migration DOWN fournie |

---

## 🔴 ISSUES CRITIQUES (Must Fix)

### 1. ⚠️ FONCTION MANQUANTE: `create-stripe-onboarding-link`

**Lieu:** Appelée par `StripeConnectButton.tsx` ligne 33  
**Statut:** ❌ N'existe pas  
**Sévérité:** 🔴 CRITIQUE - Les vendeurs ne peuvent pas se connecter à Stripe

**Appel:**
```typescript
// StripeConnectButton.tsx:33
const response = await fetch(
  `${SUPABASE_URL}/functions/v1/create-stripe-onboarding-link`,
  ...
);
```

**Que faire:** Créer la fonction Edge avec:
- Entrée: seller_id
- Récupérer Stripe account ID du vendeur
- Si pas d'account: Créer un nouveau Stripe Connect account (Express)
- Créer un account link (onboarding flow)
- Retourner: { onboarding_url }

---

### 2. ⚠️ FONCTION MANQUANTE: `verify-checkout-session`

**Lieu:** Appelée par `checkout-success.tsx` ligne 52  
**Statut:** ❌ N'existe pas  
**Sévérité:** 🔴 CRITIQUE - Les acheteurs ne peuvent pas confirmer les paiements

**Appel:**
```typescript
// checkout-success.tsx:52
const response = await fetch(
  `${SUPABASE_URL}/functions/v1/verify-checkout-session`,
  {
    body: JSON.stringify({ sessionId: session }),
  }
);
```

**Que faire:** Créer la fonction Edge avec:
- Entrée: sessionId (Stripe Checkout Session ID)
- Chercher le paiement par stripe_checkout_session_id
- Retourner le statut du paiement (pending, succeeded, failed)

---

### 3. ⚠️ BUG: `create-checkout-session` - Calcul de amount_seller_ht

**Lieu:** `create-checkout-session/index.ts` ligne 261  
**Statut:** ❌ Calcul incorrect  
**Sévérité:** 🔴 CRITIQUE - Les montants transférés aux vendeurs seront faux

**Code actuel:**
```typescript
amount_seller_ht: demandData.total_amount_ttc - demandData.platform_commission - (demandData.total_amount_ttc * 0.20 / 1.20),
```

**Problème:**
- Formule mathématique incorrecte
- `demandData` contient déjà `total_amount_ht`
- Le montant du vendeur = `total_amount_ht` (sans commission ni TVA)

**Correction:**
```typescript
amount_seller_ht: demandData.total_amount_ht - demandData.platform_commission,
```

OU si on veut que le vendeur reçoive seulement la partie HT sans commission:
```typescript
amount_seller_ht: demandData.total_amount_ht - demandData.platform_commission,
```

Exemple correct:
```
Prix HT: 100€
Commission (5%): 5€
TVA (20%): 20€
Total TTC: 125€

Vendeur reçoit HT (après commission): 100€ - 5€ = 95€
Equishow garde: 5€ (commission) + 20€ (TVA) = 25€
```

---

### 4. ⚠️ BUG: `webhook-stripe` - Cherche par session ID inexistant

**Lieu:** `webhook-stripe/index.ts` ligne 97  
**Statut:** ❌ Ne trouvera jamais le paiement  
**Sévérité:** 🔴 CRITIQUE - Les paiements ne seront jamais confirmés

**Code actuel:**
```typescript
.eq("stripe_checkout_session_id", charge.metadata.stripe_session_id)
```

**Problème:**
- `charge.metadata.stripe_session_id` n'existe pas
- Quand Stripe crée un charge à partir d'une session de checkout, le charge a:
  - `charge.payment_intent` (lié à la session)
  - `charge.metadata` (avec les données qu'on a passé à la session)
- Pas d'ID de session dans les metadata

**Correction Option A:** Stocker le session ID comme metadata
```typescript
// Dans create-checkout-session:
metadata: {
  demand_id: body.demandId || body.reservationId,
  type: body.type,
  buyer_id: user.id,
  seller_id: sellerId,
  stripe_session_id: checkoutSession.id,  // ← AJOUTER
},

// Dans webhook:
.eq("stripe_checkout_session_id", charge.metadata.stripe_session_id)
```

**Correction Option B:** Chercher par charge ID directement
```typescript
// Dans webhook (mais charge.id devrait être déjà là):
// Chercher si on a déjà un paiement avec ce charge ID
// Sinon, chercher via payment_intent
```

---

### 5. ⚠️ BUG: Tous les `getAuthToken()` retournent null

**Lieux:**
- `StripeConnectButton.tsx` ligne 118-122
- `SellerStatus.tsx` ligne 186-189
- `checkout-success.tsx` ligne 200-203
- `stripe-onboarding.tsx` ligne 220-223

**Statut:** ❌ Stubs jamais implémentées  
**Sévérité:** 🟠 HAUTE - Les appels d'API nécessitant auth échoueront

**Code actuel:**
```typescript
async function getAuthToken(): Promise<string | null> {
  // For now, returning null - implement based on your auth setup
  return null;
}
```

**Problème:**
- Retourne TOUJOURS null
- Donc TOUS les appels aux Edge Functions échoueront
- Besoin d'implémenter correctement

**Correction:** Ajouter import et utiliser Supabase auth
```typescript
import { useAuth } from '../hooks/useAuth'; // ou votre système d'auth

export function StripeConnectButton(...) {
  const { getSession } = useAuth();
  
  const handlePress = async () => {
    const session = await getSession();
    if (!session?.access_token) {
      Alert.alert('Erreur', 'Non authentifié');
      return;
    }
    
    const authToken = session.access_token;
    // Utiliser authToken pour l'appel API...
  };
}
```

---

## 🟡 ISSUES IMPORTANTES (Should Fix)

### 6. Webhook: Mauvais handling de charge.metadata

**Lieu:** `webhook-stripe/index.ts` ligne 91-98  
**Statut:** ❌ Logique incohérente  
**Sévérité:** 🟡 MOYENNE - Cas edge

**Problème:** Pour `handleChargeSucceeded`, on cherche par `stripe_checkout_session_id` mais pour `handleChargeFailed` on cherche par `stripe_charge_id`. Cohérence?

**Correction:** 
- `handleChargeSucceeded` devrait aussi chercher par charge ID
- Ou mémoriser le session ID dans les metadata pour tous les cas

---

### 7. Webhook: Pas de gestion du client_reference_id

**Lieu:** `webhook-stripe/index.ts` ligne 91  
**Statut:** ⚠️ Pourrait être fragile  
**Sévérité:** 🟡 MOYENNE

**Problème:**
- Stripe Checkout crée des charges liées à une session
- Meilleure pratique: utiliser `client_reference_id` pour tracer
- Actuellement: on se fie uniquement à metadata qui pourrait être vide

**Recommandation:** Utiliser `client_reference_id` dans checkout session
```typescript
// create-checkout-session:
const checkoutSession = await callStripeAPI("/checkout/sessions", "POST", {
  ...
  client_reference_id: payment.id,  // ← Ajouter
  ...
});

// webhook:
// Peut chercher par client_reference_id
```

---

### 8. PaymentBreakdown: Affichage des montants

**Lieu:** `PaymentBreakdown.tsx`  
**Statut:** ⚠️ Correction de format  
**Sévérité:** 🟡 BASSE

**Détail:** Les montants vont être en cents (123 = 1.23€). Le composant divise par 100 et formate correctement. ✅ OK

---

## ✅ POINTS VÉRIFIÉS OK

### Architecture
- ✅ Design sécurisé avec vérifications d'authentification
- ✅ Server-side price calculation prévient la fraude
- ✅ Webhook signature verification en place
- ✅ Idempotent webhook processing via stripe_webhook_events table

### Database
- ✅ Migration 009 UP crée tous les tables
- ✅ Migration 009 DOWN rollback complet
- ✅ Colonnes correctes pour users (stripe_account_id, stripe_charges_enabled, etc.)
- ✅ course_demands table bien structurée
- ✅ stage_reservations table bien structurée
- ✅ payments table avec tous les champs Stripe
- ✅ stripe_webhook_events table pour idempotency

### Sécurité Edge Functions
- ✅ CORS headers correctement configurés
- ✅ Vérification JWT sur tous les endpoints
- ✅ Vérification d'authentification du buyer
- ✅ Vérification que buyer est propriétaire du demand
- ✅ Vérification que seller a Stripe account
- ✅ Vérification que stripe_charges_enabled = true

### Sécurité Webhook
- ✅ Signature verification correcte (HMAC-SHA256)
- ✅ Idempotency check via stripe_event_id
- ✅ Ne pas échouer si processing échoue (retourne 200 quand même)

### Calculs Financiers (Webhook)
- ✅ Transfer montant correct: `payment.amount_seller_ht` 
- ✅ Destination correcte: `seller.stripe_account_id`
- ✅ Description de transfer contient payment ID

### Composants Frontend
- ✅ PaymentBreakdown affichage correct
- ✅ SellerStatus affichage des statuts
- ✅ StripeConnectButton UI correcte
- ✅ checkout-success écran de confirmation
- ✅ stripe-onboarding post-onboarding flow
- ✅ Styling cohérent avec les autres composants

### Documentation
- ✅ STRIPE_INTEGRATION_PLAN.md très complet (13 sections)
- ✅ Checklist de déploiement claire
- ✅ Test checklist fournie
- ✅ Troubleshooting guide complet

---

## 📋 PLAN DE CORRECTION

### Phase 1: Créer les 1 fonction Edge manquante (Urgence: CRITIQUE)

**À créer:**
1. `create-stripe-onboarding-link` - Crée l'URL d'onboarding Stripe
2. `verify-checkout-session` - Vérifie le statut d'une session de checkout

**Temps estimé:** 45 min

---

### Phase 2: Fixer les bugs dans les Edge Functions (Urgence: CRITIQUE)

1. **create-checkout-session/index.ts ligne 261**
   - Corriger calcul de `amount_seller_ht`
   - Vérifier que ça correspond à `demandData.total_amount_ht - commission`

2. **webhook-stripe/index.ts ligne 97**
   - Ajouter `stripe_session_id` aux metadata dans `create-checkout-session`
   - Corriger le webhook pour chercher correctement

3. **Toutes les fonctions getAuthToken()**
   - Implémenter correctement
   - Utiliser Supabase auth ou votre système d'auth

**Temps estimé:** 30 min

---

### Phase 3: Vérifier l'intégration frontend (Urgence: HAUTE)

1. Vérifier que `reserver-coach.tsx` et autres écrans appellent les bonnes fonctions
2. Vérifier que les imports et types sont corrects
3. Tester les appels API

**Temps estimé:** 20 min

---

## 🚀 CHECKLIST DE CORRECTION

- [ ] Créer `create-stripe-onboarding-link` Edge Function
  - [ ] Créer Stripe Connect account si n'existe pas
  - [ ] Générer onboarding link
  - [ ] Retourner URL

- [ ] Créer `verify-checkout-session` Edge Function
  - [ ] Chercher paiement par session ID
  - [ ] Retourner statut et détails

- [ ] Fixer `create-checkout-session`
  - [ ] Corriger calcul amount_seller_ht
  - [ ] Ajouter stripe_session_id aux metadata

- [ ] Fixer `webhook-stripe`
  - [ ] Utiliser stripe_session_id depuis metadata
  - [ ] Ou créer client_reference_id

- [ ] Implémenter `getAuthToken()` partout
  - [ ] StripeConnectButton
  - [ ] SellerStatus
  - [ ] checkout-success
  - [ ] stripe-onboarding

- [ ] Tester les flows end-to-end
  - [ ] Seller onboarding
  - [ ] Buyer checkout
  - [ ] Webhook processing

---

## 📊 Score Final

**Avant corrections:** 6/10 (Architecture bonne, mais bugs critiques)
**Après corrections:** 10/10 (Production ready)

---

## 🎯 Recommendation

**NE PAS DÉPLOYER** avant corrections. Les bugs trouvés sont critiques et empêcheront:
1. Les vendeurs de se connecter à Stripe
2. Les acheteurs de confirmer les paiements
3. Les montants des vendeurs de calculer correctement
4. Les webhooks de fonctionner

**Temps de correction estimé:** 90 minutes pour tout corriger et tester.

