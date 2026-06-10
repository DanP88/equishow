import { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView,
  TextInput, Modal, Linking, ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useSupportRequests, SupportRequest, SupportStatus } from '../hooks/useSupportRequests';
import { Colors } from '../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../constants/theme';

// UI ReservationType ⇄ category DB (CHECK support_requests.category).
const CATEGORY_BY_RESA_TYPE: Record<ReservationType, string> = {
  transport: 'transport',
  box: 'box',
  coaching: 'coaching',
  stage: 'stage',
  autre: 'autre',
};

type Tab = 'faq' | 'legal' | 'contact' | 'reclamation';
type ReservationType = 'transport' | 'box' | 'coaching' | 'stage' | 'autre';

const FAQ_ITEMS = [
  {
    q: 'Comment faire une réservation ?',
    a: "Rendez-vous dans l'onglet Services, choisissez un transport, box ou coaching, puis suivez les étapes. Pour un coaching ou un stage, vous envoyez d'abord une demande : le paiement n'est dû qu'une fois la demande acceptée par le prestataire. Le paiement est sécurisé via Stripe.",
  },
  {
    q: 'Comment fonctionne le paiement et le séquestre ?',
    a: "Le paiement est traité par Stripe ; vos données bancaires ne transitent jamais par nos serveurs. Votre argent est conservé en séquestre sécurisé : il n'est versé au prestataire qu'une fois la prestation réalisée et validée. La commission Equishow est incluse dans le total affiché au paiement.",
  },
  {
    q: 'Quand le prestataire est-il payé ? Comment valider une prestation ?',
    a: "Une fois la prestation effectuée, ouvrez la réservation dans votre agenda et appuyez sur « J'ai reçu la prestation — libérer ». Les fonds sont alors versés au prestataire. Si vous ne faites rien, la libération se fait automatiquement après la date de prestation.",
  },
  {
    q: 'Un souci avec une prestation ? (litige)',
    a: "Depuis la réservation concernée dans votre agenda, appuyez sur « Signaler un problème ». Le versement au prestataire est bloqué le temps qu'un administrateur examine la situation. N'utilisez cette option qu'en cas de réel problème.",
  },
  {
    q: 'Je suis coach / vendeur : comment recevoir mes paiements ?',
    a: "Dans l'onglet Profil, appuyez sur la ligne « Compte Stripe » puis sur « Gérer / Activer mon compte Stripe ». Vous créez ou complétez votre compte Stripe Connect : c'est lui qui reçoit vos virements. Tant qu'il n'est pas actif, vos gains restent en attente.",
  },
  {
    q: 'Où voir mes gains (coach / vendeur) ?',
    a: "Profil → ligne « Compte Stripe actif » → « Voir mes paiements ». Vous y voyez « Déjà gagné » (déjà versé sur votre compte Stripe) et « En séquestre » (encaissé mais en attente de validation de la prestation).",
  },
  {
    q: 'Comment fonctionne mon agenda ?',
    a: "L'onglet Agenda regroupe toutes vos réservations — celles que vous réservez et, si vous êtes coach, les cours/stages que vous animez. Elles sont triées par période (Aujourd'hui, Cette semaine…). Le bandeau de jours en haut permet de filtrer un jour précis, et le bouton « RDV passés » affiche l'historique du plus récent au plus ancien.",
  },
  {
    q: 'Comment laisser un avis ?',
    a: "Un avis n'est possible qu'une fois la prestation terminée. Le bouton « Laisser un avis » apparaît alors sur la réservation dans votre agenda.",
  },
  {
    q: 'Comment annuler une réservation ?',
    a: "Contactez le support via la section Contact avec votre numéro de réservation. Les conditions d'annulation varient selon le prestataire et le délai avant la prestation.",
  },
  {
    q: 'Quels sont les délais de remboursement ?',
    a: 'En cas de remboursement validé, la somme est créditée sur votre moyen de paiement sous 5 à 10 jours ouvrés, selon votre banque.',
  },
  {
    q: 'Comment contacter un prestataire ?',
    a: "Utilisez la messagerie intégrée : l'icône de conversation sur la fiche du prestataire, ou directement depuis une réservation dans votre agenda.",
  },
  {
    q: 'Mon numéro de référence, à quoi ça sert ?',
    a: "Chaque réservation génère un numéro de référence unique (ex: EQ-BOX-XXXXXXXX). Conservez-le pour toute demande auprès du support ou pour faire une réclamation.",
  },
  {
    q: 'Comment modifier mon profil ?',
    a: "Dans l'onglet Profil, appuyez sur « Modifier mon profil ». Vous pouvez changer votre nom, région, disciplines et bio.",
  },
];

const RESERVATION_TYPES: { value: ReservationType; label: string }[] = [
  { value: 'transport', label: 'Transport' },
  { value: 'box', label: 'Box / Hébergement' },
  { value: 'coaching', label: 'Coaching' },
  { value: 'stage', label: 'Stage' },
  { value: 'autre', label: 'Autre' },
];

const VALID_TABS: Tab[] = ['faq', 'legal', 'contact', 'reclamation'];

// Affichage statut réclamation côté cavalier (lecture seule).
const SUPPORT_STATUS_META: Record<SupportStatus, { label: string; bg: string; fg: string }> = {
  open: { label: 'Ouverte', bg: '#FEF3C7', fg: '#92400E' },
  in_progress: { label: 'En cours', bg: '#DBEAFE', fg: '#1E40AF' },
  resolved: { label: 'Résolue', bg: '#D1FAE5', fg: '#065F46' },
  closed: { label: 'Close', bg: '#E5E7EB', fg: '#374151' },
};

function fmtSupportDate(iso: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
}

export default function SupportScreen() {
  // ?ref=EQ-XXX-XXXXXXXX pré-remplit le formulaire de réclamation (depuis une
  // réservation). La présence de `ref` ouvre directement l'onglet Réclamation.
  const { tab: tabParam, ref: refParam } = useLocalSearchParams<{ tab?: string; ref?: string }>();
  const initialRef = typeof refParam === 'string' ? refParam : '';
  const [tab, setTab] = useState<Tab>(
    initialRef ? 'reclamation'
      : VALID_TABS.includes(tabParam as Tab) ? (tabParam as Tab) : 'faq'
  );
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Réclamation state
  const [refReservation, setRefReservation] = useState(initialRef);
  const [resaType, setResaType] = useState<ReservationType>(
    initialRef.startsWith('EQ-TRANSP') ? 'transport'
      : initialRef.startsWith('EQ-BOX') ? 'box'
      : initialRef.startsWith('EQ-STAGE') ? 'stage'
      : initialRef.startsWith('EQ-COURS') ? 'coaching'
      : 'transport'
  );
  const [objet, setObjet] = useState('');
  const [description, setDescription] = useState('');
  const [claimNumber, setClaimNumber] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Liste « Mes réclamations » (RLS user : ne renvoie que les siennes, triées récent→ancien).
  const {
    items: myTickets,
    loading: ticketsLoading,
    error: ticketsError,
    refresh: refreshTickets,
  } = useSupportRequests();

  async function submitReclamation() {
    if (!objet.trim() || !description.trim() || submitting) return;
    setSubmitting(true);
    setSubmitError(null);

    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) {
      setSubmitting(false);
      setSubmitError('Vous devez être connecté pour envoyer une réclamation.');
      return;
    }

    const { data, error } = await supabase
      .from('support_requests')
      .insert({
        user_id: userId,
        reservation_ref: refReservation.trim() || null,
        reservation_type: resaType,
        category: CATEGORY_BY_RESA_TYPE[resaType] ?? 'autre',
        subject: objet.trim(),
        description: description.trim(),
      })
      .select('ref')
      .single();

    setSubmitting(false);

    if (error || !data?.ref) {
      setSubmitError(error?.message ?? "Échec de l'envoi. Réessayez.");
      return;
    }

    // Référence renvoyée par le serveur (autoritative, unique).
    setClaimNumber(data.ref);
    setShowSuccess(true);
    // Rafraîchit la liste « Mes réclamations » pour y faire apparaître le nouveau ticket.
    refreshTickets();
  }

  function resetForm() {
    setRefReservation('');
    setObjet('');
    setDescription('');
    setClaimNumber(null);
    setShowSuccess(false);
    setSubmitError(null);
  }

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.canGoBack() ? router.back() : router.replace('/')}>
          <Text style={s.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Support & Aide</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Tabs */}
      <View style={s.tabs}>
        {(['faq', 'legal', 'contact', 'reclamation'] as Tab[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[s.tab, tab === t && s.tabActive]}
            onPress={() => setTab(t)}
            activeOpacity={0.8}
          >
            <Text style={[s.tabText, tab === t && s.tabTextActive]}>
              {t === 'faq' ? 'FAQ' : t === 'legal' ? 'Légal' : t === 'contact' ? 'Contact' : 'Réclamation'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">

        {/* ── FAQ ── */}
        {tab === 'faq' && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Questions fréquentes</Text>
            {FAQ_ITEMS.map((item, idx) => (
              <TouchableOpacity
                key={idx}
                style={[s.faqItem, openFaq === idx && s.faqItemOpen]}
                onPress={() => setOpenFaq(openFaq === idx ? null : idx)}
                activeOpacity={0.8}
              >
                <View style={s.faqQuestion}>
                  <Text style={s.faqQ}>{item.q}</Text>
                  <Text style={s.faqChevron}>{openFaq === idx ? '▲' : '▼'}</Text>
                </View>
                {openFaq === idx && (
                  <Text style={s.faqA}>{item.a}</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ── LÉGAL ── */}
        {tab === 'legal' && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Mentions légales</Text>

            <View style={s.legalBlock}>
              <Text style={s.legalHeading}>Éditeur</Text>
              <Text style={s.legalText}>
                Equishow SAS — Société par actions simplifiée{'\n'}
                Capital social : 10 000 €{'\n'}
                Siège social : France{'\n'}
                Email : contact@equishow.fr
              </Text>
            </View>

            <View style={s.legalBlock}>
              <Text style={s.legalHeading}>Hébergement</Text>
              <Text style={s.legalText}>
                L'application est hébergée sur les serveurs de Supabase (supabase.com) et Vercel (vercel.com), conformément au RGPD.
              </Text>
            </View>

            <View style={s.legalBlock}>
              <Text style={s.legalHeading}>Données personnelles</Text>
              <Text style={s.legalText}>
                Conformément à la loi Informatique et Libertés et au Règlement Général sur la Protection des Données (RGPD), vous disposez d'un droit d'accès, de rectification et de suppression de vos données personnelles.{'\n\n'}
                Pour exercer ces droits, contactez-nous à : rgpd@equishow.fr
              </Text>
            </View>

            <View style={s.legalBlock}>
              <Text style={s.legalHeading}>Paiements</Text>
              <Text style={s.legalText}>
                Les paiements sont traités par Stripe, Inc. Equishow n'a pas accès à vos données bancaires. En cas de litige de paiement, contactez Stripe directement ou notre support.
              </Text>
            </View>

            <View style={s.legalBlock}>
              <Text style={s.legalHeading}>Responsabilité</Text>
              <Text style={s.legalText}>
                Equishow est une plateforme de mise en relation. Les prestataires (transporteurs, propriétaires de boxes, coachs) sont des tiers indépendants. Equishow ne peut être tenu responsable des prestations fournies par ces tiers.
              </Text>
            </View>

            <View style={s.legalBlock}>
              <Text style={s.legalHeading}>Cookies</Text>
              <Text style={s.legalText}>
                L'application utilise des cookies et technologies similaires pour le fonctionnement de la session et l'amélioration de l'expérience utilisateur. Aucun cookie publicitaire tiers n'est déposé.
              </Text>
            </View>
          </View>
        )}

        {/* ── CONTACT ── */}
        {tab === 'contact' && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Nous contacter</Text>

            <View style={s.contactCard}>
              <Text style={s.contactIcon}>📧</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.contactLabel}>Email support</Text>
                <TouchableOpacity onPress={() => Linking.openURL('mailto:support@equishow.fr')}>
                  <Text style={s.contactValue}>support@equishow.fr</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={s.contactCard}>
              <Text style={s.contactIcon}>🕐</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.contactLabel}>Horaires</Text>
                <Text style={s.contactText}>Lundi – Vendredi{'\n'}9h00 – 18h00 (CET)</Text>
              </View>
            </View>

            <View style={s.contactCard}>
              <Text style={s.contactIcon}>⏱️</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.contactLabel}>Délai de réponse</Text>
                <Text style={s.contactText}>Sous 24h en jours ouvrés</Text>
              </View>
            </View>

            <View style={s.infoBox}>
              <Text style={s.infoBoxTitle}>Avant de nous contacter</Text>
              <Text style={s.infoBoxText}>
                Pensez à avoir votre numéro de réservation sous la main (format EQ-XXX-XXXXXXXX). Vous le trouverez dans le récapitulatif de votre réservation ou dans l'email de confirmation.
              </Text>
            </View>
          </View>
        )}

        {/* ── RÉCLAMATION ── */}
        {tab === 'reclamation' && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Faire une réclamation</Text>
            <Text style={s.sectionSubtitle}>
              Décrivez votre problème. Un numéro de dossier vous sera attribué pour le suivi.
            </Text>

            {/* Référence réservation (optionnel) */}
            <View style={s.field}>
              <Text style={s.fieldLabel}>N° de réservation (optionnel)</Text>
              <TextInput
                style={s.input}
                value={refReservation}
                onChangeText={setRefReservation}
                placeholder="EQ-BOX-XXXXXXXX"
                placeholderTextColor={Colors.textTertiary}
                autoCapitalize="characters"
              />
            </View>

            {/* Type de réservation */}
            <View style={s.field}>
              <Text style={s.fieldLabel}>Type de réservation</Text>
              <View style={s.chipRow}>
                {RESERVATION_TYPES.map((rt) => (
                  <TouchableOpacity
                    key={rt.value}
                    style={[s.chip, resaType === rt.value && s.chipActive]}
                    onPress={() => setResaType(rt.value)}
                    activeOpacity={0.8}
                  >
                    <Text style={[s.chipText, resaType === rt.value && s.chipTextActive]}>
                      {rt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Objet */}
            <View style={s.field}>
              <Text style={s.fieldLabel}>Objet *</Text>
              <TextInput
                style={[s.input, !!objet && s.inputFilled]}
                value={objet}
                onChangeText={setObjet}
                placeholder="Ex: Prestation non conforme, problème de paiement..."
                placeholderTextColor={Colors.textTertiary}
              />
            </View>

            {/* Description */}
            <View style={s.field}>
              <Text style={s.fieldLabel}>Description *</Text>
              <TextInput
                style={[s.input, s.inputMultiline, !!description && s.inputFilled]}
                value={description}
                onChangeText={setDescription}
                placeholder="Décrivez votre problème en détail : dates, prestataire concerné, ce qui s'est passé..."
                placeholderTextColor={Colors.textTertiary}
                multiline
                numberOfLines={5}
              />
            </View>

            {!!submitError && (
              <View style={s.errorBox}>
                <Text style={s.errorText}>{submitError}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[s.submitBtn, (!objet.trim() || !description.trim() || submitting) && s.submitBtnDisabled]}
              onPress={submitReclamation}
              disabled={!objet.trim() || !description.trim() || submitting}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={s.submitBtnText}>Envoyer la réclamation</Text>
              )}
            </TouchableOpacity>

            {/* ── Mes réclamations ── */}
            <View style={s.myClaims}>
              <View style={s.myClaimsHeader}>
                <Text style={s.sectionTitle}>Mes réclamations</Text>
                {!ticketsLoading && (
                  <TouchableOpacity onPress={() => refreshTickets()} activeOpacity={0.7}>
                    <Text style={s.refreshLink}>↻ Actualiser</Text>
                  </TouchableOpacity>
                )}
              </View>

              {ticketsLoading ? (
                <ActivityIndicator color={Colors.primary} style={{ marginTop: Spacing.lg }} />
              ) : ticketsError ? (
                <View style={s.errorBox}>
                  <Text style={s.errorText}>Impossible de charger vos réclamations : {ticketsError}</Text>
                </View>
              ) : myTickets.length === 0 ? (
                <View style={s.claimsEmpty}>
                  <Text style={s.claimsEmptyText}>
                    Vous n'avez aucune réclamation pour le moment.
                  </Text>
                </View>
              ) : (
                myTickets.map((t: SupportRequest) => {
                  const meta = SUPPORT_STATUS_META[t.status];
                  return (
                    <View key={t.id} style={s.claimCard}>
                      <View style={s.claimCardTop}>
                        <Text style={s.claimRef}>{t.ref}</Text>
                        <View style={[s.claimStatusBadge, { backgroundColor: meta.bg }]}>
                          <Text style={[s.claimStatusText, { color: meta.fg }]}>{meta.label}</Text>
                        </View>
                      </View>
                      <Text style={s.claimSubject}>{t.subject}</Text>
                      <Text style={s.claimMeta}>
                        {t.category} · {fmtSupportDate(t.createdAt)}
                      </Text>

                      {t.status === 'resolved' && (
                        <View style={s.claimResolution}>
                          <Text style={s.claimResolutionLabel}>
                            Réponse{t.resolvedAt ? ` · ${fmtSupportDate(t.resolvedAt)}` : ''}
                          </Text>
                          <Text style={s.claimResolutionText}>
                            {t.resolutionMessage?.trim()
                              ? t.resolutionMessage
                              : 'Votre réclamation a été traitée par notre équipe.'}
                          </Text>
                        </View>
                      )}
                    </View>
                  );
                })
              )}
            </View>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Modal succès réclamation */}
      <Modal visible={showSuccess} transparent animationType="fade">
        <View style={s.modalBackdrop}>
          <View style={s.modalCard}>
            <Text style={s.modalIcon}>✅</Text>
            <Text style={s.modalTitle}>Réclamation envoyée</Text>
            <Text style={s.modalText}>
              Votre dossier a été créé avec succès. Conservez ce numéro pour le suivi :
            </Text>

            <View style={s.claimBadge}>
              <Text style={s.claimLabel}>N° de dossier</Text>
              <Text style={s.claimNumber}>{claimNumber}</Text>
            </View>

            <Text style={s.modalNote}>
              Notre équipe traitera votre réclamation au plus vite. Vous serez notifié
              dans l'application dès qu'une réponse sera disponible.
            </Text>

            <TouchableOpacity
              style={s.modalBtn}
              onPress={() => {
                resetForm();
                setTab('contact');
              }}
              activeOpacity={0.85}
            >
              <Text style={s.modalBtnText}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surfaceVariant, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 24, color: Colors.textPrimary, lineHeight: 28 },
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },

  tabs: { flexDirection: 'row', backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tab: { flex: 1, paddingVertical: Spacing.md, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: Colors.primary },
  tabText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.textSecondary },
  tabTextActive: { color: Colors.primary },

  container: { padding: Spacing.lg },
  section: { gap: Spacing.md },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.xs },
  sectionSubtitle: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20, marginBottom: Spacing.sm },

  // FAQ
  faqItem: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border, overflow: 'hidden',
  },
  faqItemOpen: { borderColor: Colors.primaryBorder },
  faqQuestion: { flexDirection: 'row', alignItems: 'center', padding: Spacing.lg, gap: Spacing.md },
  faqQ: { flex: 1, fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  faqChevron: { fontSize: FontSize.xs, color: Colors.textTertiary },
  faqA: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg },

  // Légal
  legalBlock: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, gap: Spacing.sm },
  legalHeading: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  legalText: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },

  // Contact
  contactCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg,
    borderWidth: 1, borderColor: Colors.border, flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md,
  },
  contactIcon: { fontSize: 24 },
  contactLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  contactValue: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.primary },
  contactText: { fontSize: FontSize.base, color: Colors.textPrimary, lineHeight: 22 },
  infoBox: { backgroundColor: Colors.primaryLight, borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.primaryBorder, gap: Spacing.sm },
  infoBoxTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.primary },
  infoBoxText: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },

  // Réclamation
  field: { gap: Spacing.xs },
  fieldLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 4,
    fontSize: FontSize.base, color: Colors.textPrimary, backgroundColor: Colors.surface,
  },
  inputFilled: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  inputMultiline: { minHeight: 110, textAlignVertical: 'top' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.semibold },
  chipTextActive: { color: Colors.textInverse },
  submitBtn: { backgroundColor: Colors.primary, borderRadius: Radius.lg, paddingVertical: Spacing.md + 4, alignItems: 'center', ...Shadow.fab, marginTop: Spacing.md },
  submitBtnDisabled: { opacity: 0.4 },
  submitBtnText: { color: Colors.textInverse, fontWeight: FontWeight.extrabold, fontSize: FontSize.base },
  errorBox: { backgroundColor: '#FEE2E2', borderLeftWidth: 4, borderLeftColor: '#DC2626', borderRadius: Radius.sm, padding: Spacing.md, marginTop: Spacing.sm },
  errorText: { color: '#991B1B', fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  myClaims: { marginTop: Spacing.xl, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.lg },
  myClaimsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md },
  refreshLink: { color: Colors.primary, fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  claimsEmpty: { padding: Spacing.lg, alignItems: 'center' },
  claimsEmptyText: { color: Colors.textSecondary, fontSize: FontSize.sm, textAlign: 'center' },
  claimCard: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.md, gap: 4 },
  claimCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  claimRef: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.primary },
  claimStatusBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: 999 },
  claimStatusText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  claimSubject: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary, marginTop: 2 },
  claimMeta: { fontSize: FontSize.xs, color: Colors.textTertiary },
  claimResolution: { marginTop: Spacing.sm, backgroundColor: '#ECFDF5', borderRadius: Radius.md, padding: Spacing.md },
  claimResolutionLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: '#065F46', textTransform: 'uppercase' },
  claimResolutionText: { fontSize: FontSize.sm, color: Colors.textPrimary, marginTop: 4, lineHeight: 20 },

  // Modal succès
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
  modalCard: { backgroundColor: Colors.surface, borderRadius: Radius.xxl, padding: Spacing.xl, alignItems: 'center', width: '100%', ...Shadow.card, gap: Spacing.md },
  modalIcon: { fontSize: 52 },
  modalTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.extrabold, color: Colors.textPrimary, textAlign: 'center' },
  modalText: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  claimBadge: { backgroundColor: Colors.primaryLight, borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.primaryBorder, alignItems: 'center', width: '100%' },
  claimLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.primary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.xs },
  claimNumber: { fontSize: FontSize.xl, fontWeight: FontWeight.extrabold, color: Colors.primary, letterSpacing: 1 },
  modalNote: { fontSize: FontSize.xs, color: Colors.textTertiary, textAlign: 'center', lineHeight: 18 },
  modalBtn: { backgroundColor: Colors.primary, borderRadius: Radius.lg, paddingVertical: Spacing.md, paddingHorizontal: Spacing.xxl, alignItems: 'center' },
  modalBtnText: { color: Colors.textInverse, fontWeight: FontWeight.bold, fontSize: FontSize.base },
});
